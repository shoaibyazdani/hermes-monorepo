import type { AttentionItem, Objective, SystemCounters } from "../types";

/**
 * Operator-facing requests awaiting sign-off.
 *
 * These drive the Attention Required surface. The real approval pipeline
 * (accept/reject reaching an agent runtime) lands with the Approvals route in
 * a later phase; dismissing one here is local UI state only.
 */
export const MOCK_ATTENTION_ITEMS: AttentionItem[] = [
  {
    id: "att-01",
    agentId: "apex",
    severity: "critical",
    title: "APEX is requesting permission",
    action: "Deploy authentication fix to staging",
    detail:
      "Patch touches the session refresh path. 48 regression specs currently running.",
    missionId: "m-1042",
    raisedAt: "2026-08-26T15:24:19.000Z",
  },
  {
    id: "att-02",
    agentId: "atlas",
    severity: "warn",
    title: "ATLAS is requesting permission",
    action: "Run destructive test suite against the staging portal",
    detail: "Suite drops and reseeds the fixtures database.",
    missionId: "m-1039",
    raisedAt: "2026-08-26T15:19:48.000Z",
  },
  {
    id: "att-03",
    agentId: "cipher",
    severity: "warn",
    title: "CIPHER is blocked",
    action: "Renew the expired vault lease to resume credential rotation",
    detail: "Rotation halted at 12%. 42 edge nodes still on old credentials.",
    missionId: "m-1037",
    raisedAt: "2026-08-26T15:30:40.000Z",
  },
];

/**
 * What Hermes itself is coordinating right now.
 *
 * Distinct from any single mission: this is the orchestrator's own focus.
 */
export const MOCK_OBJECTIVE: Objective = {
  id: "obj-01",
  title: "Coordinate authentication investigation",
  status: "active",
  leadAgentId: "apex",
  supportAgentIds: ["atlas", "nova"],
  missionId: "m-1042",
  startedAt: "2026-08-26T14:48:00.000Z",
};

/** Glanceable activity counters for the whole system. */
export const MOCK_COUNTERS: SystemCounters = {
  eventsToday: 184,
  missions: 7,
  completed: 23,
  errors: 2,
};

export function getMockAttentionItems(): AttentionItem[] {
  return MOCK_ATTENTION_ITEMS;
}

export function getMockObjective(): Objective {
  return MOCK_OBJECTIVE;
}

export function getMockCounters(): SystemCounters {
  return MOCK_COUNTERS;
}
