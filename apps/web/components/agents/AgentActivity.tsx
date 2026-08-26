"use client";

import { cn } from "@/lib/utils";
import { activityVisual } from "@/lib/agent-status";
import { formatClock } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

interface AgentActivityProps {
  events: ActivityEvent[];
  /** Resolves an agent id to a display name for attribution. */
  agentName?: (id: string) => string | undefined;
  /** Cap the number of events rendered. */
  limit?: number;
  /** Makes each row activatable — used to focus the originating agent. */
  onSelect?: (event: ActivityEvent) => void;
  /** Highlights rows belonging to this agent. */
  highlightAgentId?: string | null;
  className?: string;
  /** Message shown when there is nothing to display. */
  emptyMessage?: string;
}

/**
 * AgentActivity — the chronological event timeline.
 *
 * Each row is typed by `kind` (delegation, tool, success, error…) rather than
 * only by severity, so a hand-off reads differently from a tool call even
 * though both are informational. A single vertical rule threads the events.
 */
export function AgentActivity({
  events,
  agentName,
  limit,
  onSelect,
  highlightAgentId,
  className,
  emptyMessage = "No activity recorded.",
}: AgentActivityProps) {
  const shown = limit ? events.slice(0, limit) : events;

  if (shown.length === 0) {
    return <p className={cn("t-meta py-4", className)}>{emptyMessage}</p>;
  }

  return (
    <ol className={cn("relative", className)}>
      {/* Timeline spine */}
      <span
        aria-hidden
        className="absolute bottom-3 left-[7px] top-3 w-px bg-line-soft"
      />

      {shown.map((event) => {
        const visual = activityVisual(event);
        const who = event.agentId ? agentName?.(event.agentId) : undefined;
        const target = event.targetAgentId
          ? agentName?.(event.targetAgentId)
          : undefined;
        const highlighted =
          Boolean(highlightAgentId) && event.agentId === highlightAgentId;

        const row = (
          <>
            {/* Marker */}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-[9px] grid h-[15px] w-[15px] place-items-center rounded-full border bg-surface-base font-data text-[9px] leading-none",
                visual.marker,
                visual.text,
              )}
            >
              {visual.glyph}
            </span>

            <time
              dateTime={event.timestamp}
              className="t-timestamp w-[58px] flex-none pt-px tabular-nums"
            >
              {formatClock(event.timestamp)}
            </time>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                {who && (
                  <span className="font-hud text-[10px] font-bold uppercase tracking-[0.16em] text-ink-mute">
                    {who}
                  </span>
                )}
                <span className="font-hud text-[9px] uppercase tracking-[0.2em] text-hud-cyan/60">
                  {event.channel}
                </span>
              </div>
              <p className={cn("t-meta mt-0.5", visual.text)}>
                {event.message}
                {/* Delegation targets read as "… → APEX". */}
                {target && (
                  <span className="text-hud-cyan"> → {target}</span>
                )}
              </p>
            </div>
          </>
        );

        return (
          <li key={event.id} className="relative">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(event)}
                className={cn(
                  "flex w-full gap-3 rounded-sm py-2 pl-6 pr-1 text-left transition-colors",
                  highlighted ? "bg-hud-cyan/[0.06]" : "hover:bg-hud-cyan/[0.04]",
                )}
              >
                {row}
              </button>
            ) : (
              <div
                className={cn(
                  "flex gap-3 py-2 pl-6 pr-1",
                  highlighted && "bg-hud-cyan/[0.06]",
                )}
              >
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
