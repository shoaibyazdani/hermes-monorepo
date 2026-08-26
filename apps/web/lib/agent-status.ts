import type {
  Agent,
  ActivityKind,
  ActivityLevel,
  AgentStatus,
  AgentRelationKind,
  AttentionSeverity,
  CoreState,
  MetricTone,
  MissionStatus,
  StatusTone,
} from "./types";

/**
 * Single source of truth for how a state is rendered.
 *
 * Every agent-facing component (dot, avatar, badge, card, radar) reads its
 * colours from here, so a status only has to be defined once. Colours are
 * expressed as Tailwind classes bound to the semantic tokens in globals.css.
 */
export interface StatusVisual {
  /** Uppercase display label. */
  label: string;
  tone: StatusTone;
  /** Text colour class. */
  text: string;
  /** Background tint class for badges/pills. */
  bg: string;
  /** Border colour class. */
  border: string;
  /** Raw CSS colour, for SVG fills and box-shadows. */
  css: string;
  /** True when the state represents live, ongoing work (drives pulse). */
  live: boolean;
}

export const AGENT_STATUS_VISUALS: Record<AgentStatus, StatusVisual> = {
  idle: {
    label: "IDLE",
    tone: "neutral",
    text: "text-hud-muted",
    bg: "bg-hud-muted/10",
    border: "border-hud-muted/30",
    css: "var(--status-neutral)",
    live: false,
  },
  listening: {
    label: "LISTENING",
    tone: "info",
    text: "text-hud-cyan",
    bg: "bg-hud-cyan/10",
    border: "border-hud-cyan/40",
    css: "var(--status-info)",
    live: true,
  },
  thinking: {
    label: "THINKING",
    tone: "info",
    text: "text-hud-cyan",
    bg: "bg-hud-cyan/10",
    border: "border-hud-cyan/40",
    css: "var(--status-info)",
    live: true,
  },
  working: {
    label: "WORKING",
    tone: "active",
    text: "text-hud-green",
    bg: "bg-hud-green/10",
    border: "border-hud-green/40",
    css: "var(--status-active)",
    live: true,
  },
  waiting: {
    label: "WAITING",
    tone: "warn",
    text: "text-hud-amber",
    bg: "bg-hud-amber/10",
    border: "border-hud-amber/40",
    css: "var(--status-warn)",
    live: false,
  },
  blocked: {
    label: "BLOCKED",
    tone: "warn",
    text: "text-hud-amber",
    bg: "bg-hud-amber/10",
    border: "border-hud-amber/40",
    css: "var(--status-warn)",
    live: false,
  },
  completed: {
    label: "COMPLETED",
    tone: "active",
    text: "text-hud-green",
    bg: "bg-hud-green/10",
    border: "border-hud-green/30",
    css: "var(--status-active)",
    live: false,
  },
  error: {
    label: "ERROR",
    tone: "critical",
    text: "text-hud-red",
    bg: "bg-hud-red/10",
    border: "border-hud-red/40",
    css: "var(--status-critical)",
    live: true,
  },
  offline: {
    label: "OFFLINE",
    tone: "neutral",
    text: "text-hud-muted/60",
    bg: "bg-hud-muted/5",
    border: "border-hud-muted/20",
    css: "var(--status-offline)",
    live: false,
  },
};

export function agentStatusVisual(status: AgentStatus): StatusVisual {
  return AGENT_STATUS_VISUALS[status] ?? AGENT_STATUS_VISUALS.offline;
}

/** Legacy `/api/agents` statuses → the richer `AgentStatus` union. */
const LEGACY_STATUS_MAP: Record<string, AgentStatus> = {
  working: "working",
  idle: "idle",
  sleeping: "offline",
  error: "error",
  ready: "listening",
};

export function normalizeAgentStatus(raw: string): AgentStatus {
  if (raw in AGENT_STATUS_VISUALS) return raw as AgentStatus;
  return LEGACY_STATUS_MAP[raw] ?? "idle";
}

/*
 * Mission status presentation lives in `lib/operations/event-visuals`.
 *
 * It moved there when the operational model gained `planning` and `cancelled`:
 * keeping a second table here guaranteed the two would drift, and mission
 * status is an operational concept rather than an agent one.
 */

export const METRIC_TONE_CLASS: Record<MetricTone, string> = {
  nominal: "text-hud-green",
  elevated: "text-hud-amber",
  critical: "text-hud-red",
};

export const METRIC_TONE_BAR: Record<MetricTone, string> = {
  nominal: "bg-hud-green",
  elevated: "bg-hud-amber",
  critical: "bg-hud-red",
};

/* ── Activity events ────────────────────────────────────────────────────── */

/**
 * Visual treatment per event kind.
 *
 * `kind` says what happened; `level` says how severe. A delegation and a tool
 * call are both informational but must read differently in the timeline, so
 * the glyph and colour come from here.
 */
export interface ActivityVisual {
  /** Single-character marker drawn on the timeline spine. */
  glyph: string;
  /** Text colour for the message. */
  text: string;
  /** Border colour for the spine marker. */
  marker: string;
  /** Uppercase label for the event category. */
  label: string;
}

