/**
 * Runtime architecture tests.
 *
 * Run with: node --test apps/web/lib/runtime/__tests__/runtime.test.mjs
 *
 * These exercise the pure, server-side logic — parsing, authorisation, the run
 * state machine, stream decoding — without a model provider or a browser. They
 * must pass with NO API credentials configured, which is itself one of the
 * guarantees under test.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

/* ── Command parsing / agent resolution ──────────────────────────────────── */

const AGENTS = [
  { id: "apex", name: "APEX" },
  { id: "nova", name: "NOVA" },
  { id: "atlas", name: "ATLAS" },
  { id: "hermes", name: "HERMES" },
];

const { parseCommand } = await import("../../chat/command-parser.ts");

test("resolves a leading name address", () => {
  const r = parseCommand("Apex, check the tests", AGENTS);
  assert.equal(r.targetAgentId, "apex");
  assert.equal(r.message, "check the tests");
});

test("resolves an @mention anywhere", () => {
  const r = parseCommand("@Nova research authentication", AGENTS);
  assert.equal(r.targetAgentId, "nova");
  assert.equal(r.message, "research authentication");
});

test("is case-insensitive and tolerates punctuation", () => {
  for (const input of ["APEX: go", "apex go", "@apex go", "Apex — go"]) {
    assert.equal(parseCommand(input, AGENTS).targetAgentId, "apex", input);
  }
});

test("does not target an agent merely mentioned mid-sentence", () => {
  // "what is apex doing" is a question ABOUT apex, not a command TO it.
  const r = parseCommand("what is apex doing", AGENTS);
  assert.equal(r.targetAgentId, null);
  assert.equal(r.hadExplicitTarget, false);
});

test("reports an unresolved mention rather than guessing", () => {
  const r = parseCommand("@ghost do something", AGENTS);
  assert.equal(r.targetAgentId, null);
  assert.equal(r.unresolvedMention, "ghost");
});

/* ── Agent registry / identity ───────────────────────────────────────────── */

const { getAgentDefinition, isKnownAgent, listRuntimeAgentIds } = await import(
  "../agents/definitions.ts"
);

test("only known agents are accepted", () => {
  assert.ok(isKnownAgent("apex"));
  assert.ok(isKnownAgent("nova"));
  assert.equal(isKnownAgent("../../etc/passwd"), false);
  assert.equal(isKnownAgent("nonexistent"), false);
});

test("each agent gets its own distinct system prompt", () => {
  const apex = getAgentDefinition("apex");
  const nova = getAgentDefinition("nova");

  assert.ok(apex.systemPrompt.includes("APEX"));
  assert.ok(nova.systemPrompt.includes("NOVA"));
  // Identity must be real, not a swapped label on one shared prompt.
  assert.notEqual(apex.systemPrompt, nova.systemPrompt);
  assert.ok(apex.systemPrompt.includes("Engineering"));
  assert.ok(nova.systemPrompt.includes("Research"));
});

test("prompts forbid claiming unexecuted tool use", () => {
  for (const id of listRuntimeAgentIds()) {
    const def = getAgentDefinition(id);
    assert.ok(
      /never claim to have run a tool/i.test(def.systemPrompt),
      `${id} is missing the no-false-claims rule`,
    );
  }
});

/* ── Tool registry and authorisation ─────────────────────────────────────── */

const { getTool, hasTool, isToolAuthorized, toolsForAgent } = await import(
  "../tools/registry.ts"
);

test("registered tools resolve; unknown ones do not", () => {
  assert.ok(hasTool("calculator"));
  assert.ok(hasTool("time"));
  assert.equal(hasTool("run_shell"), false);
  assert.equal(hasTool("execute_command"), false);
});

test("authorised tools are permitted", () => {
  assert.ok(isToolAuthorized("apex", "calculator"));
  assert.ok(isToolAuthorized("nova", "time"));
});

