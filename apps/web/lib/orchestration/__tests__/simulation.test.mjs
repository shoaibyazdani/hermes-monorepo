import test from "node:test";
import assert from "node:assert/strict";

import {
  SIM_CONVERSATION_IDS,
  SIM_MISSION_ID,
  SIM_OBJECTIVE,
  SIM_ORCHESTRATION_ID,
  SIM_SYNTHESIS_STEP,
  SIM_TASK_IDS,
  SIM_TOTAL_STEPS,
  simulationEventsUpTo,
  simulationMissionAt,
  simulationStepLabel,
} from "../simulation.ts";
import {
  simulationCancelledAt,
  simulationSnapshotAt,
} from "../simulation-view.ts";

const stepOf = (snap, id) => snap.orchestration?.steps.find((s) => s.stepId === id);
const apex = (snap) => stepOf(snap, "step-1");
const atlas = (snap) => stepOf(snap, "step-2");

/* ── Determinism ─────────────────────────────────────────────────────────── */

test("snapshotAt is byte-identical across repeated calls", () => {
  for (let step = 0; step <= SIM_TOTAL_STEPS; step++) {
    const a = JSON.stringify(simulationSnapshotAt(step));
    const b = JSON.stringify(simulationSnapshotAt(step));
    const c = JSON.stringify(simulationSnapshotAt(step));
    assert.equal(a, b, `step ${step} differed between calls 1 and 2`);
    assert.equal(b, c, `step ${step} differed between calls 2 and 3`);
  }
});

test("seeking backwards yields the same state as playing forwards", () => {
  const forwardTen = JSON.stringify(simulationSnapshotAt(10));
  simulationSnapshotAt(5);
  const backToTen = JSON.stringify(simulationSnapshotAt(10));
  assert.equal(backToTen, forwardTen);

  // The canonical 10 → 5 → 10 check, and the reverse.
  const five = JSON.stringify(simulationSnapshotAt(5));
  simulationSnapshotAt(12);
  assert.equal(JSON.stringify(simulationSnapshotAt(5)), five);
});

test("a full replay in reverse order matches a full replay forwards", () => {
  const forwards = [];
  for (let s = 0; s <= SIM_TOTAL_STEPS; s++) {
    forwards.push(JSON.stringify(simulationSnapshotAt(s)));
  }
  for (let s = SIM_TOTAL_STEPS; s >= 0; s--) {
    assert.equal(JSON.stringify(simulationSnapshotAt(s)), forwards[s]);
  }
});

test("reset returns to the exact initial state", () => {
  const initial = JSON.stringify(simulationSnapshotAt(0));
  simulationSnapshotAt(SIM_TOTAL_STEPS);
  assert.equal(JSON.stringify(simulationSnapshotAt(0)), initial);
  // Nothing has happened at step 0.
  assert.equal(simulationSnapshotAt(0).orchestration, null);
});

test("no snapshot depends on wall-clock time", () => {
  // Timestamps are derived from the step index, so they are fixed values.
  const events = simulationEventsUpTo(SIM_TOTAL_STEPS);
  assert.ok(events.length > 0);
  for (const e of events) {
    assert.match(e.timestamp, /^2026-08-26T18:00:\d\d\.000Z$/);
  }
});

test("steps out of range clamp rather than throwing", () => {
  assert.equal(simulationSnapshotAt(-5).orchestration, null);
  const past = simulationSnapshotAt(SIM_TOTAL_STEPS + 50);
  assert.equal(
    JSON.stringify(past),
    JSON.stringify(simulationSnapshotAt(SIM_TOTAL_STEPS)),
  );
});

/* ── Event ordering ──────────────────────────────────────────────────────── */

test("events occur in the required order", () => {
  const types = simulationEventsUpTo(SIM_TOTAL_STEPS).map((e) => e.type);
  const first = (t) => types.indexOf(t);

  assert.ok(first("orchestration.started") >= 0, "no orchestration.started");
  assert.ok(
    first("orchestration.started") < first("plan.created"),
    "plan preceded orchestration start",
  );
  assert.ok(
    first("plan.created") < first("delegation.created"),
    "delegation preceded the plan",
  );
  assert.ok(
    first("delegation.created") < first("synthesis.started"),
    "synthesis preceded delegation",
  );
  assert.ok(
    first("synthesis.completed") < first("orchestration.completed"),
    "orchestration completed before synthesis",
  );
});

test("synthesis cannot start before BOTH agent completions", () => {
  const events = simulationEventsUpTo(SIM_TOTAL_STEPS);
  const idx = (pred) => events.findIndex(pred);

  const synthesis = idx((e) => e.type === "synthesis.started");
  const apexDone = idx(
    (e) => e.type === "step.completed" && e.payload.agentId === "apex",
  );
  const atlasDone = idx(
    (e) => e.type === "step.completed" && e.payload.agentId === "atlas",
  );

  assert.ok(apexDone >= 0 && atlasDone >= 0, "both agents must complete");
  assert.ok(synthesis > apexDone, "synthesis started before Apex completed");
  assert.ok(synthesis > atlasDone, "synthesis started before Atlas completed");
});

