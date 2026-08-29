import { getRuntimeConfig } from "./config";
import { getAgentDefinition, isKnownAgent } from "./agents/definitions";
import { createMiniMaxProvider } from "./providers/minimax";
import { createCortexProvider } from "./providers/cortex";
import type {
  ContentBlock,
  ModelEvent,
  ModelMessage,
  ModelProvider,
} from "./providers/types";
import { getTool, isToolAuthorized, toolsForAgent } from "./tools/registry";
import {
  createRun,
  transitionRun,
  type RunRecord,
} from "./run-manager";
import type { RuntimeErrorCode, RuntimeEvent } from "./events";

/**
 * The agent runtime.
 *
 * Composes the pieces — agent identity, conversation context, provider, tool
 * registry — into one async event stream. It owns no state beyond the run
 * record: conversations belong to the client store, operational state to
 * `OperationsProvider`. This layer only produces events describing what
 * happened.
 *
 * SERVER ONLY.
 */

export interface AgentRequest {
  agentId: string;
  conversationId: string;
  /**
   * The user's current turn — text only OR multimodal (text + image blocks).
   * Set by `parseRequest` in `/api/runtime/execute/route.ts` based on whether
   * `attachments` were supplied. The runtime prepends this turn to the
   * conversation history.
   */
  message: string | ContentBlock[];
  missionId?: string;
  /** Prior turns, oldest first. Assembled by the caller and already trimmed. */
  history?: ModelMessage[];
  /** Concise mission context, when the conversation belongs to one. */
  missionContext?: string;
  /** Retry attempt for the same user turn. */
  attempt?: number;
  /**
   * External cancellation, used by the orchestrator so stopping an
   * orchestration aborts every delegated run beneath it.
   */
  signal?: AbortSignal;
}

/** Maximum tool round-trips before giving up, to bound a looping model. */
const MAX_TOOL_ROUNDS = 4;

let seq = 0;
function eventId(): string {
  seq += 1;
  return `evt-${Date.now().toString(36)}-${seq.toString(36)}`;
}

function makeEmitter(run: RunRecord) {
  return function emit<T extends RuntimeEvent["type"]>(
    type: T,
    payload: Extract<RuntimeEvent, { type: T }>["payload"],
  ): RuntimeEvent {
    return {
      id: eventId(),
      timestamp: new Date().toISOString(),
      runId: run.runId,
      agentId: run.agentId,
      conversationId: run.conversationId,
      missionId: run.missionId,
      type,
      payload,
    } as RuntimeEvent;
  };
}

/** Build the provider named by config. Returns null in simulation mode. */
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

const MODEL_TO_RUNTIME_ERROR: Record<string, RuntimeErrorCode> = {
  unavailable: "provider-unavailable",
  auth: "provider-auth",
  "rate-limit": "provider-rate-limit",
  timeout: "provider-timeout",
  malformed: "provider-malformed",
  cancelled: "cancelled",
};

/**
 * Execute one agent turn, yielding runtime events as they occur.
 *
 * The caller streams these to the browser. Nothing is buffered here beyond the
 * accumulating assistant text, which is needed to emit a final
 * `message.completed`.
 */
