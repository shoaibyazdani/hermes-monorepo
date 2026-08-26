import type {
  EventSeverity,
  MissionPriority,
  MissionStatus,
  OperationEventType,
  StatusTone,
  TaskStatus,
} from "../types";

/**
 * Presentation for operational events, mission states and task states.
 *
 * One table per concept, defined here rather than inside components, so a new
 * event type is a single edit and no screen can drift from another.
 *
 * Every entry carries a glyph AND a label as well as colour — status is never
 * communicated by colour alone.
 */

export interface EventVisual {
  /** Single-character marker for the timeline spine. */
  glyph: string;
  /** Uppercase category label. */
  label: string;
  text: string;
  marker: string;
}

export const EVENT_VISUALS: Record<OperationEventType, EventVisual> = {
  "mission-created": {
    glyph: "+",
    label: "MISSION",
    text: "text-ink-mute",
    marker: "border-hud-cyan/50",
  },
  "mission-started": {
    glyph: "▶",
    label: "MISSION",
    text: "text-ink-mute",
    marker: "border-hud-cyan/70",
  },
  "mission-completed": {
    glyph: "✓",
    label: "MISSION",
    text: "text-ink-mute",
    marker: "border-hud-green/70",
  },
  "task-assigned": {
    glyph: "→",
    label: "ASSIGNED",
    text: "text-ink-mute",
    marker: "border-hud-cyan/60",
  },
  "task-started": {
    glyph: "▸",
    label: "TASK",
    text: "text-ink-mute",
    marker: "border-hud-cyan/60",
  },
  "task-completed": {
    glyph: "✓",
    label: "TASK",
    text: "text-ink-mute",
    marker: "border-hud-green/60",
  },
  "agent-working": {
    glyph: "●",
    label: "WORKING",
    text: "text-ink-mute",
    marker: "border-hud-green/60",
  },
  "agent-waiting": {
    glyph: "◌",
    label: "WAITING",
    text: "text-hud-amber",
    marker: "border-hud-amber/60",
  },
  "agent-blocked": {
    glyph: "!",
    label: "BLOCKED",
    text: "text-hud-amber",
    marker: "border-hud-amber/70",
  },
  "agent-completed": {
    glyph: "✓",
    label: "COMPLETE",
    text: "text-ink-mute",
    marker: "border-hud-green/60",
  },
  "agent-error": {
    glyph: "×",
    label: "ERROR",
    text: "text-hud-red",
    marker: "border-hud-red/70",
  },
  "tool-started": {
    glyph: "▸",
    label: "TOOL",
    text: "text-ink-mute",
    marker: "border-hud-muted/60",
  },
  "tool-completed": {
    glyph: "✓",
    label: "TOOL",
    text: "text-ink-mute",
    marker: "border-hud-muted/60",
  },
  "agent-message": {
    glyph: "◈",
    label: "MESSAGE",
    text: "text-ink-mute",
    marker: "border-hud-cyan/60",
  },
  delegation: {
    glyph: "⇢",
    label: "DELEGATION",
    text: "text-ink-mute",
    marker: "border-hud-cyan/70",
  },
  handoff: {
    glyph: "⇥",
    label: "HANDOFF",
    text: "text-ink-mute",
    marker: "border-hud-cyan/70",
  },
  system: {
    glyph: "·",
    label: "SYSTEM",
    text: "text-ink-faint",
    marker: "border-hud-muted/40",
  },
};

export function eventVisual(type: OperationEventType): EventVisual {
  return EVENT_VISUALS[type] ?? EVENT_VISUALS.system;
}

/** Severity overrides the type's tint when the event went wrong. */
export const SEVERITY_TEXT: Record<EventSeverity, string | null> = {
  info: null,
  success: null,
  warn: "text-hud-amber",
  error: "text-hud-red",
};

/* ── Mission status ─────────────────────────────────────────────────────── */

export interface MissionStatusVisual {
  label: string;
  tone: StatusTone;
  /** True while the mission is progressing under its own power. */
  live: boolean;
  text: string;
  bg: string;
  border: string;
}

