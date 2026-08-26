import type { OrchestrationEvent } from "./events";
import type { AgentStatus, OperationEvent } from "../types";
import type { StepStatus } from "./types";

/**
 * Orchestration state as the operational UI needs it.
 *
 * A flattened projection of the event stream rather than a second copy of the
 * orchestrator's own state: the server owns the truth, this is what the
 * browser renders. Reducing events here keeps the provider free of
 * orchestration business logic.
 */

export interface LiveStep {
  stepId: string;
  agentId: string;
  task: string;
  status: StepStatus;
  runId?: string;
  conversationId?: string;
  summary?: string;
  failureReason?: string;
  durationMs?: number;
}

export interface LiveOrchestration {
  id: string;
  conversationId: string;
  missionId?: string;
  objective: string;
  status: "planning" | "running" | "synthesizing" | "completed" | "failed" | "cancelled";
  steps: LiveStep[];
  startedAt: string;
  completedAt?: string;
}

/** The overlay shape this reducer reads and writes. */
interface OverlayLike {
  orchestrations: Record<string, LiveOrchestration>;
  liveAgentStatus: Record<string, AgentStatus>;
  runtimeEvents: OperationEvent[];
}

/** Human-readable line for the operational event stream. */
function describe(event: OrchestrationEvent): {
  message: string;
  severity: OperationEvent["severity"];
  type: OperationEvent["type"];
  agentId: string | null;
} | null {
  switch (event.type) {
    case "orchestration.started":
      return {
        message: `Orchestration started — ${event.payload.objective}`,
        severity: "info",
        type: "system",
        agentId: "hermes",
      };
    case "plan.created": {
      const n = event.payload.plan.steps.length;
      return {
        message: n
          ? `Plan created — ${n} ${n === 1 ? "step" : "steps"}`
          : "Plan created — answering directly, no delegation needed",
        severity: "info",
        type: "system",
        agentId: "hermes",
      };
    }
    case "plan.rejected":
      return {
        message: `Plan rejected — ${event.payload.reason}`,
        severity: "warn",
        type: "system",
        agentId: "hermes",
      };
    case "delegation.created":
      return {
        message: `Delegated: ${event.payload.task}`,
        severity: "info",
        type: "delegation",
        agentId: "hermes",
      };
    case "step.started":
      return {
        message: "Delegation started",
        severity: "info",
        type: "task-started",
        agentId: event.payload.agentId,
      };
    case "step.completed":
      return {
        message: "Delegation completed",
        severity: "success",
        type: "task-completed",
        agentId: event.payload.agentId,
      };
    case "step.failed":
      return {
        message: `Delegation failed — ${event.payload.reason}`,
        severity: "error",
        type: "agent-error",
        agentId: event.payload.agentId,
      };
    case "step.cancelled":
      return {
        message: "Delegation cancelled",
        severity: "warn",
        type: "system",
        agentId: event.payload.agentId,
      };
    case "synthesis.started":
      return {
        message: `Synthesising ${event.payload.resultCount} ${event.payload.resultCount === 1 ? "result" : "results"}`,
        severity: "info",
        type: "system",
        agentId: "hermes",
      };
    case "orchestration.completed":
      return {
        message: `Orchestration completed — ${event.payload.completed}/${event.payload.total} succeeded`,
        severity: event.payload.failed > 0 ? "warn" : "success",
        type: "mission-completed",
        agentId: "hermes",
      };
    case "orchestration.failed":
      return {
        message: `Orchestration failed — ${event.payload.reason}`,
        severity: "error",
        type: "agent-error",
        agentId: "hermes",
      };
    case "orchestration.cancelled":
      return {
        message: `Orchestration cancelled — ${event.payload.completedSteps}/${event.payload.totalSteps} completed first`,
        severity: "warn",
        type: "system",
        agentId: "hermes",
      };
    default:
      return null;
  }
}

/**
 * Fold one orchestration event into the overlay.
 *
 * Pure: takes the previous overlay and returns the next, so it is trivially
 * testable and safe inside a React state updater.
 */
