import type {
  Mission,
  MissionTask,
  OperationEvent,
  OperationEventType,
  EventSeverity,
  TaskStatus,
} from "../types";
import type { OperationsRuntime, OperationsSnapshot } from "./operations-runtime";

/**
 * Deterministic mock operations engine.
 *
 * The scenario is a fixed script of steps, not a random generator: replaying
 * from step 0 always produces byte-identical state. That matters for two
 * reasons — the UI can offer a genuine reset/replay, and server and client
 * render the same thing.
 *
 * A step mutates the world by applying `MUTATIONS[i]` to the state produced by
 * steps 0..i-1. `snapshotAt(n)` folds the first `n` mutations, so seeking is
 * just a replay from the start and no step depends on wall-clock time.
 */

/** Scenario clock: each step advances this many seconds from the base time. */
const BASE_TIME = Date.parse("2026-08-26T17:38:00.000Z");
const STEP_SECONDS = 21;

function at(step: number): string {
  return new Date(BASE_TIME + step * STEP_SECONDS * 1000).toISOString();
}

/* ── Scenario definition ─────────────────────────────────────────────────── */

const MISSION_ID = "m-1042";
const T = {
  review: "t-1042-1",
  identify: "t-1042-2",
  regression: "t-1042-3",
  validate: "t-1042-4",
  report: "t-1042-5",
} as const;

/** A single scripted change plus the event it emits. */
interface Mutation {
  /** Applied to the working state. */
  apply: (s: OperationsSnapshot, step: number) => void;
  event: {
    type: OperationEventType;
    severity?: EventSeverity;
    agentId: string | null;
    targetAgentId?: string;
    taskId?: string;
    subject?: string;
    message: string;
  };
}

function setTask(
  s: OperationsSnapshot,
  id: string,
  patch: Partial<MissionTask>,
): void {
  const i = s.tasks.findIndex((t) => t.id === id);
  if (i >= 0) s.tasks[i] = { ...s.tasks[i], ...patch };
}

function setMission(s: OperationsSnapshot, patch: Partial<Mission>): void {
  const i = s.missions.findIndex((m) => m.id === MISSION_ID);
  if (i >= 0) s.missions[i] = { ...s.missions[i], ...patch };
}

/**
 * The scripted operation, in order:
 *
 *   mission starts → Hermes delegates to Apex → Apex works → tool runs →
 *   Atlas waits → Apex completes → handoff to Atlas → Atlas validates →
 *   Atlas completes → mission completes
 */