test("unauthorised and unknown tools are denied", () => {
  // Not in the registry at all.
  assert.equal(isToolAuthorized("apex", "run_shell"), false);
  // Unknown agent cannot be authorised for anything.
  assert.equal(isToolAuthorized("attacker", "calculator"), false);
  // A registry tool the agent does not have enabled.
  assert.equal(isToolAuthorized("nova", "playwright"), false);
});

test("toolsForAgent offers only what the agent may use", () => {
  const ids = toolsForAgent("apex").map((t) => t.id);
  assert.ok(ids.includes("calculator"));
  assert.equal(ids.includes("run_shell"), false);
});

/* ── Tool execution safety ───────────────────────────────────────────────── */

test("calculator evaluates arithmetic correctly", async () => {
  const calc = getTool("calculator");
  const r = await calc.execute({ expression: "(48 * 3) / 2" });
  assert.equal(r.ok, true);
  assert.equal(r.output.result, 72);
});

test("calculator refuses anything that is not arithmetic", async () => {
  const calc = getTool("calculator");
  // Each of these would be catastrophic under eval().
  const hostile = [
    "process.exit(1)",
    "require('fs').readFileSync('/etc/passwd')",
    "globalThis.fetch('http://evil')",
    "1; console.log('x')",
    "__proto__",
  ];
  for (const expression of hostile) {
    const r = await calc.execute({ expression });
    assert.equal(r.ok, false, `should reject: ${expression}`);
  }
});

test("calculator rejects malformed expressions without throwing", async () => {
  const calc = getTool("calculator");
  for (const expression of ["1 2", "((", "*/", ""]) {
    const r = await calc.execute({ expression });
    assert.equal(r.ok, false);
  }
});

test("time tool returns a parseable UTC instant", async () => {
  const r = await getTool("time").execute({});
  assert.equal(r.ok, true);
  assert.ok(!Number.isNaN(Date.parse(r.output.utc)));
});

/* ── Run manager / state machine ─────────────────────────────────────────── */

const { createRun, getRun, transitionRun, cancelRun, activeRuns } =
  await import("../run-manager.ts");

test("runs are independent, so agents do not block each other", () => {
  const a = createRun({ agentId: "apex", conversationId: "conv-a" });
  const b = createRun({ agentId: "nova", conversationId: "conv-b" });

  assert.notEqual(a.runId, b.runId);
  transitionRun(a.runId, "running");

  // Nova is untouched by Apex advancing.
  assert.equal(getRun(b.runId).status, "queued");
  assert.equal(getRun(a.runId).status, "running");

  // Cancelling one leaves the other alone.
  cancelRun(a.runId);
  assert.equal(getRun(a.runId).status, "cancelled");
  assert.equal(getRun(b.runId).status, "queued");
});

test("illegal state transitions are rejected", () => {
  const run = createRun({ agentId: "apex", conversationId: "c" });
  assert.ok(transitionRun(run.runId, "running"));
  assert.ok(transitionRun(run.runId, "completed"));

  // A completed run must never reopen or be re-reported.
  assert.equal(transitionRun(run.runId, "running"), false);
  assert.equal(transitionRun(run.runId, "failed"), false);
  assert.equal(getRun(run.runId).status, "completed");
});

test("a cancelled run cannot later report completion", () => {
  const run = createRun({ agentId: "atlas", conversationId: "c" });
  transitionRun(run.runId, "running");
  cancelRun(run.runId);
  assert.equal(transitionRun(run.runId, "completed"), false);
  assert.equal(getRun(run.runId).status, "cancelled");
});

test("cancelling aborts the run signal", () => {
  const run = createRun({ agentId: "apex", conversationId: "c" });
  assert.equal(run.controller.signal.aborted, false);
  cancelRun(run.runId);
  assert.equal(run.controller.signal.aborted, true);
});

test("concurrent runs are both tracked as active", () => {
  const a = createRun({ agentId: "apex", conversationId: "x" });
  const b = createRun({ agentId: "nova", conversationId: "y" });
  transitionRun(a.runId, "running");
  transitionRun(b.runId, "running");

  const ids = activeRuns().map((r) => r.runId);
  assert.ok(ids.includes(a.runId));
  assert.ok(ids.includes(b.runId));

  cancelRun(a.runId);
  cancelRun(b.runId);
});

