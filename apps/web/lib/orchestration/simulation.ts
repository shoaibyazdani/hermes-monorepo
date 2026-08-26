import type { OrchestrationEvent } from "./events";
import type { AgentResult, OrchestrationPlan, OrchestrationStep } from "./types";
import type { Mission, MissionTask } from "../types";

/**
 * Deterministic orchestration simulation.
 *
 * Exists so the orchestration architecture is demonstrable with no model
 * provider attached. It follows the same principle as the mock operations
 * engine: a fixed script of steps, folded from the start, with no dependence
 * on wall-clock time, randomness or accumulated state.
 *
 * The important design choice is that this emits real `OrchestrationEvent`s —
 * the same union the live orchestrator produces. `applyOrchestrationEvent`
 * then folds them into exactly the same `LiveOrchestration` the UI already
 * renders, so live and simulated runs share one rendering path and one
 * reducer. Only the source of the events differs.
 *
 * Nothing here may leak into live mode: these results are fabricated for
 * demonstration, and are only ever produced when no provider is configured.
 */

/* ── Scenario identity ───────────────────────────────────────────────────── */

/**
 * The scenarios this module can play.
 *
 * A union rather than a registry: there is one scenario today, and a second
 * can be added by extending the union and the switch that reads it. Building
 * a plugin framework for a single entry would be speculative.
 */
export type SimulationScenario = "authentication-investigation";

export const SIMULATION_SCENARIO: SimulationScenario =
  "authentication-investigation";

/**
 * Stable identifiers. Deterministic by construction — no UUIDs — so a
 * delegated conversation link is the same on every replay and survives a
 * reload, and server and client agree on what to render.
 */
export const SIM_ORCHESTRATION_ID = "sim-orch-auth-investigation";
export const SIM_MISSION_ID = "sim-m-auth-investigation";

export const SIM_CONVERSATION_IDS = {
  hermes: "simulation-hermes-auth-investigation",
  apex: "simulation-apex-auth-investigation",
  atlas: "simulation-atlas-auth-investigation",
} as const;

const STEP_IDS = { apex: "step-1", atlas: "step-2", synthesis: "step-3" } as const;

const SIM_RUN_IDS = {
  apex: "sim-run-apex-1",
  atlas: "sim-run-atlas-1",
} as const;

export const SIM_OBJECTIVE =
  "Investigate login failures and determine whether the root cause is the application or the regression tests.";

/**
 * Scenario clock. A fixed base plus a per-step offset: timestamps are a
 * function of the step index alone, which is what lets a snapshot be
 * byte-identical across calls.
 */
const BASE_TIME = Date.parse("2026-08-26T18:00:00.000Z");
const STEP_SECONDS = 4;

function at(step: number): string {
  return new Date(BASE_TIME + step * STEP_SECONDS * 1000).toISOString();
}

/* ── Plan ────────────────────────────────────────────────────────────────── */

/**
 * The plan Hermes "produces".
 *
 * Steps 1 and 2 have no dependencies, so the scheduler may run them
 * concurrently; step 3 depends on both, which is what forces synthesis to wait.
 * Built fresh on each call so no caller can mutate shared scenario state.
 */
function buildPlan(): OrchestrationPlan {
  const steps: OrchestrationStep[] = [
    {
      id: STEP_IDS.apex,
      agentId: "apex",
      task: "Investigate application authentication behaviour.",
      dependsOn: [],
      status: "queued",
    },
    {
      id: STEP_IDS.atlas,
      agentId: "atlas",
      task: "Review regression authentication tests.",
      dependsOn: [],
      status: "queued",
    },
    {
      id: STEP_IDS.synthesis,
      agentId: "hermes",
      task: "Compare findings and synthesise a conclusion.",
      dependsOn: [STEP_IDS.apex, STEP_IDS.atlas],
      status: "queued",
    },
  ];

  return {
    id: "sim-plan-1",
    objective: SIM_OBJECTIVE,
    steps,
    direct: false,
  };
}

/* ── Results ─────────────────────────────────────────────────────────────── */

/**
 * Simulated agent results, in the same `AgentResult` contract the live runtime
 * produces — so synthesis and the UI consume them through the existing path.
 */