const MUTATIONS: Mutation[] = [
  {
    apply: (s, step) => {
      setMission(s, {
        status: "active",
        phase: "DISCOVERY",
        startedAt: at(step),
        progress: 0,
      });
    },
    event: {
      type: "mission-started",
      agentId: "hermes",
      message: "Authentication Investigation opened",
    },
  },
  {
    apply: (s, step) => {
      setTask(s, T.review, {
        status: "active",
        assignedAgentId: "apex",
        startedAt: at(step),
        currentStep: "Reading auth middleware",
      });
      setMission(s, { currentTaskId: T.review });
    },
    event: {
      type: "delegation",
      agentId: "hermes",
      targetAgentId: "apex",
      taskId: T.review,
      message: "Delegated authentication review",
    },
  },
  {
    apply: (s, step) => {
      setTask(s, T.review, { status: "completed", completedAt: at(step) });
      setTask(s, T.identify, {
        status: "active",
        assignedAgentId: "apex",
        startedAt: at(step),
        currentStep: "Comparing QA and staging sessions",
      });
      setMission(s, { currentTaskId: T.identify, progress: 20 });
    },
    event: {
      type: "task-completed",
      severity: "success",
      agentId: "apex",
      taskId: T.review,
      message: "Authentication implementation reviewed",
    },
  },
  {
    apply: (s, step) => {
      setTask(s, T.identify, { status: "completed", completedAt: at(step) });
      setTask(s, T.regression, {
        status: "active",
        assignedAgentId: "apex",
        startedAt: at(step),
        currentStep: "Executing login.api.spec.ts",
      });
      setMission(s, {
        currentTaskId: T.regression,
        phase: "REGRESSION VALIDATION",
        progress: 40,
      });
    },
    event: {
      type: "task-started",
      agentId: "apex",
      taskId: T.regression,
      message: "Started regression suite — 48 specs queued",
    },
  },
  {
    apply: () => {
      /* Tool activity only; no state transition. */
    },
    event: {
      type: "tool-started",
      agentId: "apex",
      taskId: T.regression,
      subject: "Playwright",
      message: "Started Playwright regression",
    },
  },
  {
    apply: (s) => {
      setTask(s, T.validate, {
        status: "blocked",
        assignedAgentId: "atlas",
        blockedReason: "Waiting for APEX regression results",
      });
    },
    event: {
      type: "agent-waiting",
      severity: "warn",
      agentId: "atlas",
      targetAgentId: "apex",
      taskId: T.validate,
      message: "Waiting for regression results",
    },
  },
  {
    apply: (s, step) => {
      setTask(s, T.regression, {
        status: "completed",
        completedAt: at(step),
        currentStep: undefined,
      });
      setMission(s, { progress: 62 });
    },
    event: {
      type: "tool-completed",
      severity: "success",
      agentId: "apex",
      taskId: T.regression,
      subject: "Playwright",
      message: "Regression suite finished — 6 failures isolated",
    },
  },
  {
    apply: (s, step) => {
      setTask(s, T.validate, {
        status: "active",
        blockedReason: undefined,
        startedAt: at(step),
        currentStep: "Reviewing failing scenarios",
      });
      setMission(s, { currentTaskId: T.validate, progress: 72 });
    },
    event: {
      type: "handoff",
      agentId: "apex",
      targetAgentId: "atlas",
      taskId: T.validate,
      message: "Regression results ready — please validate the failing scenarios",
    },
  },
  {
    apply: (s) => {
      setMission(s, { progress: 82 });
    },
    event: {
      type: "agent-working",
      agentId: "atlas",
      taskId: T.validate,
      message: "Validating regression coverage",
    },
  },
  {
    apply: (s, step) => {
      setTask(s, T.validate, { status: "completed", completedAt: at(step) });
      setTask(s, T.report, {
        status: "active",
        assignedAgentId: "nova",
        startedAt: at(step),
        currentStep: "Drafting summary",
      });
      setMission(s, {
        currentTaskId: T.report,
        phase: "REPORTING",
        progress: 90,
      });
    },
    event: {
      type: "task-completed",
      severity: "success",
      agentId: "atlas",
      taskId: T.validate,
      message: "Validation complete — fix confirmed",
    },
  },
  {
    apply: (s, step) => {
      setTask(s, T.report, { status: "completed", completedAt: at(step) });
      setMission(s, {
        status: "completed",
        currentTaskId: undefined,
        progress: 100,
        completedAt: at(step),
        attentionRequired: false,
      });
    },
    event: {
      type: "mission-completed",
      severity: "success",
      agentId: "hermes",
      message: "Authentication Investigation completed",
    },
  },
];

/* ── Base state (step 0) ─────────────────────────────────────────────────── */

function baseTasks(): MissionTask[] {
  return [
    {
      id: T.review,
      missionId: MISSION_ID,
      title: "Review authentication implementation",
      description: "Read the auth middleware and session refresh path.",
      status: "pending",
      assignedAgentId: null,
      dependencies: [],
    },
    {
      id: T.identify,
      missionId: MISSION_ID,
      title: "Identify failing test scenarios",
      description: "Compare session handling between QA and staging.",
      status: "pending",
      assignedAgentId: null,
      dependencies: [T.review],
    },
    {
      id: T.regression,
      missionId: MISSION_ID,
      title: "Run regression suite",
      description: "Execute the full Playwright authentication suite.",
      status: "pending",
      assignedAgentId: null,
      dependencies: [T.identify],
    },
    {
      id: T.validate,
      missionId: MISSION_ID,
      title: "Validate fix",
      description: "Confirm the failing scenarios now pass.",
      status: "pending",
      assignedAgentId: null,
      dependencies: [T.regression],
    },
    {
      id: T.report,
      missionId: MISSION_ID,
      title: "Prepare final report",
      description: "Summarise cause, fix and residual risk.",
      status: "pending",
      assignedAgentId: null,
      dependencies: [T.validate],
    },
  ];
}

/**
 * Missions outside the scripted scenario.
 *
 * Static backdrop so the operational screens are not a single-mission demo;
 * only `m-1042` advances with the simulation.
 */