export async function* executeAgent(
  request: AgentRequest,
): AsyncIterable<RuntimeEvent> {
  const startedAt = Date.now();

  // Validate the agent id before anything else: it arrives from the browser.
  if (!isKnownAgent(request.agentId)) {
    const run = createRun({
      agentId: "unknown",
      conversationId: request.conversationId,
    });
    const emit = makeEmitter(run);
    transitionRun(run.runId, "failed");
    yield emit("agent.error", {
      code: "internal",
      message: "Unknown agent.",
    });
    yield emit("run.completed", { status: "failed", durationMs: 0 });
    return;
  }

  const definition = getAgentDefinition(request.agentId)!;
  const cfg = getRuntimeConfig();
  const provider = resolveProvider();

  const run = createRun({
    agentId: request.agentId,
    conversationId: request.conversationId,
    missionId: request.missionId,
    attempt: request.attempt,
  });
  const emit = makeEmitter(run);

  // An external signal (an orchestration being cancelled) aborts this run too.
  if (request.signal) {
    if (request.signal.aborted) run.controller.abort();
    else request.signal.addEventListener("abort", () => run.controller.abort(), { once: true });
  }

  yield emit("run.started", {
    provider: cfg.provider,
    model: cfg.live ? cfg.model : "simulation",
  });

  // No provider configured: report it plainly rather than inventing a reply.
  if (!provider) {
    transitionRun(run.runId, "running");
    transitionRun(run.runId, "failed");
    yield emit("agent.error", {
      code: "provider-unavailable",
      message:
        "No model provider is configured. Set AI_API_KEY or CORTEX_BASE_URL to enable live agents.",
    });
    yield emit("run.completed", {
      status: "failed",
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  transitionRun(run.runId, "running");

  // Context: agent identity + optional mission brief + prior turns + this turn.
  // Deliberately narrow — no other agent's conversation, no operational event
  // log, no application state.
  const system = request.missionContext
    ? `${definition.systemPrompt}\n\nMISSION CONTEXT\n${request.missionContext}`
    : definition.systemPrompt;

  const messages: ModelMessage[] = [
    ...(request.history ?? []),
    { role: "user", content: request.message },
  ];

  const tools = toolsForAgent(request.agentId);

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      yield emit("agent.thinking", {});

      const messageId = `msg-${run.runId}-${round}`;
      let started = false;
      let text = "";
      const pendingCalls: Array<{
        toolCallId: string;
        toolId: string;
        input: unknown;
      }> = [];
      let errored = false;

      for await (const ev of provider.stream({
        system,
        messages,
        tools: tools.length ? tools : undefined,
        maxTokens: cfg.maxTokens,
        signal: run.controller.signal,
      })) {
        if (run.controller.signal.aborted) break;

        if (ev.kind === "text") {
          // The first fragment opens the message; every fragment is then a
          // delta, so the client can append uniformly without special-casing.
          if (!started) {
            started = true;
            yield emit("message.started", { messageId });
          }
          text += ev.text;
          yield emit("message.delta", { messageId, text: ev.text });
          continue;
        }

        if (ev.kind === "reasoning") {
          // Anthropic extended-thinking delta. Surface as a separate
          // reasoning event so the UI can show it as a scratchpad or hide
          // it. We don't merge reasoning into the visible message.
          yield emit("reasoning.delta", { text: ev.text });
          continue;
        }

        if (ev.kind === "tool-call") {
          pendingCalls.push(ev);
          continue;
        }

        if (ev.kind === "error") {
          yield emit("agent.error", {
            code: MODEL_TO_RUNTIME_ERROR[ev.code] ?? "internal",
            message: ev.message,
          });
          errored = true;
          break;
        }
      }

      if (run.controller.signal.aborted) {
        transitionRun(run.runId, "cancelled");
        yield emit("run.completed", {
          status: "cancelled",
          durationMs: Date.now() - startedAt,
        });
        return;
      }

      if (errored) {
        transitionRun(run.runId, "failed");
        yield emit("run.completed", {
          status: "failed",
          durationMs: Date.now() - startedAt,
        });
        return;
      }

      if (started) {
        yield emit("message.completed", { messageId, text });
      }

      // No tools requested: the turn is done.
      if (pendingCalls.length === 0) {
        transitionRun(run.runId, "completed");
        yield emit("agent.completed", {});
        yield emit("run.completed", {
          status: "completed",
          durationMs: Date.now() - startedAt,
        });
        return;
      }

      // Execute the requested tools, then loop with their results in context.
      transitionRun(run.runId, "waiting-tool");
      const results: string[] = [];

      for (const call of pendingCalls) {
        yield emit("tool.started", {
          toolCallId: call.toolCallId,
          toolId: call.toolId,
          toolName: getTool(call.toolId)?.name ?? call.toolId,
        });
        yield emit("tool.input", {
          toolCallId: call.toolCallId,
          toolId: call.toolId,
          input: call.input,
        });

        // Two gates, both required: the tool must exist in the registry AND
        // this agent must be authorised for it. A tool id from the model is
        // never used to reach anything not registered.
        if (!isToolAuthorized(request.agentId, call.toolId)) {
          console.warn("[runtime] unauthorized tool call", {
            runId: run.runId,
            agentId: request.agentId,
            toolId: call.toolId,
          });
          yield emit("tool.completed", {
            toolCallId: call.toolCallId,
            toolId: call.toolId,
            ok: false,
            durationMs: 0,
            summary: "Not authorized",
          });
          results.push(
            `Tool "${call.toolId}" is not available to you. Do not claim to have used it.`,
          );
          continue;
        }

        const tool = getTool(call.toolId)!;
        const toolStart = Date.now();
        let result;
        try {
          result = await tool.execute(call.input);
        } catch (err) {
          console.error("[runtime] tool threw", {
            runId: run.runId,
            toolId: call.toolId,
            error: err instanceof Error ? err.message : "unknown",
          });
          result = {
            ok: false,
            output: { error: "The tool failed to execute." },
            summary: "Tool failed",
          };
        }
        const durationMs = Date.now() - toolStart;

        yield emit("tool.output", {
          toolCallId: call.toolCallId,
          toolId: call.toolId,
          output: result.output,
        });
        yield emit("tool.completed", {
          toolCallId: call.toolCallId,
          toolId: call.toolId,
          ok: result.ok,
          durationMs,
          summary: result.summary,
        });

        results.push(
          `Result of ${tool.name}: ${JSON.stringify(result.output)}`,
        );
      }

      // Feed results back as context for the next round.
      if (text) messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `[TOOL RESULTS]\n${results.join("\n")}`,
      });
      transitionRun(run.runId, "running");
    }

    // Tool rounds exhausted without a final answer.
    transitionRun(run.runId, "failed");
    yield emit("agent.error", {
      code: "internal",
      message: "The agent did not reach a conclusion.",
    });
    yield emit("run.completed", {
      status: "failed",
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[runtime] execution failed", {
      runId: run.runId,
      agentId: run.agentId,
      error: err instanceof Error ? err.message : "unknown",
    });
    transitionRun(run.runId, "failed");
    yield emit("agent.error", {
      code: "internal",
      message: "The agent run failed unexpectedly.",
    });
    yield emit("run.completed", {
      status: "failed",
      durationMs: Date.now() - startedAt,
    });
  }
}
