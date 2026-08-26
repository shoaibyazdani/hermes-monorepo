/**
 * Orchestration tests.
 *
 * Cover the parts that must hold regardless of what a model returns: plan
 * validation, the scheduler's readiness rules, the limits, and the live-view
 * reducer. All pure and provider-free, so they run with no credentials.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const { validatePlan, readySteps, blockedSteps } = await import(
  "../plan-validator.ts"
);
const { ORCHESTRATION_LIMITS } = await import("../limits.ts");
const { applyOrchestrationEvent } = await import("../live-view.ts");
const {
  listDelegatableAgentIds,
  isOrchestrator,
  getAgentDefinition,
} = await import("../../runtime/agents/definitions.ts");

const CTX = { eligibleAgentIds: ["apex", "nova", "atlas", "orion"], depth: 0 };

/* ── Registry: who may orchestrate, who may be delegated to ──────────────── */

test("only Hermes is an orchestrator", () => {
  assert.equal(isOrchestrator("hermes"), true);
  for (const id of ["apex", "nova", "atlas", "orion", "sentinel", "cipher"]) {
    assert.equal(isOrchestrator(id), false, `${id} must not orchestrate`);
  }
});

test("Hermes is not delegatable, preventing self-delegation", () => {
  const ids = listDelegatableAgentIds();
  assert.equal(ids.includes("hermes"), false);
  assert.ok(ids.includes("apex"));
  assert.ok(ids.includes("nova"));
});

test("Hermes prompt forbids claiming delegated work as its own", () => {
  const def = getAgentDefinition("hermes");
  assert.ok(/never present a delegated finding as your own/i.test(def.systemPrompt));
  assert.ok(/say so plainly/i.test(def.systemPrompt));
});

/* ── Plan validation ─────────────────────────────────────────────────────── */

test("an empty plan is valid and means answer directly", () => {
  const r = validatePlan({ objective: "What time is it?", steps: [] }, CTX);
  assert.equal(r.ok, true);
  assert.equal(r.plan.direct, true);
  assert.equal(r.plan.steps.length, 0);
});

test("a specialist request produces one delegated step", () => {
  const r = validatePlan(
    {
      objective: "Investigate the login failure",
      steps: [{ agentId: "apex", task: "Investigate auth", dependsOn: [] }],
    },
    CTX,
  );
  assert.equal(r.ok, true);
  assert.equal(r.plan.direct, false);
  assert.equal(r.plan.steps.length, 1);
  assert.equal(r.plan.steps[0].agentId, "apex");
  // Ids are assigned by the validator, never taken from the model.
  assert.equal(r.plan.steps[0].id, "step-1");
});

test("a complex request produces multiple steps", () => {
  const r = validatePlan(
    {
      objective: "Is this an app bug or a test bug?",
      steps: [
        { agentId: "apex", task: "Investigate the application", dependsOn: [] },
        { agentId: "atlas", task: "Review the tests", dependsOn: [] },
      ],
    },
    CTX,
  );
  assert.equal(r.ok, true);
  assert.equal(r.plan.steps.length, 2);
});

test("an unknown agent is rejected", () => {
  const r = validatePlan(
    { objective: "x", steps: [{ agentId: "ghost", task: "do it", dependsOn: [] }] },
    CTX,
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /not an agent available for delegation/);
});

test("delegating to Hermes is rejected", () => {
  // Self-delegation would be the first step towards a recursion loop.
  const r = validatePlan(
    { objective: "x", steps: [{ agentId: "hermes", task: "do it", dependsOn: [] }] },
    { eligibleAgentIds: listDelegatableAgentIds(), depth: 0 },
  );
  assert.equal(r.ok, false);
});

test("an empty task is rejected", () => {
  const r = validatePlan(
    { objective: "x", steps: [{ agentId: "apex", task: "   ", dependsOn: [] }] },
    CTX,
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /empty task/);
});

test("a dependency on a non-existent step is rejected", () => {
  const r = validatePlan(
    {
      objective: "x",
      steps: [{ agentId: "apex", task: "go", dependsOn: ["step-99"] }],
    },
    CTX,
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /not in the plan/);
});

