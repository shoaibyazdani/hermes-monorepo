/**
 * Hermes shared domain types.
 *
 * These describe the shapes the UI renders. Today they are satisfied by the
 * mock providers in `lib/mock/*` and the placeholder API routes; later phases
 * swap the data source without touching component code.
 */

/* ── Agents ─────────────────────────────────────────────────────────────── */

export type AgentStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "working"
  | "waiting"
  | "blocked"
  | "completed"
  | "error"
  | "offline";

/** Semantic tone used to colour a status across avatars, dots and badges. */
export type StatusTone = "neutral" | "info" | "active" | "warn" | "critical";

export type AgentDiscipline =
  | "core"
  | "engineering"
  | "research"
  | "qa"
  | "analytics"
  | "security"
  | "operations";

/** A named ability an agent possesses. Informational — nothing executes it. */
export interface AgentCapability {
  id: string;
  label: string;
}

/**
 * A tool an agent may invoke.
 *
 * `enabled` describes what the agent is permitted to reach for, not what is
 * currently running. Nothing here executes: the tool runtime is a later phase.
 */
export interface AgentTool {
  id: string;
  label: string;
  enabled: boolean;
  /** Short note on what the tool is for. */
  description?: string;
}

/** Model/runtime settings. Read-only in this phase — no editing surface yet. */
export interface AgentConfig {
  model: string;
  temperature: number;
  /** Human-readable context window, e.g. "128K". */
  maxContext: string;
  /** How much latitude the agent has to act without sign-off. */
  autonomy: "supervised" | "semi-autonomous" | "autonomous";
}

/**
 * Per-agent counters.
 *
 * Simulated. Kept in its own shape so a real metrics source can replace it
 * wholesale without touching the components that render it.
 */
export interface AgentTelemetry {
  tasksToday: number;
  completed: number;
  failed: number;
  running: number;
  /** Mean response time in seconds. */
  avgResponseSeconds: number;
  toolsUsed: number;
  missions: number;
}

/** How one agent relates to another. Mock — no real channel exists. */
export type AgentRelationKind =
  | "reports-to"
  | "collaborates"
  | "delegated"
  | "waiting-on"
  | "supporting";

export interface AgentRelation {
  fromAgentId: string;
  toAgentId: string;
  kind: AgentRelationKind;
  /** Short label shown on the connection, e.g. "REGRESSION RESULTS". */
  label?: string;
  /** True while the relationship represents live traffic. */
  active?: boolean;
}

export interface Agent {
  id: string;
  /** Display name, e.g. "APEX". */
  name: string;
  /** Formal designation, e.g. "APX-01". */
  codename?: string;
  /** Short role line, e.g. "ENGINEERING". */
  role: string;
  /** One-sentence statement of what this agent is responsible for. */
  description?: string;
  discipline: AgentDiscipline;
  status: AgentStatus;
  /** One-line description of what the agent is doing right now. */
  activity?: string;
  /** 0–100 completion of the agent's current unit of work, when known. */
  progress?: number;
  /** ISO-8601 timestamp of the last observed heartbeat. */
  lastSeen?: string;
  /** Concrete step the agent is executing, e.g. "Running Playwright". */
  currentStep?: string;
  /** ISO-8601 timestamp the current unit of work began. Drives elapsed time. */
  startedAt?: string;
  /** Mission id this agent is currently contributing to, when assigned. */
  missionId?: string;
  /**
   * The immediate task, distinct from the mission it serves and from the
   * finer-grained `currentStep`. Mission → task → step.
   */
  currentTask?: string;
  /** ISO-8601 timestamp the agent was registered on the network. */
  registeredAt?: string;
  /** Whether a command channel is currently open to this agent. */
  sessionOpen?: boolean;
  capabilities?: AgentCapability[];
  tools?: AgentTool[];
  config?: AgentConfig;
  telemetry?: AgentTelemetry;
  /** Short context lines the agent is holding. Preview only — no real memory. */
  memory?: string[];
  /** Radar placement inside the 0–400 viewBox. Optional: not all agents plot. */
  x?: number;
  y?: number;
}

/* ── Activity / events ──────────────────────────────────────────────────── */

export type ActivityLevel = "info" | "success" | "warn" | "error";

/**
 * What kind of thing happened. Distinct from `level` (how severe it is):
 * a delegation and a tool call are both "info" but read very differently.
 */
export type ActivityKind =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "delegation"
  | "tool"
  | "thinking"
  | "file"
  | "command"
  | "communication"
  | "mission"
  | "system";

export interface ActivityEvent {
  id: string;
  /** ISO-8601. Rendered as HH:MM:SS in the timeline. */
  timestamp: string;
  /** Agent id the event originated from, or null for system-level events. */
  agentId: string | null;
  /** Short uppercase channel label, e.g. "MISSION", "TOOL", "VOICE". */
  channel: string;
  message: string;
  level: ActivityLevel;
  /** Event category, drives the timeline glyph. Defaults to `level` semantics. */
  kind?: ActivityKind;
  /** Mission this event belongs to, when applicable. */
  missionId?: string;
  /** Agent the action was directed at — used by delegation events. */
  targetAgentId?: string;
  /**
   * Subject the event acted on — a tool name, file path or command.
   * Rendered as a monospace chip above the message.
   */
  subject?: string;
}

