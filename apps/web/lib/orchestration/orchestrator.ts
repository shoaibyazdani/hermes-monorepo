import { executeAgent } from "../runtime/agent-runtime";
import { getRuntimeConfig } from "../runtime/config";
import { getAgentDefinition } from "../runtime/agents/definitions";
import { createMiniMaxProvider } from "../runtime/providers/minimax";
import { createCortexProvider } from "../runtime/providers/cortex";
import type { ModelProvider } from "../runtime/providers/types";
import type { RuntimeEvent } from "../runtime/events";
import { ORCHESTRATION_LIMITS } from "./limits";
import { createPlan } from "./planner";
import { blockedSteps, readySteps } from "./plan-validator";
import { getOrchestrationStore } from "./store";
import type { OrchestrationEvent } from "./events";
import type { AgentResult, Orchestration, OrchestrationStep } from "./types";

/**
 * The Hermes orchestrator.
 *
 * Plans, delegates, schedules, collects and synthesises. It creates ordinary
 * agent runs through the existing runtime rather than a parallel execution
 * path, so everything downstream — run manager, tool authorisation, provider
 * abstraction, cancellation — applies unchanged.
 *
 * Emits a merged stream: its own orchestration events plus the runtime events
 * of every delegated run, each tagged with `orchestrationId` and `stepId` so
 * the client can rebuild the hierarchy.
 *
 * SERVER ONLY.
 */

export interface OrchestrationRequest {
  conversationId: string;
  message: string;
  missionId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Reserved for a future auth layer; unused for decisions today. */
  userId?: string;
  sessionId?: string;
}

/** A runtime event carrying its orchestration correlation. */
export type CorrelatedRuntimeEvent = RuntimeEvent & {
  orchestrationId: string;
  stepId: string;
};

export type OrchestratorEvent = OrchestrationEvent | CorrelatedRuntimeEvent;

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

function resolveProvider(): ModelProvider | null {
  const cfg = getRuntimeConfig();
  if (cfg.provider === "minimax" && cfg.apiKey) {
    return createMiniMaxProvider({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      timeoutMs: cfg.timeoutMs,
      thinkingEnabled: cfg.thinkingEnabled,
    });
  }
  if (cfg.provider === "cortex") {
    return createCortexProvider({
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      timeoutMs: cfg.timeoutMs,
    });
  }
  return null;
}

/**
 * Run one delegated step to completion and reduce it to a structured result.
 *
 * Runtime events are pushed to `onEvent` as they arrive so the UI stays live,
 * while the accumulated text becomes the step's summary. Each step gets its
 * OWN conversation id, so a delegation can never write into the operator's
 * Hermes conversation or another agent's.
 */
async function runStep(
  orchestrationId: string,
  step: OrchestrationStep,
  objective: string,
  onEvent: (event: OrchestratorEvent) => void,
  signal: AbortSignal,
): Promise<AgentResult> {
  const startedAt = Date.now();
  const delegatedConversationId =
    step.conversationId ?? `conv-${step.agentId}-${nextId("d")}`;

  let text = "";
  let failure: string | null = null;
  let runId = "";

  // Per-step timeout, linked to the orchestration-wide signal so STOP ALL
  // aborts an in-flight delegation immediately.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () => controller.abort(),
    ORCHESTRATION_LIMITS.STEP_TIMEOUT_MS,
  );

  try {
    for await (const ev of executeAgent({
      agentId: step.agentId,
      conversationId: delegatedConversationId,
      // The task carries its own context: the agent cannot see the Hermes
      // conversation, and passing it wholesale would leak unrelated turns.
      message: `${step.task}\n\n[Context] This work is part of: ${objective}`,
      missionId: undefined,
      signal: controller.signal,
    })) {
      runId = ev.runId;
      onEvent({ ...ev, orchestrationId, stepId: step.id });

      if (ev.type === "message.delta") text += ev.payload.text;
      if (ev.type === "message.completed") text = ev.payload.text;
      if (ev.type === "agent.error") failure = ev.payload.message;
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : "The delegated run failed.";
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }

  const durationMs = Date.now() - startedAt;
  const timedOut = controller.signal.aborted && !signal.aborted && !text;
  const cancelled = signal.aborted;

  if (cancelled) {
    return {
      runId,
      agentId: step.agentId,
      stepId: step.id,
      status: "cancelled",
      summary: text || "Cancelled before producing a result.",
      failureReason: "Cancelled by the operator.",
      durationMs,
    };
  }
  if (timedOut) {
    return {
      runId,
      agentId: step.agentId,
      stepId: step.id,
      status: "timed-out",
      summary: "No result: the run exceeded its time limit.",
      failureReason: `Exceeded ${ORCHESTRATION_LIMITS.STEP_TIMEOUT_MS / 1000}s.`,
      durationMs,
    };
  }
  if (failure || !text.trim()) {
    return {
      runId,
      agentId: step.agentId,
      stepId: step.id,
      status: "failed",
      summary: "No result was produced.",
      failureReason: failure ?? "The agent returned nothing.",
      durationMs,
    };
  }

  return {
    runId,
    agentId: step.agentId,
    stepId: step.id,
    status: "completed",
    summary: text.trim(),
    durationMs,
  };
}

