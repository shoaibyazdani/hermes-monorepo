import { applyOrchestrationEvent, type LiveOrchestration } from "./live-view";
import {
  SIM_CONVERSATION_IDS,
  SIM_OBJECTIVE,
  SIM_ORCHESTRATION_ID,
  SIM_SYNTHESIS_TEXT,
  SIM_SYNTHESIS_STEP,
  SIM_TOTAL_STEPS,
  simulationEventsUpTo,
  simulationMissionAt,
} from "./simulation";
import type {
  AgentStatus,
  ChatDelegation,
  ChatMessage,
  Mission,
  MissionTask,
  OperationEvent,
} from "../types";

/**
 * Projection of the simulated orchestration, for the operational UI.
 *
 * The whole point of this module is that it does not reimplement anything:
 * it replays the scripted events through `applyOrchestrationEvent`, the same
 * reducer the live stream uses. Whatever the live path would render from a
 * given event sequence, the simulation renders identically — the only
 * difference is where the events came from.
 */

export interface SimulationSnapshot {
  orchestration: LiveOrchestration | null;
  /** Agent id → status override, exactly as the live overlay carries it. */
  liveAgentStatus: Record<string, AgentStatus>;
  /** Operational event lines derived from the orchestration events. */
  events: OperationEvent[];
  mission: Mission;
  tasks: MissionTask[];
  /** True once the synthesis reply should be visible in the conversation. */
  synthesisVisible: boolean;
}

/** Shape `applyOrchestrationEvent` folds over. */
interface Overlay {
  orchestrations: Record<string, LiveOrchestration>;
  liveAgentStatus: Record<string, AgentStatus>;
  runtimeEvents: OperationEvent[];
}

const EMPTY: Overlay = {
  orchestrations: {},
  liveAgentStatus: {},
  runtimeEvents: [],
};

/**
 * State after `step` beats.
 *
 * Pure function of `step`: it always folds from the beginning rather than
 * advancing accumulated state, so `snapshotAt(4)` is identical whether it is
 * reached by playing forward or by seeking back from 8.
 */
export function simulationSnapshotAt(step: number): SimulationSnapshot {
  const clamped = Math.max(0, Math.min(step, SIM_TOTAL_STEPS));

  let overlay: Overlay = EMPTY;
  for (const event of simulationEventsUpTo(clamped)) {
    overlay = applyOrchestrationEvent(overlay, event);
  }

  const { mission, tasks } = simulationMissionAt(clamped);

  return {
    orchestration: overlay.orchestrations[SIM_ORCHESTRATION_ID] ?? null,
    liveAgentStatus: overlay.liveAgentStatus,
    events: overlay.runtimeEvents,
    mission,
    tasks,
    synthesisVisible: clamped >= SIM_SYNTHESIS_STEP,
  };
}

/**
 * Cancel a simulated orchestration at `step`.
 *
 * Reuses the same event the live orchestrator emits, so the resulting state is
 * produced by the ordinary reducer: completed work is preserved, running steps
 * become cancelled, and nothing is discarded.
 */
export function simulationCancelledAt(step: number): SimulationSnapshot {
  const base = simulationSnapshotAt(step);
  if (!base.orchestration) return base;

  const steps = base.orchestration.steps;
  const completed = steps.filter((s) => s.status === "completed").length;

  let overlay: Overlay = {
    orchestrations: { [SIM_ORCHESTRATION_ID]: base.orchestration },
    liveAgentStatus: base.liveAgentStatus,
    runtimeEvents: base.events,
  };

  // Anything still in flight is cancelled explicitly, so no step is left
  // claiming to be running after the orchestration has stopped.
  for (const s of steps) {
    if (s.status === "running" || s.status === "queued") {
      overlay = applyOrchestrationEvent(overlay, {
        id: `sim-cancel-${s.stepId}`,
        timestamp: base.orchestration.startedAt,
        orchestrationId: SIM_ORCHESTRATION_ID,
        conversationId: base.orchestration.conversationId,
        missionId: base.orchestration.missionId,
        type: "step.cancelled",
        payload: { stepId: s.stepId, agentId: s.agentId },
      });
    }
  }

  overlay = applyOrchestrationEvent(overlay, {
    id: "sim-cancel-orchestration",
    timestamp: base.orchestration.startedAt,
    orchestrationId: SIM_ORCHESTRATION_ID,
    conversationId: base.orchestration.conversationId,
    missionId: base.orchestration.missionId,
    type: "orchestration.cancelled",
    payload: { completedSteps: completed, totalSteps: steps.length },
  });

  const cancelledTasks = base.tasks.map((t) =>
    t.status === "active" || t.status === "pending"
      ? { ...t, status: "cancelled" as const, currentStep: undefined }
      : t,
  );

  return {
    orchestration: overlay.orchestrations[SIM_ORCHESTRATION_ID] ?? null,
    liveAgentStatus: overlay.liveAgentStatus,
    events: overlay.runtimeEvents,
    mission: { ...base.mission, status: "cancelled", phase: "CANCELLED" },
    tasks: cancelledTasks,
    synthesisVisible: base.synthesisVisible,
  };
}

/* ── Conversation projection ─────────────────────────────────────────────── */

/**
 * The Hermes transcript for the simulated orchestration at `step`.
 *
 * Derived from the same folded state rather than authored separately: the
 * delegation cards are the projected steps, and the synthesised answer appears
 * only once `synthesis.completed` has been emitted. A component therefore
 * never invents a reply — it renders what the simulation produced.
 */
export function simulationTranscriptAt(step: number): ChatMessage[] {
  const snap = simulationSnapshotAt(step);
  if (!snap.orchestration) return [];

  const { orchestration } = snap;
  const messages: ChatMessage[] = [
    {
      id: "sim-msg-operator",
      conversationId: SIM_CONVERSATION_IDS.hermes,
      agentId: "hermes",
      role: "operator",
      body: SIM_OBJECTIVE,
      createdAt: orchestration.startedAt,
      status: "complete",
      simulated: true,
    },
  ];

  const delegations: ChatDelegation[] = orchestration.steps
    // The synthesis step is Hermes's own work, not a delegation.
    .filter((s) => s.agentId !== "hermes")
    .map((s) => ({
      stepId: s.stepId,
      agentId: s.agentId,
      task: s.task,
      status:
        s.status === "running" || s.status === "queued"
          ? s.status
          : s.status === "completed"
            ? "completed"
            : s.status === "cancelled"
              ? "cancelled"
              : "failed",
      conversationId: s.conversationId,
      summary: s.summary,
      failureReason: s.failureReason,
      durationMs: s.durationMs,
    }));

  const cancelled = orchestration.status === "cancelled";
  const answered = snap.synthesisVisible && !cancelled;

  messages.push({
    id: "sim-msg-synthesis",
    conversationId: SIM_CONVERSATION_IDS.hermes,
    agentId: "hermes",
    role: "agent",
    // Empty until synthesis completes: the delegation cards are visible while
    // the work runs, but no conclusion is shown before there is one.
    body: answered ? SIM_SYNTHESIS_TEXT : "",
    createdAt: orchestration.completedAt ?? orchestration.startedAt,
    status: answered ? "complete" : cancelled ? "cancelled" : "streaming",
    orchestrationId: orchestration.id,
    delegations,
    simulated: true,
  });

  return messages;
}