export const ACTIVITY_KIND_VISUALS: Record<ActivityKind, ActivityVisual> = {
  info: {
    glyph: "·",
    text: "text-ink-mute",
    marker: "border-hud-cyan/50",
    label: "INFO",
  },
  success: {
    glyph: "✓",
    text: "text-ink-mute",
    marker: "border-hud-green/60",
    label: "DONE",
  },
  warning: {
    glyph: "!",
    text: "text-hud-amber",
    marker: "border-hud-amber/60",
    label: "WARN",
  },
  error: {
    glyph: "×",
    text: "text-hud-red",
    marker: "border-hud-red/70",
    label: "ERROR",
  },
  delegation: {
    glyph: "→",
    text: "text-ink-mute",
    marker: "border-hud-cyan/70",
    label: "DELEGATE",
  },
  tool: {
    glyph: "▸",
    text: "text-ink-mute",
    marker: "border-hud-muted/60",
    label: "TOOL",
  },
  thinking: {
    glyph: "◇",
    text: "text-ink-mute",
    marker: "border-hud-cyan/40",
    label: "ANALYSIS",
  },
  file: {
    glyph: "◻",
    text: "text-ink-mute",
    marker: "border-hud-muted/60",
    label: "FILE",
  },
  command: {
    glyph: "$",
    text: "text-ink-mute",
    marker: "border-hud-muted/60",
    label: "COMMAND",
  },
  communication: {
    glyph: "◈",
    text: "text-ink-mute",
    marker: "border-hud-cyan/60",
    label: "COMMS",
  },
  mission: {
    glyph: "◆",
    text: "text-ink-mute",
    marker: "border-hud-cyan/60",
    label: "MISSION",
  },
  system: {
    glyph: "·",
    text: "text-ink-faint",
    marker: "border-hud-muted/40",
    label: "SYSTEM",
  },
};

/* ── Agent relationships ────────────────────────────────────────────────── */

/**
 * Visual treatment per relationship kind, used by the network graph.
 *
 * `dashed` distinguishes a pending/blocking edge from a settled one, so the
 * graph does not rely on colour alone to say what kind of link this is.
 */
export const RELATION_VISUALS: Record<
  AgentRelationKind,
  { label: string; stroke: string; text: string; dashed: boolean }
> = {
  "reports-to": {
    label: "REPORTS TO",
    stroke: "var(--border)",
    text: "text-ink-faint",
    dashed: false,
  },
  collaborates: {
    label: "COLLABORATES",
    stroke: "var(--accent-line)",
    text: "text-ink-mute",
    dashed: true,
  },
  delegated: {
    label: "DELEGATED",
    stroke: "var(--accent)",
    text: "text-hud-cyan",
    dashed: false,
  },
  "waiting-on": {
    label: "WAITING ON",
    stroke: "var(--status-warn)",
    text: "text-hud-amber",
    dashed: true,
  },
  supporting: {
    label: "SUPPORTING",
    stroke: "var(--status-active)",
    text: "text-hud-green",
    dashed: false,
  },
};

/** Fall back to the severity level when an event carries no explicit kind. */
const LEVEL_TO_KIND: Record<ActivityLevel, ActivityKind> = {
  info: "info",
  success: "success",
  warn: "warning",
  error: "error",
};

export function activityVisual(event: {
  kind?: ActivityKind;
  level: ActivityLevel;
}): ActivityVisual {
  const kind = event.kind ?? LEVEL_TO_KIND[event.level] ?? "info";
  return ACTIVITY_KIND_VISUALS[kind] ?? ACTIVITY_KIND_VISUALS.info;
}

/* ── Attention ──────────────────────────────────────────────────────────── */

export const ATTENTION_SEVERITY_VISUALS: Record<
  AttentionSeverity,
  { text: string; bg: string; border: string; tone: StatusTone; label: string }
> = {
  info: {
    text: "text-hud-cyan",
    bg: "bg-hud-cyan/[0.07]",
    border: "border-hud-cyan/40",
    tone: "info",
    label: "REVIEW",
  },
  warn: {
    text: "text-hud-amber",
    bg: "bg-hud-amber/[0.07]",
    border: "border-hud-amber/45",
    tone: "warn",
    label: "ATTENTION",
  },
  critical: {
    text: "text-hud-red",
    bg: "bg-hud-red/[0.07]",
    border: "border-hud-red/50",
    tone: "critical",
    label: "CRITICAL",
  },
};

/* ── Hermes core ────────────────────────────────────────────────────────── */

export const CORE_STATE_VISUALS: Record<
  CoreState,
  { label: string; tone: StatusTone; live: boolean }
> = {
  idle: { label: "SYSTEM READY", tone: "neutral", live: false },
  active: { label: "AGENTS ACTIVE", tone: "active", live: true },
  processing: { label: "COORDINATING", tone: "info", live: true },
  attention: { label: "ACTION REQUIRED", tone: "warn", live: true },
};

/**
 * Derive the core posture from live state.
 *
 * Precedence is deliberate: anything awaiting the operator outranks activity,
 * because an unattended request is the one thing that stalls the whole system.
 */
export function deriveCoreState(
  agents: Agent[],
  attentionCount: number,
): CoreState {
  if (attentionCount > 0) return "attention";
  const thinking = agents.some(
    (a) => a.status === "thinking" || a.status === "listening",
  );
  const working = agents.some((a) => a.status === "working");
  if (working) return "active";
  if (thinking) return "processing";
  return "idle";
}
