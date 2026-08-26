import type { RunStatus } from "./events";

/**
 * Run registry.
 *
 * A run is one execution attempt. Deliberately not a singleton "current run":
 * Apex and Nova must be able to execute simultaneously without one blocking or
 * cancelling the other, and the orchestrator phase will add runs spawned by
 * agents rather than by the operator.
 *
 * Server-side and in-memory. Runs are transient by design — a process restart
 * loses them, which is correct, because a run cannot outlive the stream that
 * carries it.
 */

export interface RunRecord {
  runId: string;
  agentId: string;
  conversationId: string;
  missionId?: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  /** Cancels the in-flight provider call. */
  controller: AbortController;
  /** Retry attempt number for the same user turn, starting at 1. */
  attempt: number;
}

/** Only these transitions are legal; anything else is a bug. */
const ALLOWED: Record<RunStatus, RunStatus[]> = {
  queued: ["running", "cancelled", "failed"],
  running: ["waiting-tool", "completed", "failed", "cancelled"],
  "waiting-tool": ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const runs = new Map<string, RunRecord>();

let counter = 0;

function nextRunId(): string {
  counter += 1;
  return `run-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function createRun(input: {
  agentId: string;
  conversationId: string;
  missionId?: string;
  attempt?: number;
}): RunRecord {
  const record: RunRecord = {
    runId: nextRunId(),
    agentId: input.agentId,
    conversationId: input.conversationId,
    missionId: input.missionId,
    status: "queued",
    startedAt: new Date().toISOString(),
    controller: new AbortController(),
    attempt: input.attempt ?? 1,
  };
  runs.set(record.runId, record);
  return record;
}

export function getRun(runId: string): RunRecord | undefined {
  return runs.get(runId);
}

/**
 * Advance a run's status.
 *
 * Rejects illegal transitions rather than applying them, so a completed run
 * cannot be reopened and a cancelled one cannot report success.
 */
export function transitionRun(runId: string, next: RunStatus): boolean {
  const run = runs.get(runId);
  if (!run) return false;
  if (!ALLOWED[run.status].includes(next)) {
    console.warn("[runtime:run] illegal transition", {
      runId,
      from: run.status,
      to: next,
    });
    return false;
  }
  run.status = next;
  if (["completed", "failed", "cancelled"].includes(next)) {
    run.completedAt = new Date().toISOString();
    // Free the record shortly after it terminates; the stream has ended and
    // nothing can reference it again.
    setTimeout(() => runs.delete(runId), 60_000).unref?.();
  }
  return true;
}

export function cancelRun(runId: string): boolean {
  const run = runs.get(runId);
  if (!run) return false;
  if (["completed", "failed", "cancelled"].includes(run.status)) return false;
  run.controller.abort();
  transitionRun(runId, "cancelled");
  return true;
}

/** Runs that have not reached a terminal state. */
export function activeRuns(): RunRecord[] {
  return [...runs.values()].filter((r) =>
    ["queued", "running", "waiting-tool"].includes(r.status),
  );
}

export function activeRunsForAgent(agentId: string): RunRecord[] {
  return activeRuns().filter((r) => r.agentId === agentId);
}