function backdropMissions(): Mission[] {
  return [
    {
      id: "m-1039",
      code: "QA-1039",
      title: "Portal Listing Validation",
      description:
        "Validate the operator portal listing flow ahead of release 4.2.",
      status: "active",
      priority: "high",
      assignedAgentIds: ["nova", "orion"],
      leadAgentId: "nova",
      supportingAgentIds: ["orion"],
      progress: 46,
      phase: "RESEARCH",
      createdAt: "2026-08-26T11:20:00.000Z",
      startedAt: "2026-08-26T11:40:00.000Z",
      lastActivityAt: "2026-08-26T17:40:00.000Z",
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
      createdAt: "2026-08-26T09:50:00.000Z",
      startedAt: "2026-08-26T10:05:00.000Z",
      lastActivityAt: "2026-08-26T17:30:40.000Z",
      attentionRequired: true,
      blockedReason: "Vault lease expired — rotation halted at 12%",
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
      createdAt: "2026-08-26T07:40:00.000Z",
      startedAt: "2026-08-26T08:00:00.000Z",
      lastActivityAt: "2026-08-26T09:21:00.000Z",
      completedAt: "2026-08-26T09:21:00.000Z",
    },
  ];
}

function baseMission(): Mission {
  return {
    id: MISSION_ID,
    code: "OPS-1042",
    title: "Authentication Investigation",
    description: "Diagnose authentication failures and validate the fix.",
    status: "queued",
    priority: "critical",
    assignedAgentIds: ["apex", "atlas", "nova"],
    leadAgentId: "apex",
    supportingAgentIds: ["atlas", "nova"],
    progress: 0,
    phase: "QUEUED",
    createdAt: at(0),
    startedAt: at(0),
    lastActivityAt: at(0),
  };
}

/** Backdrop events so the stream is not empty at step 0. */
function backdropEvents(): OperationEvent[] {
  return [
    {
      id: "ev-bd-3",
      timestamp: "2026-08-26T17:30:40.000Z",
      type: "agent-blocked",
      severity: "error",
      agentId: "cipher",
      missionId: "m-1037",
      subject: "Vault",
      message: "Vault lease expired — credential rotation halted",
    },
    {
      id: "ev-bd-2",
      timestamp: "2026-08-26T17:33:12.000Z",
      type: "agent-working",
      severity: "info",
      agentId: "orion",
      missionId: "m-1039",
      message: "Started market analysis",
    },
    {
      id: "ev-bd-1",
      timestamp: "2026-08-26T17:35:48.000Z",
      type: "task-completed",
      severity: "success",
      agentId: "nova",
      missionId: "m-1039",
      message: "Completed portal research",
    },
  ];
}

/* ── Runtime ─────────────────────────────────────────────────────────────── */

/**
 * Fold the first `step` mutations over the base state.
 *
 * A pure function of `step` — no accumulated state between calls — so seeking
 * backwards is exactly as correct as playing forwards.
 */
function buildSnapshot(step: number): OperationsSnapshot {
  const clamped = Math.max(0, Math.min(step, MUTATIONS.length));

  const state: OperationsSnapshot = {
    missions: [baseMission(), ...backdropMissions()],
    tasks: baseTasks(),
    events: backdropEvents(),
  };

  for (let i = 0; i < clamped; i++) {
    const m = MUTATIONS[i];
    const timestamp = at(i + 1);
    m.apply(state, i + 1);
    state.events.push({
      id: `ev-${i + 1}`,
      timestamp,
      type: m.event.type,
      severity: m.event.severity ?? "info",
      agentId: m.event.agentId,
      targetAgentId: m.event.targetAgentId,
      missionId: MISSION_ID,
      taskId: m.event.taskId,
      subject: m.event.subject,
      message: m.event.message,
    });
    setMission(state, { lastActivityAt: timestamp });
  }

  // Newest first — every consumer wants the latest event at the top.
  state.events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // A mission with a blocked task needs an operator; derive rather than store,
  // so the flag cannot drift from the tasks it describes.
  const blocked = state.tasks.some((t) => t.status === "blocked");
  if (blocked) setMission(state, { attentionRequired: true });

  return state;
}

export const mockOperationsRuntime: OperationsRuntime = {
  id: "mock-scenario",
  live: false,
  totalSteps: MUTATIONS.length,
  // Opens mid-operation: Apex working, Atlas waiting — the interesting state.
  initialStep: 6,
  snapshotAt: buildSnapshot,
};

/** One import site, so swapping in a live runtime is a single edit. */
export function getOperationsRuntime(): OperationsRuntime {
  return mockOperationsRuntime;
}

export const SCENARIO_MISSION_ID = MISSION_ID;