function apexResult(): AgentResult {
  return {
    runId: SIM_RUN_IDS.apex,
    agentId: "apex",
    stepId: STEP_IDS.apex,
    status: "completed",
    summary:
      "Authentication middleware is behaving correctly. The observed failures do not indicate an application authentication defect.",
    findings: [
      "Token validation returns the expected unauthorized response",
      "Authentication middleware behaviour is consistent",
    ],
    durationMs: 12_000,
  };
}

function atlasResult(): AgentResult {
  return {
    runId: SIM_RUN_IDS.atlas,
    agentId: "atlas",
    stepId: STEP_IDS.atlas,
    status: "completed",
    summary:
      "The regression test expects the previous authentication behaviour and is now outdated.",
    findings: [
      "Test expectation conflicts with current authentication behaviour",
      "Failing assertion should be updated",
    ],
    durationMs: 20_000,
  };
}

export const SIM_SYNTHESIS_TEXT =
  "This appears to be a regression-test issue rather than an application authentication defect. Apex found the authentication middleware behaving correctly, while Atlas found the regression test still asserting the previous behaviour. The failing assertion should be updated rather than the application changed.";

/* ── Event script ────────────────────────────────────────────────────────── */

/**
 * A scripted beat: the events emitted at this step, plus how the mission and
 * its tasks change.
 *
 * Events carry no id or timestamp here — the fold stamps both from the step
 * index, so identity is derived rather than authored and cannot drift.
 */
type ScriptedEvent = Omit<
  OrchestrationEvent,
  "id" | "timestamp" | "orchestrationId" | "conversationId" | "missionId"
>;

interface Beat {
  /** What the operator sees happening, for the step label. */
  label: string;
  events: ScriptedEvent[];
  /** Task id → patch, applied after the events for this beat. */
  tasks?: Record<string, Partial<MissionTask>>;
  mission?: Partial<Mission>;
}

export const SIM_TASK_IDS = {
  apex: `${SIM_MISSION_ID}-t1`,
  atlas: `${SIM_MISSION_ID}-t2`,
  synthesis: `${SIM_MISSION_ID}-t3`,
} as const;

/**
 * The scripted orchestration, in order:
 *
 *   Hermes plans → delegates to Apex and Atlas together → both work in
 *   parallel → Apex finishes first → Atlas finishes → only then does Hermes
 *   synthesise → orchestration completes.
 *
 * Apex and Atlas are deliberately started in the same beat and are both
 * `working` at beat 6: a sequential script would not demonstrate the
 * scheduler's actual behaviour.
 */
