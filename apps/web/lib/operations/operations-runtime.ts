import type { Mission, MissionTask, OperationEvent } from "../types";

/**
 * The seam between operational state and whatever produces it.
 *
 * Today a deterministic script (`MockOperationsRuntime`); later a live feed.
 * The provider consumes this interface only, so swapping in a WebSocket/SSE
 * source is a change here rather than across the UI.
 */

export interface OperationsSnapshot {
  missions: Mission[];
  tasks: MissionTask[];
  events: OperationEvent[];
}

export interface OperationsRuntime {
  readonly id: string;
  /** False while the data is simulated — drives the SIMULATION indicator. */
  readonly live: boolean;

  /** State at a point in the scenario. */
  snapshotAt(step: number): OperationsSnapshot;
  /** Total steps in the scenario; `snapshotAt(totalSteps)` is the end state. */
  readonly totalSteps: number;
  /** Step the scenario opens on, so the UI starts mid-operation. */
  readonly initialStep: number;
}