/* ── Missions ───────────────────────────────────────────────────────────── */

export type MissionStatus =
  | "queued"
  | "planning"
  | "active"
  | "waiting"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  /** Retained from earlier phases so existing records keep resolving. */
  | "paused"
  | "review";

export type MissionPriority = "low" | "normal" | "high" | "critical";

/* ── Tasks ──────────────────────────────────────────────────────────────── */

export type TaskStatus =
  | "pending"
  | "active"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * A unit of work inside a mission.
 *
 * Sits between the mission (the objective) and the step (what is happening
 * right now): mission → task → step. Keeping the three distinct matters once
 * a real runtime drives them, because they change at different rates.
 */
export interface MissionTask {
  id: string;
  missionId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  /** Agent responsible. Null while unassigned. */
  assignedAgentId: string | null;
  /** Task ids that must complete before this one can start. */
  dependencies: string[];
  /** The finest-grained detail: what the agent is doing inside this task. */
  currentStep?: string;
  startedAt?: string;
  completedAt?: string;
  /** Why the task cannot proceed, when blocked. */
  blockedReason?: string;
}

export interface Mission {
  id: string;
  /** Short human-readable code, e.g. "OPS-1042". */
  code: string;
  title: string;
  /** One-line statement of the objective. */
  description?: string;
  status: MissionStatus;
  priority: MissionPriority;
  /** Agent ids assigned to this mission. First entry is the lead by default. */
  assignedAgentIds: string[];
  /** Agent leading the mission. Falls back to `assignedAgentIds[0]`. */
  leadAgentId?: string;
  /** Agents supporting the lead. */
  supportingAgentIds?: string[];
  /** 0–100. Derived from task completion once tasks exist. */
  progress: number;
  /** Current stage, e.g. "REGRESSION VALIDATION". */
  phase?: string;
  /** Id of the task currently in flight, when there is one. */
  currentTaskId?: string;
  createdAt?: string;
  startedAt: string;
  /** ISO-8601 of the most recent event on this mission. */
  lastActivityAt?: string;
  /** Present once the mission reaches a terminal state. */
  completedAt?: string;
  /** True when the mission needs an operator decision. */
  attentionRequired?: boolean;
  /** Why the mission cannot proceed, when blocked. */
  blockedReason?: string;
}

/* ── Operational events ─────────────────────────────────────────────────── */

/**
 * What kind of operational thing happened.
 *
 * Centralised so presentation is defined once (`lib/operations/event-visuals`)
 * rather than re-derived in each component. A real runtime will emit these
 * same discriminators.
 */
export type OperationEventType =
  | "mission-created"
  | "mission-started"
  | "mission-completed"
  | "task-assigned"
  | "task-started"
  | "task-completed"
  | "agent-working"
  | "agent-waiting"
  | "agent-blocked"
  | "agent-completed"
  | "agent-error"
  | "tool-started"
  | "tool-completed"
  | "agent-message"
  | "delegation"
  | "handoff"
  | "system";

export type EventSeverity = "info" | "success" | "warn" | "error";

/**
 * One entry in the operational event stream.
 *
 * Shaped to be receivable from a future WebSocket/SSE feed without change:
 * everything a consumer needs to place the event (who, what, which mission,
 * which task, when) is on the record itself.
 */
export interface OperationEvent {
  id: string;
  timestamp: string;
  type: OperationEventType;
  severity: EventSeverity;
  /** Originating agent, or null for system-level events. */
  agentId: string | null;
  /** Agent the action was directed at — delegation, handoff, request. */
  targetAgentId?: string;
  missionId?: string;
  taskId?: string;
  /** Human-readable summary. */
  message: string;
  /** Tool, file or command the event acted on. */
  subject?: string;
}

/* ── System telemetry ───────────────────────────────────────────────────── */

export type MetricTone = "nominal" | "elevated" | "critical";

export interface SystemMetric {
  id: string;
  /** Short uppercase label, e.g. "CPU". */
  label: string;
  /** Numeric reading. Percent metrics use 0–100. */
  value: number;
  unit: string;
  /** Upper bound used to draw the meter. Omit for unbounded readings. */
  max?: number;
  tone: MetricTone;
  /** Recent samples, oldest → newest, for the sparkline. */
  history?: number[];
}

export interface SystemStatus {
  /** Overall system posture, drives the top-bar indicator. */
  state: "online" | "degraded" | "offline";
  agentsOnline: number;
  agentsTotal: number;
  activeMissions: number;
  /** Seconds since the runtime came up. */
  uptimeSeconds: number;
}

/* ── Voice ──────────────────────────────────────────────────────────────── */