const BEATS: Beat[] = [
  {
    label: "Orchestration created",
    events: [
      {
        type: "orchestration.started",
        payload: { objective: SIM_OBJECTIVE, depth: 0 },
      },
    ],
    mission: { status: "active", phase: "PLANNING", progress: 0 },
  },
  {
    label: "Hermes planning",
    // No event: planning is the state established by orchestration.started.
    // A beat still passes so the operator sees planning as its own moment.
    events: [],
    mission: { phase: "PLANNING" },
  },
  {
    label: "Plan created",
    events: [{ type: "plan.created", payload: { plan: buildPlan() } }],
    mission: { phase: "DELEGATION", progress: 10 },
  },
  {
    label: "Apex and Atlas queued",
    events: [
      {
        type: "step.queued",
        payload: {
          stepId: STEP_IDS.apex,
          agentId: "apex",
          task: "Investigate application authentication behaviour.",
        },
      },
      {
        type: "step.queued",
        payload: {
          stepId: STEP_IDS.atlas,
          agentId: "atlas",
          task: "Review regression authentication tests.",
        },
      },
    ],
    tasks: {
      [SIM_TASK_IDS.apex]: { status: "pending" },
      [SIM_TASK_IDS.atlas]: { status: "pending" },
    },
  },
  {
    label: "Apex and Atlas started",
    // Both delegations are created in the same beat — this is the parallelism.
    events: [
      {
        type: "delegation.created",
        payload: {
          stepId: STEP_IDS.apex,
          agentId: "apex",
          delegatedConversationId: SIM_CONVERSATION_IDS.apex,
          task: "Investigate application authentication behaviour.",
        },
      },
      {
        type: "delegation.created",
        payload: {
          stepId: STEP_IDS.atlas,
          agentId: "atlas",
          delegatedConversationId: SIM_CONVERSATION_IDS.atlas,
          task: "Review regression authentication tests.",
        },
      },
      {
        type: "step.started",
        payload: {
          stepId: STEP_IDS.apex,
          agentId: "apex",
          runId: SIM_RUN_IDS.apex,
        },
      },
      {
        type: "step.started",
        payload: {
          stepId: STEP_IDS.atlas,
          agentId: "atlas",
          runId: SIM_RUN_IDS.atlas,
        },
      },
    ],
    tasks: {
      [SIM_TASK_IDS.apex]: {
        status: "active",
        startedAt: at(5),
        currentStep: "Reading authentication middleware",
      },
      [SIM_TASK_IDS.atlas]: {
        status: "active",
        startedAt: at(5),
        currentStep: "Locating the failing regression tests",
      },
    },
    mission: { phase: "INVESTIGATION", progress: 25, currentTaskId: SIM_TASK_IDS.apex },
  },
  {
    label: "Apex and Atlas thinking",
    events: [],
    tasks: {
      [SIM_TASK_IDS.apex]: { currentStep: "Tracing token validation" },
      [SIM_TASK_IDS.atlas]: { currentStep: "Reading test expectations" },
    },
  },
  {
    label: "Apex and Atlas working",
    events: [],
    tasks: {
      [SIM_TASK_IDS.apex]: { currentStep: "Checking unauthorized responses" },
      [SIM_TASK_IDS.atlas]: { currentStep: "Comparing assertions to current behaviour" },
    },
    mission: { progress: 45 },
  },
  {
    label: "Apex completed",
    events: [
      {
        type: "delegation.completed",
        payload: {
          stepId: STEP_IDS.apex,
          agentId: "apex",
          runId: SIM_RUN_IDS.apex,
          durationMs: 12_000,
        },
      },
      {
        type: "step.completed",
        payload: {
          stepId: STEP_IDS.apex,
          agentId: "apex",
          result: apexResult(),
        },
      },
    ],
    tasks: {
      [SIM_TASK_IDS.apex]: {
        status: "completed",
        completedAt: at(8),
        currentStep: undefined,
      },
    },
    mission: { progress: 60, currentTaskId: SIM_TASK_IDS.atlas },
  },
  {
    label: "Atlas still working",
    // Hermes waits here: one result is in, synthesis may not begin.
    events: [],
    tasks: {
      [SIM_TASK_IDS.atlas]: { currentStep: "Confirming the outdated assertion" },
    },
    mission: { progress: 70 },
  },
  {
    label: "Atlas completed",
    events: [
      {
        type: "delegation.completed",
        payload: {
          stepId: STEP_IDS.atlas,
          agentId: "atlas",
          runId: SIM_RUN_IDS.atlas,
          durationMs: 20_000,
        },
      },
      {
        type: "step.completed",
        payload: {
          stepId: STEP_IDS.atlas,
          agentId: "atlas",
          result: atlasResult(),
        },
      },
    ],
    tasks: {
      [SIM_TASK_IDS.atlas]: {
        status: "completed",
        completedAt: at(10),
        currentStep: undefined,
      },
    },
    mission: { progress: 80, currentTaskId: SIM_TASK_IDS.synthesis },
  },
  {
    label: "Hermes synthesising",
    // Only now, with both dependencies satisfied.
    events: [{ type: "synthesis.started", payload: { resultCount: 2 } }],
    tasks: {
      [SIM_TASK_IDS.synthesis]: {
        status: "active",
        startedAt: at(11),
        currentStep: "Comparing findings",
      },
    },
    mission: { phase: "SYNTHESIS", progress: 90 },
  },
  {
    label: "Synthesis complete",
    events: [
      {
        type: "synthesis.completed",
        payload: { messageId: "sim-msg-synthesis" },
      },
    ],
    tasks: {
      [SIM_TASK_IDS.synthesis]: {
        status: "completed",
        completedAt: at(12),
        currentStep: undefined,
      },
    },
  },
  {
    label: "Orchestration complete",
    events: [
      {
        type: "orchestration.completed",
        payload: { durationMs: 48_000, completed: 2, failed: 0, total: 2 },
      },
    ],
    mission: { status: "completed", phase: "COMPLETE", progress: 100 },
  },
];