test("a circular dependency is rejected", () => {
  const r = validatePlan(
    {
      objective: "x",
      steps: [
        { agentId: "apex", task: "a", dependsOn: ["step-2"] },
        { agentId: "nova", task: "b", dependsOn: ["step-1"] },
      ],
    },
    CTX,
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /cycle/);
});

test("a self-dependency is rejected", () => {
  const r = validatePlan(
    {
      objective: "x",
      steps: [{ agentId: "apex", task: "a", dependsOn: ["step-1"] }],
    },
    CTX,
  );
  assert.equal(r.ok, false);
});

test("exceeding the step limit is rejected", () => {
  const steps = Array.from(
    { length: ORCHESTRATION_LIMITS.MAX_PLAN_STEPS + 1 },
    () => ({ agentId: "apex", task: "go", dependsOn: [] }),
  );
  const r = validatePlan({ objective: "x", steps }, CTX);
  assert.equal(r.ok, false);
  assert.match(r.reason, /limit is/);
});

test("exceeding the distinct-agent limit is rejected", () => {
  const many = ["apex", "nova", "atlas", "orion", "sentinel"];
  const r = validatePlan(
    {
      objective: "x",
      steps: many.map((agentId) => ({ agentId, task: "go", dependsOn: [] })),
    },
    { eligibleAgentIds: many, depth: 0 },
  );
  // Five distinct agents exceeds MAX_DELEGATED_AGENTS (4).
  assert.equal(r.ok, false);
  assert.match(r.reason, /agents; the limit is/);
});

test("an agent at max depth cannot delegate further", () => {
  // This is what makes recursive delegation structurally impossible.
  const r = validatePlan(
    { objective: "x", steps: [{ agentId: "apex", task: "go", dependsOn: [] }] },
    { ...CTX, depth: ORCHESTRATION_LIMITS.MAX_ORCHESTRATION_DEPTH },
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /depth limit/);
});

test("malformed input is rejected without throwing", () => {
  for (const bad of [null, "string", 42, [], { steps: [] }, { objective: "" }]) {
    const r = validatePlan(bad, CTX);
    assert.equal(r.ok, false, `should reject ${JSON.stringify(bad)}`);
  }
});

test("task text is clamped", () => {
  const r = validatePlan(
    {
      objective: "x",
      steps: [{ agentId: "apex", task: "a".repeat(5000), dependsOn: [] }],
    },
    CTX,
  );
  assert.equal(r.ok, true);
  assert.equal(
    r.plan.steps[0].task.length,
    ORCHESTRATION_LIMITS.MAX_TASK_CHARS,
  );
});

/* ── Scheduler readiness ─────────────────────────────────────────────────── */

const mkStep = (id, deps = [], status = "queued") => ({
  id,
  agentId: "apex",
  task: "t",
  dependsOn: deps,
  status,
});

test("independent steps are all ready at once, enabling parallelism", () => {
  const steps = [mkStep("step-1"), mkStep("step-2"), mkStep("step-3")];
  assert.equal(readySteps(steps).length, 3);
});

test("a dependent step waits until its prerequisite completes", () => {
  const steps = [mkStep("step-1"), mkStep("step-2", ["step-1"])];
  assert.deepEqual(
    readySteps(steps).map((s) => s.id),
    ["step-1"],
  );

  steps[0].status = "completed";
  assert.deepEqual(
    readySteps(steps).map((s) => s.id),
    ["step-2"],
  );
});

test("a step whose prerequisite failed is blocked, never run", () => {
  // Running it would invite the agent to invent the missing input.
  const steps = [mkStep("step-1", [], "failed"), mkStep("step-2", ["step-1"])];
  assert.equal(readySteps(steps).length, 0);
  assert.deepEqual(
    blockedSteps(steps).map((s) => s.id),
    ["step-2"],
  );
});

test("a running step is not re-scheduled", () => {
  const steps = [mkStep("step-1", [], "running")];
  assert.equal(readySteps(steps).length, 0);
});

/* ── Live view reducer ───────────────────────────────────────────────────── */

const emptyOverlay = {
  orchestrations: {},
  liveAgentStatus: {},
  runtimeEvents: [],
};

const oev = (type, payload) => ({
  id: `e-${type}`,
  timestamp: new Date().toISOString(),
  orchestrationId: "orch-1",
  conversationId: "conv-1",
  type,
  payload,
});

