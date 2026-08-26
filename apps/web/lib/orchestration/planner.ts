import { getRuntimeConfig } from "../runtime/config";
import {
  getAgentDefinition,
  listDelegatableAgentIds,
} from "../runtime/agents/definitions";
import { AGENT_DETAILS } from "../mock/agent-registry";
import { ORCHESTRATION_LIMITS } from "./limits";
import { validatePlan, type ValidationResult } from "./plan-validator";
import type { ModelProvider } from "../runtime/providers/types";

/**
 * Planning: turn a user request into a validated, structured plan.
 *
 * The model is asked for JSON and its answer is parsed and validated before
 * anything runs. A plan that fails validation is not retried into compliance —
 * Hermes answers directly instead, which is the safe default.
 */

/** Roster description, so the model can only choose from real agents. */
function agentCatalogue(): string {
  return listDelegatableAgentIds()
    .map((id) => {
      const def = getAgentDefinition(id);
      const detail = AGENT_DETAILS[id];
      const caps = detail?.capabilities?.map((c) => c.label).join(", ") ?? "";
      return `- ${id} (${def?.name ?? id}): ${detail?.description ?? ""}${caps ? ` Capabilities: ${caps}.` : ""}`;
    })
    .join("\n");
}

const PLANNING_PROMPT = `You are the planning stage of HERMES, an agent orchestrator.

Decide whether the operator's request needs specialist agents, and if so, which.

AVAILABLE AGENTS
{{AGENTS}}

Reply with ONLY a JSON object, no prose and no code fence:

{
  "objective": "one sentence restating what the operator wants",
  "steps": [
    { "agentId": "apex", "task": "what this agent should do", "dependsOn": [] }
  ]
}

RULES
- Return "steps": [] when you can answer the request yourself. Simple questions,
  general knowledge, and questions about system state need no delegation.
- Delegate only work that genuinely needs a specialism you lack.
- One step per agent per distinct piece of work. Do not give two agents the
  same job.
- "dependsOn" holds step ids like "step-1", and only where a step truly needs
  another's output. Independent steps run in parallel, which is faster.
- At most {{MAX_STEPS}} steps and {{MAX_AGENTS}} distinct agents.
- Write each task as an instruction to that agent, with enough context to act
  on alone. The agent cannot see this conversation.
- Never invent an agent id. Use only the ids listed above.`;

export interface PlanningInput {
  message: string;
  /** Prior Hermes turns, for context. Already trimmed by the caller. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  depth: number;
  signal?: AbortSignal;
}

export interface PlanningOutcome {
  result: ValidationResult;
  /** Raw model text, kept for server-side logging only. */
  raw?: string;
}

/**
 * Ask the model for a plan, then validate it.
 *
 * Returns a validation result rather than throwing: a rejected plan is an
 * expected outcome that falls back to a direct answer.
 */
export async function createPlan(
  provider: ModelProvider,
  input: PlanningInput,
): Promise<PlanningOutcome> {
  const cfg = getRuntimeConfig();

  const system = PLANNING_PROMPT.replace("{{AGENTS}}", agentCatalogue())
    .replace("{{MAX_STEPS}}", String(ORCHESTRATION_LIMITS.MAX_PLAN_STEPS))
    .replace(
      "{{MAX_AGENTS}}",
      String(ORCHESTRATION_LIMITS.MAX_DELEGATED_AGENTS),
    );

  let text = "";
  for await (const ev of provider.stream({
    system,
    messages: [...(input.history ?? []), { role: "user", content: input.message }],
    maxTokens: Math.min(cfg.maxTokens, 1500),
    signal: input.signal,
  })) {
    if (ev.kind === "text") text += ev.text;
    if (ev.kind === "error") {
      return {
        result: { ok: false, reason: "The planner could not be reached." },
      };
    }
  }

  const parsed = extractJson(text);
  if (!parsed) {
    console.warn("[orchestration] planner returned unparseable output");
    return {
      result: { ok: false, reason: "The planner did not return a usable plan." },
      raw: text,
    };
  }

  return {
    result: validatePlan(parsed, {
      eligibleAgentIds: listDelegatableAgentIds(),
      depth: input.depth,
    }),
    raw: text,
  };
}

/**
 * Pull a JSON object out of model output.
 *
 * Models wrap JSON in prose or fences despite instructions, so the first
 * balanced object is extracted rather than requiring a clean response.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to extraction.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Fall through.
    }
  }

  // Scan for the first balanced {...}, respecting strings and escapes so a
  // brace inside a task description does not truncate the object.
  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