export const SIM_TOTAL_STEPS = BEATS.length;

/** Operator-facing label for a step, for the transport readout. */
export function simulationStepLabel(step: number): string {
  if (step <= 0) return "Not started";
  const beat = BEATS[Math.min(step, BEATS.length) - 1];
  return beat.label;
}

/* ── Event fold ──────────────────────────────────────────────────────────── */

/**
 * Every event emitted by steps 1..step, in order.
 *
 * Pure: a function of `step` alone. Ids and timestamps are derived from the
 * beat and event index, so two calls with the same argument produce
 * byte-identical output — which is what makes seeking backwards as correct as
 * playing forwards.
 */
export function simulationEventsUpTo(step: number): OrchestrationEvent[] {
  const clamped = Math.max(0, Math.min(step, BEATS.length));
  const events: OrchestrationEvent[] = [];

  for (let i = 0; i < clamped; i++) {
    const beat = BEATS[i];
    beat.events.forEach((event, j) => {
      events.push({
        ...event,
        id: `sim-ev-${i + 1}-${j + 1}`,
        timestamp: at(i + 1),
        orchestrationId: SIM_ORCHESTRATION_ID,
        conversationId: SIM_CONVERSATION_IDS.hermes,
        missionId: SIM_MISSION_ID,
      } as OrchestrationEvent);
    });
  }

  return events;
}

/* ── Mission and tasks ───────────────────────────────────────────────────── */

function baseMission(): Mission {
  return {
    id: SIM_MISSION_ID,
    code: "OPS-2001",
    title: "Authentication Investigation",
    description: SIM_OBJECTIVE,
    status: "queued",
    priority: "high",
    assignedAgentIds: ["hermes", "apex", "atlas"],
    leadAgentId: "hermes",
    supportingAgentIds: ["apex", "atlas"],
    progress: 0,
    phase: "QUEUED",
    createdAt: at(0),
    startedAt: at(0),
    lastActivityAt: at(0),
  };
}

/**
 * Tasks mirror the plan's steps, in the existing mission/task model rather
 * than a simulation-only one, so the mission screens need no special case.
 */
function baseTasks(): MissionTask[] {
  return [
    {
      id: SIM_TASK_IDS.apex,
      missionId: SIM_MISSION_ID,
      title: "Investigate application",
      description: "Investigate application authentication behaviour.",
      status: "pending",
      assignedAgentId: "apex",
      dependencies: [],
    },
    {
      id: SIM_TASK_IDS.atlas,
      missionId: SIM_MISSION_ID,
      title: "Review regression tests",
      description: "Review regression authentication tests.",
      status: "pending",
      assignedAgentId: "atlas",
      dependencies: [],
    },
    {
      id: SIM_TASK_IDS.synthesis,
      missionId: SIM_MISSION_ID,
      // Depends on both, so the chain renders the real dependency.
      title: "Synthesize findings",
      description: "Compare findings and synthesise a conclusion.",
      status: "pending",
      assignedAgentId: "hermes",
      dependencies: [SIM_TASK_IDS.apex, SIM_TASK_IDS.atlas],
    },
  ];
}

export interface SimulationMissionState {
  mission: Mission;
  tasks: MissionTask[];
}

/**
 * Mission and task state after `step` beats. Pure fold, same contract as the
 * operations engine's own snapshot.
 */
export function simulationMissionAt(step: number): SimulationMissionState {
  const clamped = Math.max(0, Math.min(step, BEATS.length));
  let mission = baseMission();
  let tasks = baseTasks();

  for (let i = 0; i < clamped; i++) {
    const beat = BEATS[i];
    if (beat.mission) mission = { ...mission, ...beat.mission };
    if (beat.tasks) {
      tasks = tasks.map((t) =>
        beat.tasks![t.id] ? { ...t, ...beat.tasks![t.id] } : t,
      );
    }
    mission = { ...mission, lastActivityAt: at(i + 1) };
  }

  return { mission, tasks };
}

/**
 * The step at which the synthesis reply should appear in Hermes's
 * conversation — the beat that emits `synthesis.completed`.
 */
export const SIM_SYNTHESIS_STEP = BEATS.findIndex((b) =>
  b.events.some((e) => e.type === "synthesis.completed"),
) + 1;
