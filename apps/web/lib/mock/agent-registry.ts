import type {
  AgentCapability,
  AgentConfig,
  AgentRelation,
  AgentTelemetry,
  AgentTool,
} from "../types";

/**
 * Per-agent detail: capabilities, toolset, runtime config, counters and
 * memory preview.
 *
 * Kept separate from the roster in `lib/mock/agents` so the roster stays a
 * lightweight list (what `/api/agents` returns today) while the workspace can
 * pull the heavier record it needs. `getAgentDetail` merges the two.
 *
 * ALL VALUES HERE ARE SIMULATED. Nothing executes a tool, holds real memory,
 * or reports a real metric.
 */
export interface AgentDetailRecord {
  codename: string;
  description: string;
  registeredAt: string;
  capabilities: AgentCapability[];
  tools: AgentTool[];
  config: AgentConfig;
  telemetry: AgentTelemetry;
  memory: string[];
}

const cap = (label: string): AgentCapability => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
});

const tool = (
  label: string,
  enabled: boolean,
  description?: string,
): AgentTool => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
  enabled,
  description,
});

export const AGENT_DETAILS: Record<string, AgentDetailRecord> = {
  hermes: {
    codename: "HRM-00",
    description:
      "Coordinates agents and manages overall system operations.",
    registeredAt: "2026-06-01T09:00:00.000Z",
    capabilities: [
      cap("Orchestration"),
      cap("Task Delegation"),
      cap("Prioritisation"),
      cap("Voice Routing"),
      cap("Escalation"),
    ],
    tools: [
      tool("Time", true, "Read the current UTC time"),
      tool("Calculator", true, "Evaluate an arithmetic expression"),
      tool("Agent Registry", true, "Enumerate and address agents"),
      tool("Delegation", true, "Assign work to specialists"),
      tool("Voice Channel", true, "Operator command intake"),
      tool("Scheduler", true, "Queue and sequence missions"),
      tool("Terminal", false, "Direct shell access"),
    ],
    config: {
      model: "Claude",
      temperature: 0.3,
      maxContext: "200K",
      autonomy: "supervised",
    },
    telemetry: {
      tasksToday: 42,
      completed: 38,
      failed: 0,
      running: 4,
      avgResponseSeconds: 1.4,
      toolsUsed: 96,
      missions: 7,
    },
    memory: [
      "Operator prefers concise status summaries",
      "Authentication investigation is the current priority",
      "ATLAS is blocked pending APEX regression results",
      "Vault lease expiry recurs weekly — schedule renewal",
    ],
  },

  apex: {
    codename: "APX-01",
    description:
      "Code, debugging, architecture and software implementation.",
    registeredAt: "2026-06-01T09:04:00.000Z",
    capabilities: [
      cap("Software Engineering"),
      cap("Debugging"),
      cap("Code Review"),
      cap("Testing"),
      cap("Architecture"),
      cap("Git Operations"),
    ],
    tools: [
      tool("Time", true, "Read the current UTC time"),
      tool("Calculator", true, "Evaluate an arithmetic expression"),
      tool("Code", true, "Read and edit the workspace"),
      tool("Terminal", true, "Run build and test commands"),
      tool("Git", true, "Branch, diff and commit"),
      tool("Browser", true, "Inspect running pages"),
      tool("Playwright", true, "Drive end-to-end suites"),
      tool("Web Search", false, "External lookups"),
    ],
    config: {
      model: "Claude",
      temperature: 0.2,
      maxContext: "128K",
      autonomy: "supervised",
    },
    telemetry: {
      tasksToday: 14,
      completed: 11,
      failed: 1,
      running: 2,
      avgResponseSeconds: 8.2,
      toolsUsed: 37,
      missions: 4,
    },
    memory: [
      "Authentication flow uses MFA",
      "Regression suite runs against QA",
      "Last deployment: 14:02",
      "Operator prefers Playwright HTML reports",
    ],
  },

  nova: {
    codename: "NVA-02",
    description:
      "Web research, documentation, investigation and intelligence gathering.",
    registeredAt: "2026-06-01T09:08:00.000Z",
    capabilities: [
      cap("Web Research"),
      cap("Summarisation"),
      cap("Source Comparison"),
      cap("Documentation"),
      cap("Citation"),
    ],
    tools: [
      tool("Time", true, "Read the current UTC time"),
      tool("Calculator", true, "Evaluate an arithmetic expression"),
      tool("Web Search", true, "Query external sources"),
      tool("Browser", true, "Read and extract pages"),
      tool("Document Index", true, "Search internal docs"),
      tool("Code", true, "Read repository sources"),
      tool("Terminal", false, "Shell access"),
    ],
    config: {
      model: "Claude",
      temperature: 0.4,
      maxContext: "200K",
      autonomy: "semi-autonomous",
    },
    telemetry: {
      tasksToday: 9,
      completed: 7,
      failed: 0,
      running: 1,
      avgResponseSeconds: 12.6,
      toolsUsed: 51,
      missions: 3,
    },
    memory: [
      "4 Playwright auth patterns identified",
      "Session-fixture approach favoured by 3 of 4 sources",
      "1,284 incident records indexed",
    ],
  },

  atlas: {
    codename: "ATL-03",
    description:
      "Testing, regression analysis, validation and defect investigation.",
    registeredAt: "2026-06-01T09:12:00.000Z",
    capabilities: [
      cap("Test Design"),
      cap("Regression Analysis"),
      cap("Defect Triage"),
      cap("Validation"),
      cap("Coverage Review"),
    ],
    tools: [
      tool("Time", true, "Read the current UTC time"),
      tool("Calculator", true, "Evaluate an arithmetic expression"),
      tool("Playwright", true, "Execute browser suites"),
      tool("Test Runner", true, "Unit and integration runs"),
      tool("Code", true, "Read specs and fixtures"),
      tool("Browser", true, "Manual verification"),
      tool("Terminal", true, "Invoke suites"),
      tool("Git", false, "Repository writes"),
    ],
    config: {
      model: "Claude",
      temperature: 0.1,
      maxContext: "128K",
      autonomy: "supervised",
    },
    telemetry: {
      tasksToday: 11,
      completed: 8,
      failed: 2,
      running: 1,
      avgResponseSeconds: 6.9,
      toolsUsed: 44,
      missions: 5,
    },
    memory: [
      "Portal regression blocked on APEX fixtures",
      "Destructive suite requires operator approval",
      "Release 4.2 cutoff is 18:00",
    ],
  },

  orion: {
    codename: "ORN-04",
    description: "Data analysis, metrics and reporting.",
    registeredAt: "2026-06-01T09:16:00.000Z",
    capabilities: [
      cap("Data Analysis"),
      cap("Metrics"),
      cap("Reporting"),
      cap("Forecasting"),
      cap("Visualisation"),
    ],
    tools: [
      tool("Time", true, "Read the current UTC time"),
      tool("Calculator", true, "Evaluate an arithmetic expression"),
      tool("Query", true, "Read analytical stores"),
      tool("Charting", true, "Render report figures"),
      tool("Document Index", true, "Locate prior reports"),
      tool("Terminal", false, "Shell access"),
      tool("Git", false, "Repository writes"),
    ],
    config: {
      model: "Claude",
      temperature: 0.2,
      maxContext: "128K",
      autonomy: "semi-autonomous",
    },
    telemetry: {
      tasksToday: 5,
      completed: 5,
      failed: 0,
      running: 0,
      avgResponseSeconds: 4.1,
      toolsUsed: 18,
      missions: 2,
    },
    memory: [
      "Weekly throughput report delivered 09:21",
      "Agent utilisation trending up 12% week over week",
    ],
  },

  sentinel: {
    codename: "SNT-05",
    description:
      "Security analysis, permissions, vulnerabilities and risk review.",
    registeredAt: "2026-06-01T09:20:00.000Z",
    capabilities: [
      cap("Security Analysis"),
      cap("Permission Audit"),
      cap("Vulnerability Review"),
      cap("Risk Assessment"),
      cap("Egress Monitoring"),
    ],
    tools: [
      tool("Time", true, "Read the current UTC time"),
      tool("Calculator", true, "Evaluate an arithmetic expression"),
      tool("Scanner", true, "Sweep nodes and endpoints"),
      tool("Permission Audit", true, "Inspect access grants"),
      tool("Code", true, "Review sources for exposure"),
      tool("Terminal", true, "Run audit tooling"),
      tool("Web Search", false, "External lookups"),
    ],
    config: {
      model: "Claude",
      temperature: 0.1,
      maxContext: "128K",
      autonomy: "supervised",
    },
    telemetry: {
      tasksToday: 8,
      completed: 6,
      failed: 0,
      running: 2,
      avgResponseSeconds: 9.7,
      toolsUsed: 29,
      missions: 3,
    },
    memory: [
      "Egress scan clean across 42 monitored nodes",
      "Auth permission audit in progress",
      "No outstanding critical advisories",
    ],
  },

  cipher: {
    codename: "CPH-06",
    description:
      "CI/CD, deployments, infrastructure and system operations.",
    registeredAt: "2026-06-01T09:24:00.000Z",
    capabilities: [
      cap("CI/CD"),
      cap("Deployments"),
      cap("Infrastructure"),
      cap("Secret Rotation"),
      cap("Incident Response"),
    ],
    tools: [
      tool("Time", true, "Read the current UTC time"),
      tool("Calculator", true, "Evaluate an arithmetic expression"),
      tool("Terminal", true, "Operate infrastructure"),
      tool("Deploy", true, "Promote builds"),
      tool("Vault", false, "Blocked — lease expired"),
      tool("Git", true, "Tag and release"),
      tool("Scanner", true, "Node health checks"),
    ],
    config: {
      model: "Claude",
      temperature: 0.1,
      maxContext: "128K",
      autonomy: "supervised",
    },
    telemetry: {
      tasksToday: 6,
      completed: 3,
      failed: 1,
      running: 1,
      avgResponseSeconds: 5.3,
      toolsUsed: 22,
      missions: 2,
    },
    memory: [
      "Vault lease expired at 15:30 — rotation halted",
      "42 edge nodes still on previous credentials",
      "Last successful deployment: 14:02",
    ],
  },
};