/**
 * Execute an orchestrated request.
 *
 * Phases: plan → schedule → collect → synthesise. Each yields events as it
 * goes, so the UI reflects progress rather than waiting for the whole thing.
 */
export async function* executeOrchestration(
  request: OrchestrationRequest,
): AsyncIterable<OrchestratorEvent> {
  const store = getOrchestrationStore();
  const startedAt = Date.now();
  const orchestrationId = nextId("orch");

  const base = {
    orchestrationId,
    conversationId: request.conversationId,
    missionId: request.missionId,
  };
  const emit = <T extends OrchestrationEvent["type"]>(
    type: T,
    payload: Extract<OrchestrationEvent, { type: T }>["payload"],
  ): OrchestrationEvent =>
    ({
      id: nextId("oev"),
      timestamp: new Date().toISOString(),
      ...base,
      type,
      payload,
    }) as OrchestrationEvent;

  const orchestration: Orchestration = {
    id: orchestrationId,
    conversationId: request.conversationId,
    missionId: request.missionId,
    objective: request.message.slice(0, 200),
    status: "planning",
    steps: [],
    startedAt: new Date().toISOString(),
    depth: 0,
  };
  store.create(orchestration);
  const signal = store.abortSignal(orchestrationId)!;

  yield emit("orchestration.started", {
    objective: orchestration.objective,
    depth: 0,
  });

  const provider = resolveProvider();
  if (!provider) {
    store.update(orchestrationId, { status: "failed" });
    yield emit("orchestration.failed", {
      reason:
        "No model provider is configured. Set AI_API_KEY or CORTEX_BASE_URL to enable orchestration.",
    });
    return;
  }

  /* ── Plan ─────────────────────────────────────────────────────────────── */

  const { result } = await createPlan(provider, {
    message: request.message,
    history: request.history,
    depth: 0,
    signal,
  });

  if (!result.ok) {
    // A rejected plan is not a failure: Hermes answers directly instead. That
    // is the safe fallback, and it keeps a bad plan from running.
    console.warn("[orchestration] plan rejected", {
      orchestrationId,
      reason: result.reason,
    });
    yield emit("plan.rejected", { reason: result.reason });
    yield* synthesise(orchestrationId, base, request, [], provider, signal);
    store.update(orchestrationId, { status: "completed" });
    yield emit("orchestration.completed", {
      durationMs: Date.now() - startedAt,
      completed: 0,
      failed: 0,
      total: 0,
    });
    return;
  }

  const plan = result.plan;
  store.update(orchestrationId, { plan, steps: plan.steps, status: "running" });
  yield emit("plan.created", { plan });

  // No steps: Hermes judged the request simple enough to answer itself.
  if (plan.direct || plan.steps.length === 0) {
    yield* synthesise(orchestrationId, base, request, [], provider, signal);
    store.update(orchestrationId, { status: "completed" });
    yield emit("orchestration.completed", {
      durationMs: Date.now() - startedAt,
      completed: 0,
      failed: 0,
      total: 0,
    });
    return;
  }

  for (const step of plan.steps) {
    yield emit("step.queued", {
      stepId: step.id,
      agentId: step.agentId,
      task: step.task,
    });
  }

  /* ── Schedule ─────────────────────────────────────────────────────────── */

  const steps = plan.steps.map((s) => ({ ...s }));
  const results: AgentResult[] = [];

  // Events from concurrently running delegations are funnelled through one
  // queue so the generator can yield them in arrival order without waiting on
  // any single step. `wake` resolves the instant anything is pushed, so a fast
  // delegated stream is never left buffered behind a poll interval.
  const queue: OrchestratorEvent[] = [];
  let wake: (() => void) | null = null;
  const push = (e: OrchestratorEvent) => {
    queue.push(e);
    const w = wake;
    wake = null;
    w?.();
  };

  const inFlight = new Map<string, Promise<void>>();

  const launch = (step: OrchestrationStep) => {
    step.status = "running";
    step.conversationId = `conv-${step.agentId}-${nextId("d")}`;
    store.updateStep(orchestrationId, step.id, {
      status: "running",
      conversationId: step.conversationId,
      startedAt: new Date().toISOString(),
    });

    push(
      emit("delegation.created", {
        stepId: step.id,
        agentId: step.agentId,
        delegatedConversationId: step.conversationId,
        task: step.task,
      }),
    );
    push(
      emit("step.started", {
        stepId: step.id,
        agentId: step.agentId,
        runId: "pending",
      }),
    );

    const promise = (async () => {
      const stepStart = Date.now();
      const result = await runStep(
        orchestrationId,
        step,
        plan.objective,
        push,
        signal,
      );
      results.push(result);
      step.status =
        result.status === "completed"
          ? "completed"
          : result.status === "timed-out"
            ? "timed-out"
            : result.status === "cancelled"
              ? "cancelled"
              : "failed";
      store.setStepResult(orchestrationId, step.id, result);

      if (result.status === "completed") {
        push(
          emit("delegation.completed", {
            stepId: step.id,
            agentId: step.agentId,
            runId: result.runId,
            durationMs: Date.now() - stepStart,
          }),
        );
        push(
          emit("step.completed", {
            stepId: step.id,
            agentId: step.agentId,
            result,
          }),
        );
      } else if (result.status === "cancelled") {
        push(emit("step.cancelled", { stepId: step.id, agentId: step.agentId }));
      } else {
        const reason = result.failureReason ?? "The run did not complete.";
        push(
          emit("delegation.failed", {
            stepId: step.id,
            agentId: step.agentId,
            reason,
          }),
        );
        push(
          emit("step.failed", { stepId: step.id, agentId: step.agentId, reason }),
        );
      }
    })().finally(() => {
      inFlight.delete(step.id);
      // Wake the loop so it can schedule dependents or finish.
      const w = wake;
      wake = null;
      w?.();
    });

    inFlight.set(step.id, promise);
  };

  // Scheduler: start what is ready, drain everything queued, then wait for the
  // next push or completion. Draining fully each pass is what keeps a fast
  // delegated stream flowing to the client.
  while (true) {
    if (signal.aborted) break;

    for (const step of readySteps(steps)) {
      if (inFlight.size >= ORCHESTRATION_LIMITS.MAX_CONCURRENT_RUNS) break;
      launch(step);
    }

    // A step whose prerequisite failed can never run; mark it rather than
    // waiting forever for work that will not be scheduled.
    for (const step of blockedSteps(steps)) {
      if (inFlight.has(step.id)) continue;
      step.status = "cancelled";
      store.updateStep(orchestrationId, step.id, { status: "cancelled" });
      push(
        emit("step.failed", {
          stepId: step.id,
          agentId: step.agentId,
          reason: "A prerequisite step did not complete.",
        }),
      );
    }

    while (queue.length) yield queue.shift()!;

    const pending = steps.some(
      (s) => s.status === "queued" || s.status === "waiting",
    );
    if (inFlight.size === 0 && !pending) break;

    // Resolve as soon as anything is pushed; the timeout is only a safety net
    // so an unexpected stall cannot hang the stream forever.
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      wake = done;
      setTimeout(done, 5_000);
    });
  }

  while (queue.length) yield queue.shift()!;

  /* ── Cancellation ─────────────────────────────────────────────────────── */

  if (signal.aborted) {
    await Promise.allSettled([...inFlight.values()]);
    while (queue.length) yield queue.shift()!;

    const completed = steps.filter((s) => s.status === "completed").length;
    store.update(orchestrationId, { status: "cancelled" });
    // Completed results are preserved on their steps, not discarded.
    yield emit("orchestration.cancelled", {
      completedSteps: completed,
      totalSteps: steps.length,
    });
    return;
  }

  /* ── Synthesise ───────────────────────────────────────────────────────── */

  store.update(orchestrationId, { status: "synthesizing", steps });
  yield* synthesise(orchestrationId, base, request, results, provider, signal);

  const completed = results.filter((r) => r.status === "completed").length;
  store.update(orchestrationId, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
  yield emit("orchestration.completed", {
    durationMs: Date.now() - startedAt,
    completed,
    failed: results.length - completed,
    total: steps.length,
  });
}