test("the reducer tracks an orchestration through to completion", () => {
  let state = applyOrchestrationEvent(
    emptyOverlay,
    oev("orchestration.started", { objective: "Investigate", depth: 0 }),
  );
  assert.equal(state.orchestrations["orch-1"].status, "planning");
  assert.equal(state.liveAgentStatus.hermes, "working");

  state = applyOrchestrationEvent(
    state,
    oev("plan.created", {
      plan: {
        id: "plan-1",
        objective: "Investigate",
        direct: false,
        steps: [
          { id: "step-1", agentId: "apex", task: "a", dependsOn: [], status: "queued" },
          { id: "step-2", agentId: "atlas", task: "b", dependsOn: [], status: "queued" },
        ],
      },
    }),
  );
  assert.equal(state.orchestrations["orch-1"].steps.length, 2);
  assert.equal(state.liveAgentStatus.apex, "waiting");

  state = applyOrchestrationEvent(
    state,
    oev("step.started", { stepId: "step-1", agentId: "apex", runId: "run-1" }),
  );
  assert.equal(state.liveAgentStatus.apex, "working");

  state = applyOrchestrationEvent(
    state,
    oev("step.completed", {
      stepId: "step-1",
      agentId: "apex",
      result: { runId: "run-1", agentId: "apex", stepId: "step-1", status: "completed", summary: "found it" },
    }),
  );
  const step1 = state.orchestrations["orch-1"].steps.find((s) => s.stepId === "step-1");
  assert.equal(step1.status, "completed");
  assert.equal(step1.summary, "found it");
  // The override is released so the agent returns to its roster state.
  assert.equal(state.liveAgentStatus.apex, undefined);

  state = applyOrchestrationEvent(
    state,
    oev("orchestration.completed", { durationMs: 1000, completed: 2, failed: 0, total: 2 }),
  );
  assert.equal(state.orchestrations["orch-1"].status, "completed");
  assert.equal(state.liveAgentStatus.hermes, undefined);
});

test("a failed step is recorded as failed, not smoothed over", () => {
  let state = applyOrchestrationEvent(
    emptyOverlay,
    oev("plan.created", {
      plan: {
        id: "p",
        objective: "o",
        direct: false,
        steps: [{ id: "step-1", agentId: "atlas", task: "b", dependsOn: [], status: "queued" }],
      },
    }),
  );
  state = applyOrchestrationEvent(
    state,
    oev("step.failed", { stepId: "step-1", agentId: "atlas", reason: "timed out" }),
  );
  const step = state.orchestrations["orch-1"].steps[0];
  assert.equal(step.status, "failed");
  assert.equal(step.failureReason, "timed out");
  assert.equal(state.liveAgentStatus.atlas, "error");
});

test("cancellation preserves the count of completed steps", () => {
  let state = applyOrchestrationEvent(
    emptyOverlay,
    oev("orchestration.cancelled", { completedSteps: 1, totalSteps: 3 }),
  );
  assert.equal(state.orchestrations["orch-1"].status, "cancelled");
  const line = state.runtimeEvents[0].message;
  assert.match(line, /1\/3 completed first/);
});

test("every reducer step produces an operational event line", () => {
  const state = applyOrchestrationEvent(
    emptyOverlay,
    oev("plan.rejected", { reason: "no usable plan" }),
  );
  assert.equal(state.runtimeEvents.length, 1);
  assert.match(state.runtimeEvents[0].message, /Plan rejected/);
  assert.equal(state.runtimeEvents[0].severity, "warn");
});

/* ── Limits are sane ─────────────────────────────────────────────────────── */

test("depth limit is 1, so agents cannot delegate onward", () => {
  assert.equal(ORCHESTRATION_LIMITS.MAX_ORCHESTRATION_DEPTH, 1);
});

test("concurrency and agent limits are bounded", () => {
  assert.ok(ORCHESTRATION_LIMITS.MAX_CONCURRENT_RUNS >= 1);
  assert.ok(ORCHESTRATION_LIMITS.MAX_CONCURRENT_RUNS <= 8);
  assert.ok(ORCHESTRATION_LIMITS.MAX_DELEGATED_AGENTS <= 8);
  assert.ok(ORCHESTRATION_LIMITS.STEP_TIMEOUT_MS > 0);
});
