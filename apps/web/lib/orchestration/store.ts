import type { AgentResult, Orchestration, StepStatus } from "./types";

/**
 * Orchestration state.
 *
 * Defined as an interface first so a persistent implementation can replace the
 * in-memory one without touching the orchestrator. Business logic lives in the
 * orchestrator; this only stores and retrieves.
 */
export interface OrchestrationStore {
  create(orchestration: Orchestration): Orchestration;
  get(id: string): Orchestration | undefined;
  update(id: string, patch: Partial<Orchestration>): Orchestration | undefined;
  updateStep(
    id: string,
    stepId: string,
    patch: Partial<Orchestration["steps"][number]>,
  ): void;
  setStepResult(id: string, stepId: string, result: AgentResult): void;
  /** Orchestrations that have not reached a terminal state. */
  active(): Orchestration[];
  /** Cancellation signal for the whole orchestration. */
  abortSignal(id: string): AbortSignal | undefined;
  cancel(id: string): boolean;
}

/**
 * In-memory implementation.
 *
 * Server-side and transient by design: an orchestration cannot outlive the
 * stream carrying it, so persisting one would leave records describing work
 * that is no longer running.
 */
class MemoryOrchestrationStore implements OrchestrationStore {
  private readonly records = new Map<string, Orchestration>();
  private readonly controllers = new Map<string, AbortController>();

  create(orchestration: Orchestration): Orchestration {
    this.records.set(orchestration.id, orchestration);
    this.controllers.set(orchestration.id, new AbortController());
    return orchestration;
  }

  get(id: string): Orchestration | undefined {
    return this.records.get(id);
  }

  update(id: string, patch: Partial<Orchestration>): Orchestration | undefined {
    const current = this.records.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    this.records.set(id, next);

    if (["completed", "failed", "cancelled"].includes(next.status)) {
      // Release shortly after termination; the stream has ended and nothing
      // can reference the record again.
      setTimeout(() => {
        this.records.delete(id);
        this.controllers.delete(id);
      }, 120_000).unref?.();
    }
    return next;
  }

  updateStep(
    id: string,
    stepId: string,
    patch: Partial<Orchestration["steps"][number]>,
  ): void {
    const current = this.records.get(id);
    if (!current) return;
    this.records.set(id, {
      ...current,
      steps: current.steps.map((s) =>
        s.id === stepId ? { ...s, ...patch } : s,
      ),
    });
  }

  setStepResult(id: string, stepId: string, result: AgentResult): void {
    const status: StepStatus =
      result.status === "completed"
        ? "completed"
        : result.status === "timed-out"
          ? "timed-out"
          : result.status === "cancelled"
            ? "cancelled"
            : "failed";
    this.updateStep(id, stepId, { result, status, completedAt: new Date().toISOString() });
  }

  active(): Orchestration[] {
    return [...this.records.values()].filter((o) =>
      ["planning", "running", "synthesizing"].includes(o.status),
    );
  }

  abortSignal(id: string): AbortSignal | undefined {
    return this.controllers.get(id)?.signal;
  }

  cancel(id: string): boolean {
    const controller = this.controllers.get(id);
    const record = this.records.get(id);
    if (!controller || !record) return false;
    if (["completed", "failed", "cancelled"].includes(record.status)) {
      return false;
    }
    // Aborting stops the scheduler and every in-flight delegated run. Results
    // already collected stay on their steps.
    controller.abort();
    return true;
  }
}

const store: OrchestrationStore = new MemoryOrchestrationStore();

/** One import site, so swapping in a persistent store is a single edit. */
export function getOrchestrationStore(): OrchestrationStore {
  return store;
}