export function applyOrchestrationEvent<T extends OverlayLike>(
  prev: T,
  event: OrchestrationEvent,
): T {
  const id = event.orchestrationId;
  const existing = prev.orchestrations[id];
  const status = { ...prev.liveAgentStatus };

  let orchestration: LiveOrchestration =
    existing ??
    {
      id,
      conversationId: event.conversationId,
      missionId: event.missionId,
      objective: "",
      status: "planning",
      steps: [],
      startedAt: event.timestamp,
    };

  const patchStep = (stepId: string, patch: Partial<LiveStep>) => {
    orchestration = {
      ...orchestration,
      steps: orchestration.steps.map((s) =>
        s.stepId === stepId ? { ...s, ...patch } : s,
      ),
    };
  };

  switch (event.type) {
    case "orchestration.started":
      // Hermes is orchestrating, which is a working state, not idle.
      status.hermes = "working";
      orchestration = {
        ...orchestration,
        objective: event.payload.objective,
        status: "planning",
        startedAt: event.timestamp,
      };
      break;

    case "plan.created":
      orchestration = {
        ...orchestration,
        objective: event.payload.plan.objective,
        status: event.payload.plan.steps.length ? "running" : "synthesizing",
        steps: event.payload.plan.steps.map((s) => ({
          stepId: s.id,
          agentId: s.agentId,
          task: s.task,
          status: "queued" as StepStatus,
        })),
      };
      // Queued agents read as waiting until their step actually starts. The
      // orchestrator is skipped: a plan may include a synthesis step assigned
      // to Hermes, and Hermes is coordinating, not queued behind its own plan.
      for (const step of event.payload.plan.steps) {
        if (step.agentId === "hermes") continue;
        status[step.agentId] = "waiting";
      }
      break;

    case "plan.rejected":
      orchestration = { ...orchestration, status: "synthesizing" };
      break;

    case "delegation.created":
      patchStep(event.payload.stepId, {
        conversationId: event.payload.delegatedConversationId,
        status: "running",
      });
      status[event.payload.agentId] = "working";
      break;

    case "step.started":
      patchStep(event.payload.stepId, {
        status: "running",
        runId: event.payload.runId,
      });
      status[event.payload.agentId] = "working";
      break;

    case "step.completed":
      patchStep(event.payload.stepId, {
        status: "completed",
        summary: event.payload.result.summary,
        durationMs: event.payload.result.durationMs,
        runId: event.payload.result.runId,
      });
      // Release the override so the agent returns to its roster state.
      delete status[event.payload.agentId];
      break;

    case "step.failed":
      patchStep(event.payload.stepId, {
        status: "failed",
        failureReason: event.payload.reason,
      });
      status[event.payload.agentId] = "error";
      break;

    case "step.cancelled":
      patchStep(event.payload.stepId, { status: "cancelled" });
      delete status[event.payload.agentId];
      break;

    case "synthesis.started":
      orchestration = { ...orchestration, status: "synthesizing" };
      status.hermes = "thinking";
      break;

    case "orchestration.completed":
      orchestration = {
        ...orchestration,
        status: "completed",
        completedAt: event.timestamp,
      };
      delete status.hermes;
      break;

    case "orchestration.failed":
      orchestration = { ...orchestration, status: "failed", completedAt: event.timestamp };
      status.hermes = "error";
      break;

    case "orchestration.cancelled":
      orchestration = {
        ...orchestration,
        status: "cancelled",
        completedAt: event.timestamp,
      };
      delete status.hermes;
      break;

    default:
      break;
  }

  const described = describe(event);
  const runtimeEvents = described
    ? [
        {
          id: event.id,
          timestamp: event.timestamp,
          type: described.type,
          severity: described.severity,
          agentId: described.agentId,
          missionId: event.missionId,
          message: described.message,
        } as OperationEvent,
        ...prev.runtimeEvents,
      ].slice(0, 200)
    : prev.runtimeEvents;

  return {
    ...prev,
    orchestrations: { ...prev.orchestrations, [id]: orchestration },
    liveAgentStatus: status,
    runtimeEvents,
  };
}