test("Hermes is not synthesizing while a dependency is outstanding", () => {
  // Apex completes first; Atlas is still running. Synthesis must not begin.
  for (let s = 0; s <= SIM_TOTAL_STEPS; s++) {
    const snap = simulationSnapshotAt(s);
    if (!snap.orchestration) continue;
    if (snap.orchestration.status !== "synthesizing") continue;
    assert.equal(apex(snap).status, "completed", `step ${s}`);
    assert.equal(atlas(snap).status, "completed", `step ${s}`);
  }
});

/* ── Parallelism ─────────────────────────────────────────────────────────── */

test("Apex and Atlas are both working at the same step", () => {
  let sawBoth = false;
  for (let s = 0; s <= SIM_TOTAL_STEPS; s++) {
    const snap = simulationSnapshotAt(s);
    if (!snap.orchestration) continue;
    if (apex(snap)?.status === "running" && atlas(snap)?.status === "running") {
      sawBoth = true;
      assert.equal(snap.liveAgentStatus.apex, "working");
      assert.equal(snap.liveAgentStatus.atlas, "working");
      break;
    }
  }
  assert.ok(sawBoth, "the scenario never ran two agents concurrently");
});

test("Atlas does not wait for Apex to finish before starting", () => {
  const events = simulationEventsUpTo(SIM_TOTAL_STEPS);
  const atlasStart = events.findIndex(
    (e) => e.type === "step.started" && e.payload.agentId === "atlas",
  );
  const apexDone = events.findIndex(
    (e) => e.type === "step.completed" && e.payload.agentId === "apex",
  );
  assert.ok(
    atlasStart < apexDone,
    "Atlas started only after Apex completed — that is sequential, not parallel",
  );
});

/* ── Agent state progression ─────────────────────────────────────────────── */

test("agents progress queued → running → completed", () => {
  const seen = { apex: [], atlas: [] };
  for (let s = 0; s <= SIM_TOTAL_STEPS; s++) {
    const snap = simulationSnapshotAt(s);
    if (!snap.orchestration) continue;
    for (const [k, get] of [["apex", apex], ["atlas", atlas]]) {
      const st = get(snap)?.status;
      if (st && seen[k][seen[k].length - 1] !== st) seen[k].push(st);
    }
  }
  assert.deepEqual(seen.apex, ["queued", "running", "completed"]);
  assert.deepEqual(seen.atlas, ["queued", "running", "completed"]);
});

test("Hermes reaches completed and releases its status override", () => {
  const end = simulationSnapshotAt(SIM_TOTAL_STEPS);
  assert.equal(end.orchestration.status, "completed");
  assert.equal(end.liveAgentStatus.hermes, undefined);
});

/* ── Structured results ──────────────────────────────────────────────────── */

test("agent results use the live AgentResult contract", () => {
  const events = simulationEventsUpTo(SIM_TOTAL_STEPS);
  const results = events
    .filter((e) => e.type === "step.completed")
    .map((e) => e.payload.result);

  assert.equal(results.length, 2);
  for (const r of results) {
    assert.equal(r.status, "completed");
    assert.ok(r.runId && r.agentId && r.stepId);
    assert.ok(r.summary.length > 20);
    assert.ok(Array.isArray(r.findings) && r.findings.length === 2);
  }

  const apexRes = results.find((r) => r.agentId === "apex");
  assert.match(apexRes.summary, /middleware is behaving correctly/i);
  const atlasRes = results.find((r) => r.agentId === "atlas");
  assert.match(atlasRes.summary, /outdated/i);
});

test("summaries reach the projected steps", () => {
  const end = simulationSnapshotAt(SIM_TOTAL_STEPS);
  assert.match(apex(end).summary, /authentication defect/i);
  assert.match(atlas(end).summary, /previous authentication behaviour/i);
});

/* ── Stable identity ─────────────────────────────────────────────────────── */

test("simulation ids are stable and contain no random component", () => {
  const a = simulationEventsUpTo(SIM_TOTAL_STEPS).map((e) => e.id);
  const b = simulationEventsUpTo(SIM_TOTAL_STEPS).map((e) => e.id);
  assert.deepEqual(a, b);
  for (const id of a) assert.match(id, /^sim-ev-\d+-\d+$/);

  assert.equal(SIM_ORCHESTRATION_ID, "sim-orch-auth-investigation");
  assert.equal(SIM_CONVERSATION_IDS.apex, "simulation-apex-auth-investigation");
  assert.equal(SIM_CONVERSATION_IDS.atlas, "simulation-atlas-auth-investigation");
});

test("delegated conversations are distinct and never Hermes's own", () => {
  const end = simulationSnapshotAt(SIM_TOTAL_STEPS);
  const convs = end.orchestration.steps
    .map((s) => s.conversationId)
    .filter(Boolean);
  assert.equal(new Set(convs).size, convs.length, "conversation ids collided");
  for (const c of convs) {
    assert.notEqual(c, SIM_CONVERSATION_IDS.hermes);
  }
});