export const MISSION_STATUS: Record<MissionStatus, MissionStatusVisual> = {
  queued: {
    label: "QUEUED",
    tone: "neutral",
    live: false,
    text: "text-hud-muted",
    bg: "bg-hud-muted/10",
    border: "border-hud-muted/30",
  },
  planning: {
    label: "PLANNING",
    tone: "info",
    live: true,
    text: "text-hud-cyan",
    bg: "bg-hud-cyan/10",
    border: "border-hud-cyan/40",
  },
  active: {
    label: "ACTIVE",
    tone: "active",
    live: true,
    text: "text-hud-green",
    bg: "bg-hud-green/10",
    border: "border-hud-green/40",
  },
  waiting: {
    label: "WAITING",
    tone: "warn",
    live: false,
    text: "text-hud-amber",
    bg: "bg-hud-amber/10",
    border: "border-hud-amber/40",
  },
  blocked: {
    label: "BLOCKED",
    tone: "warn",
    live: false,
    text: "text-hud-amber",
    bg: "bg-hud-amber/10",
    border: "border-hud-amber/45",
  },
  completed: {
    label: "COMPLETED",
    tone: "active",
    live: false,
    text: "text-hud-green",
    bg: "bg-hud-green/10",
    border: "border-hud-green/30",
  },
  failed: {
    label: "FAILED",
    tone: "critical",
    live: false,
    text: "text-hud-red",
    bg: "bg-hud-red/10",
    border: "border-hud-red/40",
  },
  cancelled: {
    label: "CANCELLED",
    tone: "neutral",
    live: false,
    text: "text-ink-ghost",
    bg: "bg-hud-muted/5",
    border: "border-hud-muted/20",
  },
  paused: {
    label: "PAUSED",
    tone: "neutral",
    live: false,
    text: "text-hud-muted",
    bg: "bg-hud-muted/10",
    border: "border-hud-muted/30",
  },
  review: {
    label: "REVIEW",
    tone: "info",
    live: false,
    text: "text-hud-cyan",
    bg: "bg-hud-cyan/10",
    border: "border-hud-cyan/40",
  },
};

export function missionStatusVisual(status: MissionStatus): MissionStatusVisual {
  return MISSION_STATUS[status] ?? MISSION_STATUS.queued;
}

/** Missions still under way — what the operational screens lead with. */
export function isMissionOpen(status: MissionStatus): boolean {
  return !["completed", "failed", "cancelled"].includes(status);
}

/* ── Mission priority ───────────────────────────────────────────────────── */

/**
 * Priority styling.
 *
 * Only `critical` gets a strong treatment; everything else stays neutral so
 * the interface does not read as uniformly alarming.
 */
export const PRIORITY_VISUAL: Record<
  MissionPriority,
  { label: string; text: string; emphatic: boolean }
> = {
  low: { label: "LOW", text: "text-ink-ghost", emphatic: false },
  normal: { label: "NORM", text: "text-ink-faint", emphatic: false },
  high: { label: "HIGH", text: "text-hud-amber", emphatic: false },
  critical: { label: "CRIT", text: "text-hud-red", emphatic: true },
};

/* ── Task status ────────────────────────────────────────────────────────── */

export const TASK_STATUS: Record<
  TaskStatus,
  { label: string; glyph: string; text: string; tone: StatusTone }
> = {
  pending: {
    label: "PENDING",
    glyph: "○",
    text: "text-ink-ghost",
    tone: "neutral",
  },
  active: {
    label: "ACTIVE",
    glyph: "●",
    text: "text-hud-green",
    tone: "active",
  },
  blocked: {
    label: "BLOCKED",
    glyph: "!",
    text: "text-hud-amber",
    tone: "warn",
  },
  completed: {
    label: "DONE",
    glyph: "✓",
    text: "text-hud-green",
    tone: "active",
  },
  failed: { label: "FAILED", glyph: "×", text: "text-hud-red", tone: "critical" },
  cancelled: {
    label: "CANCELLED",
    glyph: "–",
    text: "text-ink-ghost",
    tone: "neutral",
  },
};

export function taskStatusVisual(status: TaskStatus) {
  return TASK_STATUS[status] ?? TASK_STATUS.pending;
}
