import { AGENT_DETAILS } from "../../mock/agent-registry";

/**
 * Tool registry.
 *
 * Two rules govern everything here:
 *
 *   1. Only registered tools can run. A tool id from the model is looked up,
 *      never invoked reflectively — there is no path from model output to an
 *      arbitrary function.
 *   2. Only authorised tools can run. Authorisation comes from the same
 *      `AGENT_DETAILS` the workspace UI renders, so what an operator sees on
 *      an agent's tool list is exactly what the runtime permits.
 *
 * The tools implemented are deliberately inert: they read a clock and do
 * arithmetic. No shell, no filesystem, no network, no eval. A sandbox
 * architecture is a prerequisite for anything more, and does not exist yet.
 */

export interface ToolResult {
  ok: boolean;
  /** Value returned to the model. */
  output: unknown;
  /** Short human-readable line for the UI. Never internals. */
  summary: string;
}

export interface RuntimeTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown): Promise<ToolResult>;
}

/* ── Tools ───────────────────────────────────────────────────────────────── */

const timeTool: RuntimeTool = {
  id: "time",
  name: "Time",
  description:
    "Returns the current date and time in UTC. Use when the answer depends on what time it is now.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async execute(): Promise<ToolResult> {
    const now = new Date().toISOString();
    return {
      ok: true,
      output: { utc: now },
      summary: `UTC ${now.slice(11, 19)}`,
    };
  },
};

/**
 * Arithmetic over a fixed grammar.
 *
 * Parsed with a small recursive-descent evaluator rather than `eval` or `new
 * Function`. The input originates from a language model, so it is treated as
 * hostile: only digits, the four operators, parentheses and a decimal point
 * are accepted, and nothing is ever executed as JavaScript.
 */
const calculatorTool: RuntimeTool = {
  id: "calculator",
  name: "Calculator",
  description:
    "Evaluates an arithmetic expression using + - * / and parentheses. Use for exact arithmetic instead of estimating.",
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "e.g. (48 * 3) / 2",
      },
    },
    required: ["expression"],
    additionalProperties: false,
  },
  async execute(input: unknown): Promise<ToolResult> {
    const expression =
      typeof input === "object" && input !== null
        ? (input as { expression?: unknown }).expression
        : undefined;

    if (typeof expression !== "string" || !expression.trim()) {
      return {
        ok: false,
        output: { error: "An expression is required." },
        summary: "Invalid input",
      };
    }

    if (expression.length > 200) {
      return {
        ok: false,
        output: { error: "Expression too long." },
        summary: "Rejected: too long",
      };
    }

    // Whitelist before parsing: anything outside this set is rejected outright.
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      return {
        ok: false,
        output: { error: "Only numbers, + - * / and parentheses are allowed." },
        summary: "Rejected: unsupported characters",
      };
    }

    try {
      const value = evaluateArithmetic(expression);
      if (!Number.isFinite(value)) {
        return {
          ok: false,
          output: { error: "Result is not a finite number." },
          summary: "Undefined result",
        };
      }
      return {
        ok: true,
        output: { expression, result: value },
        summary: `= ${value}`,
      };
    } catch {
      return {
        ok: false,
        output: { error: "The expression could not be parsed." },
        summary: "Parse error",
      };
    }
  },
};

/**
 * Recursive-descent evaluator for `expr := term (('+'|'-') term)*`.
 *
 * Small enough to audit at a glance, which is the point: the alternative
 * (`eval`) would hand model output straight to the JavaScript engine.
 */
function evaluateArithmetic(src: string): number {
  let i = 0;
  // Whitespace is significant BETWEEN numbers: stripping it outright would
  // turn "1 2" into "12" and return a confidently wrong answer. Reject a gap
  // that separates two digits, then strip the remaining whitespace.
  if (/\d\s+\d/.test(src)) throw new Error("adjacent numbers");
  const s = src.replace(/\s+/g, "");

  const peek = () => s[i];
  const eat = (ch: string) => {
    if (s[i] !== ch) throw new Error("unexpected");
    i++;
  };

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const right = parseFactor();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    if (peek() === "+") {
      i++;
      return parseFactor();
    }
    if (peek() === "-") {
      i++;
      return -parseFactor();
    }
    if (peek() === "(") {
      eat("(");
      const v = parseExpr();
      eat(")");
      return v;
    }
    const start = i;
    while (i < s.length && /[\d.]/.test(s[i])) i++;
    if (start === i) throw new Error("expected number");
    const n = Number(s.slice(start, i));
    if (Number.isNaN(n)) throw new Error("bad number");
    return n;
  }

  const value = parseExpr();
  // Trailing input means the expression was malformed, e.g. "1 2".
  if (i !== s.length) throw new Error("trailing input");
  return value;
}

/* ── Registry ────────────────────────────────────────────────────────────── */

const TOOLS: Record<string, RuntimeTool> = {
  [timeTool.id]: timeTool,
  [calculatorTool.id]: calculatorTool,
};

export function hasTool(toolId: string): boolean {
  return Object.hasOwn(TOOLS, toolId);
}

export function getTool(toolId: string): RuntimeTool | undefined {
  return TOOLS[toolId];
}

/**
 * Is this agent permitted this tool?
 *
 * Reads the agent's tool list from the shared registry and requires an
 * explicit `enabled` entry. Unknown agent, unknown tool or a disabled entry
 * all deny — the default is no.
 */
export function isToolAuthorized(agentId: string, toolId: string): boolean {
  if (!hasTool(toolId)) return false;
  const detail = AGENT_DETAILS[agentId];
  if (!detail?.tools) return false;
  return detail.tools.some((t) => t.id === toolId && t.enabled);
}

/** The tools an agent may actually be offered, in provider-neutral form. */
export function toolsForAgent(agentId: string) {
  return Object.values(TOOLS)
    .filter((t) => isToolAuthorized(agentId, t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
}
