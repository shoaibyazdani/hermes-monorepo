import { ORCHESTRATION_LIMITS } from "./limits";
import type { OrchestrationPlan, OrchestrationStep } from "./types";

/**
 * Plan validation.
 *
 * The plan arrives as model output, so it is treated as hostile input. Nothing
 * here trusts a field: agent ids are checked against the registry, dependencies
 * must resolve, cycles are detected, and every limit is enforced before a
 * single run is created.
 *
 * A rejected plan is a normal outcome — Hermes answers directly instead.
 */

export interface ValidationOk {
  ok: true;
  plan: OrchestrationPlan;
}

export interface ValidationError {
  ok: false;
  /** Safe to show an operator; never contains model internals. */
  reason: string;
}

export type ValidationResult = ValidationOk | ValidationError;

export interface ValidationContext {
  /** Agents that may receive delegated work. */
  eligibleAgentIds: string[];
  /** Current delegation depth; a plan at max depth cannot delegate. */
  depth: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Detect a dependency cycle.
 *
 * Depth-first with a recursion stack: a step reachable from itself would
 * otherwise deadlock the scheduler, which would wait forever for a
 * prerequisite that can never complete.
 */
function hasCycle(steps: OrchestrationStep[]): boolean {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (id: string): boolean => {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    stack.add(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (visit(dep)) return true;
    }
    stack.delete(id);
    return false;
  };

  return steps.some((s) => visit(s.id));
}

/**
 * Validate a raw plan object.
 *
 * Returns a normalised plan on success. Every string is trimmed and clamped,
 * so nothing downstream has to re-check length or type.
 */
export function validatePlan(
  raw: unknown,
  ctx: ValidationContext,
): ValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: "The plan was not an object." };
  }

  const objective =
    typeof raw.objective === "string" ? raw.objective.trim() : "";
  if (!objective) {
    return { ok: false, reason: "The plan had no objective." };
  }

  // A plan with no steps means Hermes will answer directly. That is valid.
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (rawSteps.length === 0) {
    return {
      ok: true,
      plan: {
        id: `plan-${Date.now().toString(36)}`,
        objective: objective.slice(0, ORCHESTRATION_LIMITS.MAX_TASK_CHARS),
        steps: [],
        direct: true,
      },
    };
  }

  // Depth is checked before anything else: at the limit, no delegation is
  // permitted at all, regardless of how well-formed the plan is.
  if (ctx.depth >= ORCHESTRATION_LIMITS.MAX_ORCHESTRATION_DEPTH) {
    return {
      ok: false,
      reason: `Delegation depth limit reached (${ORCHESTRATION_LIMITS.MAX_ORCHESTRATION_DEPTH}); agents may not delegate further.`,
    };
  }

  if (rawSteps.length > ORCHESTRATION_LIMITS.MAX_PLAN_STEPS) {
    return {
      ok: false,
      reason: `The plan had ${rawSteps.length} steps; the limit is ${ORCHESTRATION_LIMITS.MAX_PLAN_STEPS}.`,
    };
  }

  const steps: OrchestrationStep[] = [];
  const seenIds = new Set<string>();

  for (const [index, entry] of rawSteps.entries()) {
    if (!isRecord(entry)) {
      return { ok: false, reason: `Step ${index + 1} was not an object.` };
    }

    // Ids are assigned here rather than taken from the model, so a plan cannot
    // choose an id that collides with anything or carries meaning elsewhere.
    const id = `step-${index + 1}`;
    if (seenIds.has(id)) {
      return { ok: false, reason: `Duplicate step id ${id}.` };
    }
    seenIds.add(id);

    const agentId =
      typeof entry.agentId === "string" ? entry.agentId.trim().toLowerCase() : "";
    if (!agentId) {
      return { ok: false, reason: `Step ${index + 1} named no agent.` };
    }
    if (!ctx.eligibleAgentIds.includes(agentId)) {
      // Covers both unknown agents and agents not eligible for delegation —
      // notably Hermes itself, which must not delegate to itself.
      return {
        ok: false,
        reason: `Step ${index + 1} named "${agentId}", which is not an agent available for delegation.`,
      };
    }

    const task = typeof entry.task === "string" ? entry.task.trim() : "";
    if (!task) {
      return { ok: false, reason: `Step ${index + 1} had an empty task.` };
    }

    const dependsOn = Array.isArray(entry.dependsOn)
      ? entry.dependsOn
          .filter((d): d is string => typeof d === "string")
          .map((d) => d.trim())
      : [];

    steps.push({
      id,
      agentId,
      task: task.slice(0, ORCHESTRATION_LIMITS.MAX_TASK_CHARS),
      dependsOn,
      status: "queued",
    });
  }

  // Dependencies must resolve to steps in this same plan.
  const ids = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!ids.has(dep)) {
        return {
          ok: false,
          reason: `${step.id} depends on "${dep}", which is not in the plan.`,
        };
      }
      if (dep === step.id) {
        return { ok: false, reason: `${step.id} depends on itself.` };
      }
    }
  }

  if (hasCycle(steps)) {
    return {
      ok: false,
      reason: "The plan contained a dependency cycle and could never complete.",
    };
  }

  const distinctAgents = new Set(steps.map((s) => s.agentId));
  if (distinctAgents.size > ORCHESTRATION_LIMITS.MAX_DELEGATED_AGENTS) {
    return {
      ok: false,
      reason: `The plan used ${distinctAgents.size} agents; the limit is ${ORCHESTRATION_LIMITS.MAX_DELEGATED_AGENTS}.`,
    };
  }

  return {
    ok: true,
    plan: {
      id: `plan-${Date.now().toString(36)}`,
      objective: objective.slice(0, ORCHESTRATION_LIMITS.MAX_TASK_CHARS),
      steps,
      direct: false,
    },
  };
}

/**
 * Steps whose dependencies have all completed.
 *
 * A dependency that failed or timed out does NOT unblock its dependents:
 * running a step whose prerequisite never produced a result would invite the
 * agent to invent one.
 */
export function readySteps(steps: OrchestrationStep[]): OrchestrationStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  return steps.filter((s) => {
    if (s.status !== "queued" && s.status !== "waiting") return false;
    return s.dependsOn.every((d) => byId.get(d)?.status === "completed");
  });
}

/**
 * Steps that can never run because a prerequisite did not succeed.
 *
 * Surfacing these lets the orchestration finish honestly — reporting what was
 * skipped — rather than hanging on work that will never be scheduled.
 */
export function blockedSteps(steps: OrchestrationStep[]): OrchestrationStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const terminal = new Set(["failed", "cancelled", "timed-out"]);
  return steps.filter((s) => {
    if (s.status !== "queued" && s.status !== "waiting") return false;
    return s.dependsOn.some((d) => terminal.has(byId.get(d)?.status ?? ""));
  });
}
