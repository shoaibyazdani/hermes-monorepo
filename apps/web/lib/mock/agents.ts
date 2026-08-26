import type { Agent } from "../types";

/**
 * Mock agent roster.
 *
 * Deterministic on purpose — server and client must render identical markup,
 * so no `Date.now()` or randomness here. Live drift is applied client-side by
 * `useSystemTelemetry` and `useElapsed`.
 *
 * The roster tells one coherent story: an authentication regression is under
 * investigation, APEX is fixing it, NOVA is researching prior art, ATLAS is
 * blocked waiting on APEX, SENTINEL is auditing permissions, ORION is free.
 * Cross-references (`missionId`) line up with `lib/mock/missions`.
 */
export const MOCK_AGENTS: Agent[] = [
  {
    id: "hermes",
    name: "HERMES",
    role: "ORCHESTRATOR",
    discipline: "core",
    status: "listening",
    activity: "Coordinating authentication investigation",
    currentTask: "Route and supervise the investigation",
    currentStep: "Monitoring agent channels",
    sessionOpen: true,
    lastSeen: "2026-08-26T15:32:04.000Z",
    startedAt: "2026-08-26T14:48:00.000Z",
    x: 200,
    y: 200,
  },
  {
    id: "apex",
    name: "APEX",
    role: "ENGINEERING",
    discipline: "engineering",
    status: "working",
    activity: "Fixing authentication regression tests",
    currentTask: "Run authentication regression suite",
    currentStep: "Comparing session handling between environments",
    sessionOpen: true,
    progress: 82,
    missionId: "m-1042",
    lastSeen: "2026-08-26T15:32:07.000Z",
    startedAt: "2026-08-26T15:29:53.000Z",
    x: 200,
    y: 72,
  },
  {
    id: "nova",
    name: "NOVA",
    role: "RESEARCH",
    discipline: "research",
    status: "thinking",
    activity: "Comparing Playwright authentication patterns",
    currentTask: "Review prior art on Playwright auth",
    currentStep: "Reviewing 4 candidate sources",
    sessionOpen: true,
    progress: 61,
    missionId: "m-1042",
    lastSeen: "2026-08-26T15:32:06.000Z",
    startedAt: "2026-08-26T15:26:41.000Z",
    x: 322,
    y: 142,
  },
  {
    id: "atlas",
    name: "ATLAS",
    role: "QUALITY",
    discipline: "qa",
    status: "waiting",
    activity: "Waiting for regression results",
    currentTask: "Portal regression sweep",
    currentStep: "Blocked on APEX test run",
    progress: 90,
    missionId: "m-1039",
    lastSeen: "2026-08-26T15:31:52.000Z",
    startedAt: "2026-08-26T15:18:12.000Z",
    x: 322,
    y: 272,
  },
  {
    id: "orion",
    name: "ORION",
    role: "ANALYTICS",
    discipline: "analytics",
    status: "idle",
    activity: "Ready for next assignment",
    currentStep: "No active workload",
    lastSeen: "2026-08-26T15:29:11.000Z",
    x: 200,
    y: 330,
  },
  {
    id: "sentinel",
    name: "SENTINEL",
    role: "SECURITY",
    discipline: "security",
    status: "working",
    activity: "Reviewing authentication permissions",
    currentTask: "Audit authentication permission grants",
    currentStep: "Auditing 42 edge nodes",
    progress: 34,
    missionId: "m-1042",
    lastSeen: "2026-08-26T15:32:08.000Z",
    startedAt: "2026-08-26T15:21:30.000Z",
    x: 78,
    y: 272,
  },
  {
    id: "cipher",
    name: "CIPHER",
    role: "DEVOPS",
    discipline: "operations",
    status: "blocked",
    activity: "Credential rotation blocked — vault lease expired",
    currentTask: "Rotate edge node credentials",
    currentStep: "Awaiting lease renewal",
    progress: 12,
    missionId: "m-1037",
    lastSeen: "2026-08-26T15:30:40.000Z",
    startedAt: "2026-08-26T15:05:00.000Z",
    x: 78,
    y: 142,
  },
];

export function getMockAgents(): Agent[] {
  return MOCK_AGENTS;
}

export function findMockAgent(id: string): Agent | undefined {
  return MOCK_AGENTS.find((a) => a.id === id);
}