/**
 * Mock relationship graph.
 *
 * Every agent reports to HERMES; the remaining edges describe the current
 * authentication-investigation scenario. No real channel exists between
 * agents — these are drawn, not transmitted.
 */
export const AGENT_RELATIONS: AgentRelation[] = [
  { fromAgentId: "apex", toAgentId: "hermes", kind: "reports-to" },
  { fromAgentId: "nova", toAgentId: "hermes", kind: "reports-to" },
  { fromAgentId: "atlas", toAgentId: "hermes", kind: "reports-to" },
  { fromAgentId: "orion", toAgentId: "hermes", kind: "reports-to" },
  { fromAgentId: "sentinel", toAgentId: "hermes", kind: "reports-to" },
  { fromAgentId: "cipher", toAgentId: "hermes", kind: "reports-to" },

  {
    fromAgentId: "hermes",
    toAgentId: "apex",
    kind: "delegated",
    label: "AUTH INVESTIGATION",
    active: true,
  },
  {
    fromAgentId: "hermes",
    toAgentId: "nova",
    kind: "delegated",
    label: "PRIOR ART REVIEW",
    active: true,
  },
  {
    fromAgentId: "atlas",
    toAgentId: "apex",
    kind: "waiting-on",
    label: "REGRESSION RESULTS",
    active: true,
  },
  {
    fromAgentId: "nova",
    toAgentId: "apex",
    kind: "supporting",
    label: "AUTH PATTERNS",
    active: true,
  },
  {
    fromAgentId: "sentinel",
    toAgentId: "apex",
    kind: "supporting",
    label: "PERMISSION AUDIT",
    active: true,
  },
  {
    fromAgentId: "cipher",
    toAgentId: "sentinel",
    kind: "collaborates",
    label: "CREDENTIAL ROTATION",
  },
];

export function getAgentDetail(id: string): AgentDetailRecord | undefined {
  return AGENT_DETAILS[id];
}

export function getAgentRelations(): AgentRelation[] {
  return AGENT_RELATIONS;
}

/** Every relation touching `agentId`, in either direction. */
export function relationsForAgent(agentId: string): AgentRelation[] {
  return AGENT_RELATIONS.filter(
    (r) => r.fromAgentId === agentId || r.toAgentId === agentId,
  );
}