/**
 * Produce the final answer.
 *
 * Receives structured results only — never raw transcripts or the operational
 * event log — so the prompt stays bounded and Hermes reasons over summaries
 * rather than noise. Failed steps are included as failures, so Hermes can
 * report what is missing rather than filling the gap.
 */
async function* synthesise(
  orchestrationId: string,
  base: { orchestrationId: string; conversationId: string; missionId?: string },
  request: OrchestrationRequest,
  results: AgentResult[],
  provider: ModelProvider,
  signal: AbortSignal,
): AsyncIterable<OrchestratorEvent> {
  const cfg = getRuntimeConfig();
  const hermes = getAgentDefinition("hermes")!;
  const messageId = `msg-${orchestrationId}-synth`;

  yield {
    id: nextId("oev"),
    timestamp: new Date().toISOString(),
    ...base,
    type: "synthesis.started",
    payload: { resultCount: results.length },
  } as OrchestrationEvent;

  const digest = results.length
    ? results
        .map((r) => {
          const name = r.agentId.toUpperCase();
          if (r.status === "completed") {
            return `### ${name} — completed\n${r.summary}`;
          }
          return `### ${name} — ${r.status}\n${r.failureReason ?? "No result."}`;
        })
        .join("\n\n")
    : "";

  const system = digest
    ? `${hermes.systemPrompt}

You delegated work and the results are below. Answer the operator using them.

- Attribute each finding to the agent that produced it.
- Where an agent failed, say so and reason from what you do have.
- Do not invent findings that are not in these results.

DELEGATED RESULTS
${digest}`
    : `${hermes.systemPrompt}

You are answering the operator directly; no delegation was needed.`;

  const runtimeBase = {
    runId: orchestrationId,
    agentId: "hermes",
    conversationId: request.conversationId,
    missionId: request.missionId,
  };

  let text = "";
  let started = false;

  for await (const ev of provider.stream({
    system,
    messages: [
      ...(request.history ?? []),
      { role: "user", content: request.message },
    ],
    maxTokens: cfg.maxTokens,
    signal,
  })) {
    if (ev.kind === "text") {
      if (!started) {
        started = true;
        yield {
          id: nextId("evt"),
          timestamp: new Date().toISOString(),
          ...runtimeBase,
          type: "message.started",
          payload: { messageId },
          orchestrationId,
          stepId: "synthesis",
        } as OrchestratorEvent;
      }
      text += ev.text;
      yield {
        id: nextId("evt"),
        timestamp: new Date().toISOString(),
        ...runtimeBase,
        type: "message.delta",
        payload: { messageId, text: ev.text },
        orchestrationId,
        stepId: "synthesis",
      } as OrchestratorEvent;
    }
    if (ev.kind === "reasoning") {
      // Extended-thinking delta from the synthesis model. Surface as a
      // reasoning event tagged with the orchestration id so the UI can
      // show the planner's scratchpad while a delegated run is in flight.
      yield {
        id: nextId("evt"),
        timestamp: new Date().toISOString(),
        ...runtimeBase,
        type: "reasoning.delta",
        payload: { text: ev.text },
        orchestrationId,
        stepId: "synthesis",
      } as OrchestratorEvent;
    }
    if (ev.kind === "error") {
      yield {
        id: nextId("evt"),
        timestamp: new Date().toISOString(),
        ...runtimeBase,
        type: "agent.error",
        payload: { code: "provider-unavailable", message: ev.message },
        orchestrationId,
        stepId: "synthesis",
      } as OrchestratorEvent;
      return;
    }
  }

  if (started) {
    yield {
      id: nextId("evt"),
      timestamp: new Date().toISOString(),
      ...runtimeBase,
      type: "message.completed",
      payload: { messageId, text },
      orchestrationId,
      stepId: "synthesis",
    } as OrchestratorEvent;
  }

  yield {
    id: nextId("oev"),
    timestamp: new Date().toISOString(),
    ...base,
    type: "synthesis.completed",
    payload: { messageId },
  } as OrchestrationEvent;
}

/** Stop an orchestration and every delegation under it. */
export function cancelOrchestration(orchestrationId: string): boolean {
  return getOrchestrationStore().cancel(orchestrationId);
}