/**
 * Presentation-level voice state. Broader than the engine-level `VoiceState`
 * in `hooks/useVoice` — it adds the states the command bar will surface once
 * transcription and routing land in a later phase.
 */
export type VoicePhase =
  | "idle"
  | "requesting"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export interface VoiceTarget {
  agentId: string | null;
  /** Display label: agent name, or "ALL" for a broadcast. */
  label: string;
}

/* ── Attention / approvals ──────────────────────────────────────────────── */

export type AttentionSeverity = "info" | "warn" | "critical";

/**
 * Something waiting on the operator.
 *
 * The Command Center surfaces these prominently only while unresolved; the
 * real approval pipeline lands with the Approvals route in a later phase.
 */
export interface AttentionItem {
  id: string;
  /** Agent that raised the request, or null for system-level prompts. */
  agentId: string | null;
  severity: AttentionSeverity;
  /** Short heading, e.g. "APEX is requesting permission". */
  title: string;
  /** The concrete action awaiting sign-off. */
  action: string;
  /** Extra context shown under the action. */
  detail?: string;
  /** Mission this request belongs to, when applicable. */
  missionId?: string;
  raisedAt: string;
}

/* ── Hermes objective ───────────────────────────────────────────────────── */

export type ObjectiveStatus = "active" | "coordinating" | "waiting" | "idle";

/**
 * What Hermes itself is coordinating.
 *
 * Distinct from a `Mission` (a unit of work) and from an agent's task: this is
 * the orchestrator's own current focus.
 */
export interface Objective {
  id: string;
  /** e.g. "Coordinate authentication investigation". */
  title: string;
  status: ObjectiveStatus;
  leadAgentId: string | null;
  supportAgentIds: string[];
  /** Mission the objective is driving, when there is one. */
  missionId?: string;
  startedAt: string;
}

/* ── Aggregate counters ─────────────────────────────────────────────────── */

/** Glanceable activity level for the whole system. */
export interface SystemCounters {
  eventsToday: number;
  missions: number;
  completed: number;
  errors: number;
}

/* ── Core state ─────────────────────────────────────────────────────────── */

/**
 * Overall posture of the Hermes core, derived from agents and attention items
 * by `deriveCoreState` rather than stored — there is one rule for it.
 */
export type CoreState = "idle" | "active" | "processing" | "attention";

/* ── Command Center composite ───────────────────────────────────────────── */

/**
 * Everything the Command Center renders, in one shape.
 *
 * `useCommandCenter` produces this from the mock providers plus the live
 * `/api/agents` roster. A later phase swaps the source; the shape is the
 * contract between the data layer and the page.
 */
export interface CommandCenterState {
  agents: Agent[];
  missions: Mission[];
  activity: ActivityEvent[];
  metrics: SystemMetric[];
  systemStatus: SystemStatus;
  attentionItems: AttentionItem[];
  currentObjective: Objective | null;
  counters: SystemCounters;
}

/* ── Conversation ───────────────────────────────────────────────────────── */

export type ChatRole = "operator" | "agent" | "system";

/**
 * Delivery state of a single turn.
 *
 * `awaiting-runtime` is the honest terminal state for an operator message in
 * this phase: it was stored locally and addressed to an agent, but no runtime
 * exists to execute it. It is deliberately not "delivered" or "complete".
 */
export type ChatMessageStatus =
  | "complete"
  | "pending"
  /** Assistant text is arriving incrementally. */
  | "streaming"
  /** Stored and addressed, but no runtime exists to execute it. */
  | "awaiting-runtime"
  | "error"
  | "cancelled";

/**
 * One turn in an agent conversation.
 *
 * Extensible on purpose: `kind` currently only ever holds "text", but tool
 * calls, reasoning traces, attachments and agent-to-agent turns will each add
 * a variant without changing the shape consumers already read.
 */
export interface ChatMessage {
  id: string;
  /** Conversation this turn belongs to. */
  conversationId: string;
  /** Agent whose channel this is — never inferred from context. */
  agentId: string;
  role: ChatRole;
  /** Message text. Named `body` to match the rest of the codebase. */
  body: string;
  createdAt: string;
  status: ChatMessageStatus;
  /** Discriminator reserved for future message variants. */
  kind?: "text";
  /** Run that produced this message, for retry and telemetry. */
  runId?: string;
  /** Safe error text when `status` is "error". Never provider internals. */
  errorMessage?: string;
  /** Tool activity shown inline beneath the message. */
  toolCalls?: ChatToolCall[];
}

/** A tool invocation surfaced in the transcript. */
export interface ChatToolCall {
  id: string;
  toolId: string;
  toolName: string;
  status: "running" | "completed" | "failed";
  durationMs?: number;
  /** Short display summary. Never raw internals. */
  summary?: string;
}

/**
 * A conversation belongs to exactly one agent.
 *
 * `agentId` is stored on both the conversation and every message so a turn can
 * never be mis-attributed, even if a conversation record is lost or a message
 * is read in isolation.
 */
export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
