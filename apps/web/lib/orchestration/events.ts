import type { AgentResult, OrchestrationPlan, StepStatus } from "./types";

/**
 * Orchestration event protocol.
 *
 * A sibling of the runtime event union rather than a replacement: both travel
 * the same NDJSON stream, and the client distinguishes them by `type`. Existing
 * direct-run parsing is untouched, so a client that knows nothing about
 * orchestration still handles a direct run correctly.
 *
 * Correlation is explicit at every level — `orchestrationId` → `stepId` →
 * `runId` → `agentId` — so Operations can reconstruct the hierarchy without
 * inferring it.
 */

export type OrchestrationEventType =
  | "orchestration.started"
  | "plan.created"
  | "plan.rejected"
  | "step.queued"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "step.cancelled"
  | "delegation.created"
  | "delegation.started"
  | "delegation.completed"
  | "delegation.failed"
  | "synthesis.started"
  | "synthesis.completed"
  | "orchestration.completed"
  | "orchestration.failed"
  | "orchestration.cancelled";

interface OrchestrationEventBase {
  id: string;
  timestamp: string;
  orchestrationId: string;
  conversationId: string;
  missionId?: string;
}

export type OrchestrationEvent =
  | (OrchestrationEventBase & {
      type: "orchestration.started";
      payload: { objective: string; depth: number };
    })
  | (OrchestrationEventBase & {
      type: "plan.created";
      payload: { plan: OrchestrationPlan };
    })
  | (OrchestrationEventBase & {
      type: "plan.rejected";
      /** Why the plan was refused. Hermes then answers directly. */
      payload: { reason: string };
    })
  | (OrchestrationEventBase & {
      type: "step.queued";
      payload: { stepId: string; agentId: string; task: string };
    })
  | (OrchestrationEventBase & {
      type: "step.started";
      payload: { stepId: string; agentId: string; runId: string };
    })
  | (OrchestrationEventBase & {
      type: "step.completed";
      payload: { stepId: string; agentId: string; result: AgentResult };
    })
  | (OrchestrationEventBase & {
      type: "step.failed";
      payload: { stepId: string; agentId: string; reason: string };
    })
  | (OrchestrationEventBase & {
      type: "step.cancelled";
      payload: { stepId: string; agentId: string };
    })
  | (OrchestrationEventBase & {
      type: "delegation.created";
      /** The agent's own conversation, so the UI can link to it. */
      payload: {
        stepId: string;
        agentId: string;
        delegatedConversationId: string;
        task: string;
      };
    })
  | (OrchestrationEventBase & {
      type: "delegation.started";
      payload: { stepId: string; agentId: string; runId: string };
    })
  | (OrchestrationEventBase & {
      type: "delegation.completed";
      payload: { stepId: string; agentId: string; runId: string; durationMs: number };
    })
  | (OrchestrationEventBase & {
      type: "delegation.failed";
      payload: { stepId: string; agentId: string; reason: string };
    })
  | (OrchestrationEventBase & {
      type: "synthesis.started";
      payload: { resultCount: number };
    })
  | (OrchestrationEventBase & {
      type: "synthesis.completed";
      payload: { messageId: string };
    })
  | (OrchestrationEventBase & {
      type: "orchestration.completed";
      payload: {
        durationMs: number;
        completed: number;
        failed: number;
        total: number;
      };
    })
  | (OrchestrationEventBase & {
      type: "orchestration.failed";
      payload: { reason: string };
    })
  | (OrchestrationEventBase & {
      type: "orchestration.cancelled";
      /** Completed work is reported, not discarded. */
      payload: { completedSteps: number; totalSteps: number };
    });

/** True for orchestration events, so a client can branch on the union. */
export function isOrchestrationEvent(
  event: { type: string },
): event is OrchestrationEvent {
  return (
    event.type.startsWith("orchestration.") ||
    event.type.startsWith("plan.") ||
    event.type.startsWith("step.") ||
    event.type.startsWith("delegation.") ||
    event.type.startsWith("synthesis.")
  );
}

/** Step status implied by an event, for consumers tracking step state. */
export const EVENT_TO_STEP_STATUS: Partial<
  Record<OrchestrationEventType, StepStatus>
> = {
  "step.queued": "queued",
  "step.started": "running",
  "step.completed": "completed",
  "step.failed": "failed",
  "step.cancelled": "cancelled",
};
