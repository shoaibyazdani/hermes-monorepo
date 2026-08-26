"use client";

import { cn } from "@/lib/utils";
import { eventVisual, SEVERITY_TEXT } from "@/lib/operations/event-visuals";
import { formatClock } from "@/lib/format";
import type { OperationEvent } from "@/lib/types";

interface EventStreamProps {
  events: OperationEvent[];
  /** Resolves an agent id to a display name. */
  agentName?: (id: string) => string | undefined;
  limit?: number;
  /** Highlights rows involving this agent. */
  highlightAgentId?: string | null;
  onSelect?: (event: OperationEvent) => void;
  className?: string;
  emptyMessage?: string;
}

/**
 * EventStream — the operational timeline.
 *
 * Rows are typed by `OperationEventType` through the shared visual table, so a
 * delegation reads differently from a tool call without any styling decided
 * here. Severity only overrides the tint when something went wrong.
 *
 * Directed events (delegation, handoff, waiting-on) render `SOURCE → TARGET`
 * so the flow between agents is legible without opening anything.
 */
export function EventStream({
  events,
  agentName,
  limit,
  highlightAgentId,
  onSelect,
  className,
  emptyMessage = "No operational events recorded.",
}: EventStreamProps) {
  const shown = limit ? events.slice(0, limit) : events;

  if (shown.length === 0) {
    return <p className={cn("t-meta py-4", className)}>{emptyMessage}</p>;
  }

  const name = (id: string) => agentName?.(id) ?? id.toUpperCase();

  return (
    <ol className={cn("relative", className)}>
      <span
        aria-hidden
        className="absolute bottom-3 left-[7px] top-3 w-px bg-line-soft"
      />

      {shown.map((event) => {
        const visual = eventVisual(event.type);
        const severityText = SEVERITY_TEXT[event.severity];
        const highlighted =
          Boolean(highlightAgentId) &&
          (event.agentId === highlightAgentId ||
            event.targetAgentId === highlightAgentId);

        const row = (
          <>
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-[9px] grid h-[15px] w-[15px] place-items-center rounded-full border bg-surface-base font-data text-[9px] leading-none",
                visual.marker,
                severityText ?? visual.text,
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
                {event.agentId && (
                  <span className="font-hud text-[10px] font-bold uppercase tracking-[0.16em] text-ink-mute">
                    {name(event.agentId)}
                  </span>
                )}
                {event.targetAgentId && (
                  <>
                    <span aria-hidden className="text-[10px] text-hud-cyan">
                      →
                    </span>
                    <span className="font-hud text-[10px] font-bold uppercase tracking-[0.16em] text-hud-cyan">
                      {name(event.targetAgentId)}
                    </span>
                  </>
                )}
                <span className="font-hud text-[9px] uppercase tracking-[0.2em] text-hud-cyan/60">
                  {visual.label}
                </span>
                {event.subject && (
                  <span className="font-data text-[10px] text-ink-ghost">
                    {event.subject}
                  </span>
                )}
              </div>
              <p className={cn("t-meta mt-0.5", severityText ?? visual.text)}>
                {event.message}
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
                  highlighted
                    ? "bg-hud-cyan/[0.06]"
                    : "hover:bg-hud-cyan/[0.04]",
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