/* ── Event stream encoding ───────────────────────────────────────────────── */

const { encodeEvent, decodeChunk } = await import("../events.ts");

function evt(type, payload) {
  return {
    id: `e-${Math.random()}`,
    timestamp: new Date().toISOString(),
    runId: "run-1",
    agentId: "apex",
    conversationId: "conv-1",
    type,
    payload,
  };
}

test("deltas accumulate into one final message", () => {
  const events = [
    evt("message.started", { messageId: "m1" }),
    evt("message.delta", { messageId: "m1", text: "The auth " }),
    evt("message.delta", { messageId: "m1", text: "failure is " }),
    evt("message.delta", { messageId: "m1", text: "in the middleware." }),
  ];

  const wire = events.map(encodeEvent).join("");
  const { events: decoded } = decodeChunk(wire, "");

  assert.equal(decoded.length, 4);

  // The client appends deltas into a single message — never one per token.
  const text = decoded
    .filter((e) => e.type === "message.delta")
    .reduce((acc, e) => acc + e.payload.text, "");
  assert.equal(text, "The auth failure is in the middleware.");

  const ids = new Set(decoded.map((e) => e.payload.messageId));
  assert.equal(ids.size, 1, "all deltas belong to one message");
});

test("events split across chunk boundaries are recovered", () => {
  const wire = [evt("agent.thinking", {}), evt("agent.completed", {})]
    .map(encodeEvent)
    .join("");

  // Split mid-JSON, the way a network chunk would.
  const cut = Math.floor(wire.length / 2);
  const first = decodeChunk(wire.slice(0, cut), "");
  const second = decodeChunk(wire.slice(cut), first.carry);

  assert.equal(first.events.length + second.events.length, 2);
});

test("a malformed frame does not discard the events around it", () => {
  const wire =
    encodeEvent(evt("agent.thinking", {})) +
    "{ not json\n" +
    encodeEvent(evt("agent.completed", {}));

  const { events } = decodeChunk(wire, "");
  assert.equal(events.length, 2);
});

/* ── Configuration / graceful degradation ────────────────────────────────── */

const { getRuntimeConfig, getPublicRuntimeStatus } = await import(
  "../config.ts"
);

test("falls back to simulation with no credentials configured", () => {
  delete process.env.AI_API_KEY;
  delete process.env.MINIMAX_API_KEY;
  delete process.env.CORTEX_BASE_URL;
  delete process.env.AI_PROVIDER;

  const cfg = getRuntimeConfig();
  assert.equal(cfg.provider, "none");
  assert.equal(cfg.live, false);
  // No crash, no throw — the app must run without an API key.
});

test("public status never leaks credentials", () => {
  process.env.AI_API_KEY = "sk-secret-value-do-not-leak";
  const status = getPublicRuntimeStatus();
  const serialised = JSON.stringify(status);

  assert.equal(serialised.includes("sk-secret"), false);
  assert.equal("apiKey" in status, false);
  assert.equal("baseUrl" in status, false);

  delete process.env.AI_API_KEY;
});

test("a configured key makes the runtime live", () => {
  process.env.AI_API_KEY = "test-key";
  const cfg = getRuntimeConfig();
  assert.equal(cfg.provider, "minimax");
  assert.equal(cfg.live, true);
  assert.equal(cfg.supportsStreaming, true);
  delete process.env.AI_API_KEY;
});

test("Cortex is selected when only its URL is set, and cannot stream", () => {
  delete process.env.AI_API_KEY;
  delete process.env.MINIMAX_API_KEY;
  process.env.CORTEX_BASE_URL = "http://example.invalid:7833";

  const cfg = getRuntimeConfig();
  assert.equal(cfg.provider, "cortex");
  assert.equal(cfg.live, true);
  // Verified against the real service: /api/chat returns one buffered body.
  assert.equal(cfg.supportsStreaming, false);

  delete process.env.CORTEX_BASE_URL;
});