/* ── Mission integration ─────────────────────────────────────────────────── */

test("mission and tasks use the existing model with real dependencies", () => {
  const { mission, tasks } = simulationMissionAt(SIM_TOTAL_STEPS);
  assert.equal(mission.id, SIM_MISSION_ID);
  assert.equal(mission.status, "completed");
  assert.equal(mission.progress, 100);
  assert.equal(tasks.length, 3);

  const synth = tasks.find((t) => t.id === SIM_TASK_IDS.synthesis);
  assert.deepEqual(synth.dependencies, [SIM_TASK_IDS.apex, SIM_TASK_IDS.atlas]);
  for (const t of tasks) assert.equal(t.status, "completed");
});

test("mission progress never decreases", () => {
  let last = -1;
  for (let s = 0; s <= SIM_TOTAL_STEPS; s++) {
    const { mission } = simulationMissionAt(s);
    assert.ok(mission.progress >= last, `progress fell at step ${s}`);
    last = mission.progress;
  }
});

/* ── Conversation integration ────────────────────────────────────────────── */

test("the synthesis reply appears only after synthesis completes", () => {
  assert.ok(SIM_SYNTHESIS_STEP > 0);
  assert.equal(simulationSnapshotAt(SIM_SYNTHESIS_STEP - 1).synthesisVisible, false);
  assert.equal(simulationSnapshotAt(SIM_SYNTHESIS_STEP).synthesisVisible, true);
  assert.equal(simulationSnapshotAt(SIM_TOTAL_STEPS).synthesisVisible, true);
});

/* ── Cancellation ────────────────────────────────────────────────────────── */

test("cancelling preserves completed work and cancels the rest", () => {
  // Step 8: Apex has completed, Atlas is still running.
  const cancelled = simulationCancelledAt(8);
  assert.equal(cancelled.orchestration.status, "cancelled");

  assert.equal(apex(cancelled).status, "completed", "completed work was lost");
  assert.ok(apex(cancelled).summary, "the completed result was discarded");
  assert.equal(atlas(cancelled).status, "cancelled");
});

test("cancelling loses no data that was present before it", () => {
  const before = simulationSnapshotAt(8);
  const after = simulationCancelledAt(8);
  assert.equal(after.orchestration.steps.length, before.orchestration.steps.length);
  assert.ok(after.events.length >= before.events.length);
  assert.equal(after.orchestration.objective, before.orchestration.objective);
});

test("cancellation is deterministic", () => {
  assert.equal(
    JSON.stringify(simulationCancelledAt(8)),
    JSON.stringify(simulationCancelledAt(8)),
  );
});

/* ── Scenario shape ──────────────────────────────────────────────────────── */

test("the objective matches the canonical scenario", () => {
  const snap = simulationSnapshotAt(SIM_TOTAL_STEPS);
  assert.equal(snap.orchestration.objective, SIM_OBJECTIVE);
  assert.match(SIM_OBJECTIVE, /application or the regression tests/i);
});

test("every step has an operator-facing label", () => {
  for (let s = 1; s <= SIM_TOTAL_STEPS; s++) {
    assert.ok(simulationStepLabel(s).length > 0, `step ${s} had no label`);
  }
  assert.equal(simulationStepLabel(0), "Not started");
});

/* ── Orchestrator status ─────────────────────────────────────────────────── */

test("Hermes is never demoted to waiting by its own synthesis step", () => {
  // The plan contains a synthesis step assigned to hermes. That must not make
  // the orchestrator look like an agent queued behind its own plan.
  for (let s = 1; s < SIM_TOTAL_STEPS; s++) {
    const snap = simulationSnapshotAt(s);
    if (!snap.orchestration) continue;
    assert.notEqual(
      snap.liveAgentStatus.hermes,
      "waiting",
      `Hermes read as waiting at step ${s}`,
    );
  }
});

test("Hermes progresses working → thinking → released", () => {
  const seen = [];
  for (let s = 0; s <= SIM_TOTAL_STEPS; s++) {
    const st = simulationSnapshotAt(s).liveAgentStatus.hermes;
    if (seen[seen.length - 1] !== st) seen.push(st);
  }
  // Starts undefined (step 0 records nothing), then working while it
  // orchestrates, thinking while it synthesises, and released at the end.
  assert.deepEqual(seen, ["working", "thinking", undefined]);
});

test("Hermes only reaches thinking once both agents are done", () => {
  for (let s = 0; s <= SIM_TOTAL_STEPS; s++) {
    const snap = simulationSnapshotAt(s);
    if (snap.liveAgentStatus.hermes !== "thinking") continue;
    assert.equal(apex(snap).status, "completed", `step ${s}`);
    assert.equal(atlas(snap).status, "completed", `step ${s}`);
  }
});
