import type { Mission } from "../types";

/**
 * Mock mission board.
 *
 * A mission is a larger objective that may involve several agents; agent ids
 * here match `lib/mock/agents`, and `lib/mock/activity` references the same
 * mission ids so the three feeds tell one consistent story.
 */
export const MOCK_MISSIONS: Mission[] = [
  {
    id: "m-1042",
    code: "OPS-1042",
    title: "Authentication Investigation",
    description:
      "Trace and resolve the elevated login failure rate on the gateway.",
    status: "active",
    priority: "critical",
    assignedAgentIds: ["apex", "nova", "sentinel"],
    leadAgentId: "apex",
    supportingAgentIds: ["nova", "sentinel"],
    progress: 78,
    phase: "REGRESSION TESTING",
    startedAt: "2026-08-26T14:48:00.000Z",
    lastActivityAt: "2026-08-26T15:31:08.000Z",
  },
  {
    id: "m-1039",
    code: "QA-1039",
    title: "Portal Regression Sweep",
    description:
      "Full regression pass across the operator portal before release 4.2.",
    status: "waiting",
    priority: "high",
    assignedAgentIds: ["atlas", "apex"],
    leadAgentId: "atlas",
    supportingAgentIds: ["apex"],
    progress: 43,
    phase: "AWAITING FIXTURES",
    startedAt: "2026-08-26T11:40:00.000Z",
    lastActivityAt: "2026-08-26T15:29:51.000Z",
  },
  {
    id: "m-1037",
    code: "SEC-1037",
    title: "Edge Credential Rotation",
    description:
      "Rotate service credentials across all edge nodes ahead of expiry.",
    status: "blocked",
    priority: "normal",
    assignedAgentIds: ["cipher", "sentinel"],
    leadAgentId: "cipher",
    supportingAgentIds: ["sentinel"],
    progress: 12,
    phase: "VAULT LEASE RENEWAL",
    startedAt: "2026-08-26T10:05:00.000Z",
    lastActivityAt: "2026-08-26T15:30:40.000Z",
  },
  {
    id: "m-1033",
    code: "ANA-1033",
    title: "Weekly Throughput Report",
    description: "Aggregate agent throughput and publish the weekly snapshot.",
    status: "completed",
    priority: "low",
    assignedAgentIds: ["orion"],
    leadAgentId: "orion",
    supportingAgentIds: [],
    progress: 100,
    phase: "DELIVERED",
    startedAt: "2026-08-26T08:00:00.000Z",
    lastActivityAt: "2026-08-26T15:27:02.000Z",
    completedAt: "2026-08-26T09:21:00.000Z",
  },
];

export function getMockMissions(): Mission[] {
  return MOCK_MISSIONS;
}

export function findMockMission(id: string): Mission | undefined {
  return MOCK_MISSIONS.find((m) => m.id === id);
}

/** Missions still in flight — the set the Command Center leads with. */
export function getActiveMissions(): Mission[] {
  return MOCK_MISSIONS.filter(
    (m) => m.status !== "completed" && m.status !== "failed",
  );
}
