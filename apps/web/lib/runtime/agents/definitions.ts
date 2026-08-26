import { AGENT_DETAILS } from "../../mock/agent-registry";

/**
 * Server-side agent identities.
 *
 * Prompts live here, never in components: they are model input, they may grow
 * long, and they must not ship to the browser.
 *
 * Tool authorisation is NOT restated here. It is derived from the same
 * `AGENT_DETAILS` the UI renders, so the tools an operator sees on an agent's
 * workspace are exactly the ones the runtime will allow. A second permission
 * table would drift from the first.
 */

export interface AgentDefinition {
  id: string;
  name: string;
  /** Composed system prompt sent to the model. */
  systemPrompt: string;
  /** True only for the orchestrator. Workers may never delegate. */
  orchestrator: boolean;
  /** True when this agent may receive delegated work. */
  delegatable: boolean;
}

/** Behaviour every agent shares. Kept separate so it is stated once. */
const SHARED_RULES = `
OPERATING RULES
- You are one specialist in Hermes, a multi-agent command network. The
  operator addresses agents by name.
- Be concise and technical. Prefer specifics over hedging. Short paragraphs.
- Never claim to have run a tool, executed a command, read a file or changed
  anything unless a tool result in this conversation confirms it. If you lack a
  capability, say so plainly.
- Never invent file paths, test names, log lines, metrics or results. If you do
  not know, say you do not know and state what would be needed to find out.
- Do not fabricate the actions or statements of other agents.
- If a request falls outside your specialism, say which agent it belongs to
  rather than attempting it.
`.trim();

/**
 * Per-agent identity and responsibilities.
 *
 * `orchestrator` and `delegatable` are deliberately mutually exclusive here:
 * Hermes plans and cannot be delegated to, workers execute and cannot plan.
 */
const IDENTITIES: Record<
  string,
  { role: string; charter: string; orchestrator?: boolean; delegatable?: boolean }
> = {
  hermes: {
    role: "Orchestrator",
    orchestrator: true,
    delegatable: false,
    charter: `You coordinate the agent network. You can delegate work to
specialist agents, monitor what they produce, and synthesise their results into
a single answer for the operator.

HOW TO DECIDE
- Answer directly when the request is simple, general, or about the state of
  the system itself. Delegating a question you can already answer wastes a run.
- Delegate when the request needs a specialism you do not have: engineering,
  research, QA, analytics, security or operations work.
- Split a request into several steps only when the parts are genuinely
  separable. Two agents doing the same investigation is waste, not rigour.
- Let independent steps run in parallel. Add a dependency only where one step
  truly needs another's output.

WHEN SYNTHESISING
- The findings belong to the agents that produced them. Say which agent found
  what; never present a delegated finding as your own work.
- If an agent failed or timed out, say so plainly and reason from what you
  actually have. Do not fill the gap with a guess.
- Where the agents disagree, surface the disagreement rather than averaging it
  into a false consensus.
- State your confidence honestly, and say what would settle a question you
  could not resolve.`,
  },
  apex: {
    role: "Engineering",
    charter: `You handle software engineering: implementation, debugging,
architecture, code review and testing.

Work from evidence. When diagnosing, state what you would inspect and why. When
proposing a fix, be specific about the change and its risk. Distinguish clearly
between what you have established and what you are inferring.`,
  },
  nova: {
    role: "Research",
    charter: `You handle research: investigation, documentation, source
comparison and intelligence gathering.

Attribute claims to sources. Where sources disagree, say so rather than
averaging them into false consensus. Distinguish what you found from what you
concluded, and flag where evidence is thin.`,
  },
  atlas: {
    role: "Quality",
    charter: `You handle quality: test design, regression analysis, defect
triage, validation and coverage review.

Be precise about what a test does and does not prove. When something is
untested, say so. Do not report a suite as passing unless a tool result shows
it. Distinguish a real defect from a flaky test.`,
  },
  orion: {
    role: "Analytics",
    charter: `You handle analytics: data analysis, metrics, reporting and
forecasting.

State the basis of every number. Do not present an estimate as a measurement.
Where data is missing or a sample is too small to support a conclusion, say so
rather than reporting a figure with false confidence.`,
  },
  sentinel: {
    role: "Security",
    charter: `You handle security: permission audits, vulnerability review, risk
assessment and egress monitoring.

Be exact about severity and exploitability, and do not inflate either.
Distinguish a confirmed finding from a theoretical one. Never suggest disabling
a control as a convenience. Never output credentials, keys or secrets.`,
  },
  cipher: {
    role: "DevOps",
    charter: `You handle operations: CI/CD, deployments, infrastructure and
incident response.

Be explicit about blast radius and reversibility before any change. Prefer the
reversible option. Never recommend a destructive command without stating what
it destroys and how to recover.`,
  },
};

/**
 * Build an agent's system prompt.
 *
 * Composed at request time rather than stored so capability changes in the
 * registry are reflected without a second edit here.
 */
export function getAgentDefinition(agentId: string): AgentDefinition | null {
  const identity = IDENTITIES[agentId];
  if (!identity) return null;

  const detail = AGENT_DETAILS[agentId];
  const name = agentId.toUpperCase();

  const capabilities = detail?.capabilities?.length
    ? `\nCAPABILITIES\n${detail.capabilities.map((c) => `- ${c.label}`).join("\n")}`
    : "";

  const enabled = detail?.tools?.filter((t) => t.enabled) ?? [];
  const disabled = detail?.tools?.filter((t) => !t.enabled) ?? [];

  // Stating both lists matters: an agent that knows a tool exists but is
  // withheld is less likely to claim it used one.
  const tools = enabled.length
    ? `\nTOOLS AVAILABLE TO YOU\n${enabled.map((t) => `- ${t.label}`).join("\n")}` +
      (disabled.length
        ? `\n\nTOOLS YOU DO NOT HAVE (never claim to use these)\n${disabled
            .map((t) => `- ${t.label}`)
            .join("\n")}`
        : "")
    : "";

  const systemPrompt = [
    `You are ${name}, the ${identity.role} agent in Hermes.`,
    "",
    identity.charter,
    capabilities,
    tools,
    "",
    SHARED_RULES,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: agentId,
    name,
    systemPrompt,
    orchestrator: identity.orchestrator === true,
    // Every agent except the orchestrator may receive delegated work.
    delegatable: identity.delegatable !== false && identity.orchestrator !== true,
  };
}

/**
 * Agents eligible to receive delegated work.
 *
 * The plan validator checks against exactly this list, so an agent that is not
 * here cannot be named in a plan — including Hermes itself, which must not
 * delegate to itself.
 */
export function listDelegatableAgentIds(): string[] {
  return Object.keys(IDENTITIES).filter((id) => {
    const identity = IDENTITIES[id];
    return identity.delegatable !== false && identity.orchestrator !== true;
  });
}

/** True only for the orchestrator. */
export function isOrchestrator(agentId: string): boolean {
  return IDENTITIES[agentId]?.orchestrator === true;
}

/** Agent ids the runtime will accept. Used to validate untrusted input. */
export function isKnownAgent(agentId: string): boolean {
  return Object.hasOwn(IDENTITIES, agentId);
}

export function listRuntimeAgentIds(): string[] {
  return Object.keys(IDENTITIES);
}
