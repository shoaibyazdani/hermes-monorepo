"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/format";
import { DelegationCard } from "./DelegationCard";
import type {
  Agent,
  ChatMessage,
  ChatMessageStatus,
  ChatToolCall,
} from "@/lib/types";

/**
 * Status presentation.
 *
 * `awaiting-runtime` is the honest terminal state for this phase and reads as
 * such — not as delivered, not as success.
 */
const STATUS_UI: Record<
  ChatMessageStatus,
  { glyph: string; label: string; className: string } | null
> = {
  // A settled turn needs no annotation.
  complete: null,
  pending: { glyph: "◌", label: "THINKING", className: "text-hud-cyan" },
  streaming: { glyph: "●", label: "GENERATING", className: "text-hud-green" },
  cancelled: { glyph: "■", label: "CANCELLED", className: "text-ink-faint" },
  "awaiting-runtime": {
    glyph: "◌",
    label: "AWAITING RUNTIME",
    className: "text-hud-amber",
  },
  error: { glyph: "⚠", label: "DELIVERY ERROR", className: "text-hud-red" },
};

/** UTC calendar day, so grouping matches the timestamps rendered beside it. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(key: string, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return "TODAY";
  if (key === yesterdayKey) return "YESTERDAY";
  return key;
}

interface ChatTimelineProps {
  agent: Agent;
  messages: ChatMessage[];
  /** Re-runs a failed assistant turn. Absent when retry is unavailable. */
  onRetry?: (messageId: string) => void;
  className?: string;
  emptyMessage?: string;
}

/**
 * ChatTimeline — the conversation transcript.
 *
 * A terminal-style log rather than a messaging app: no bubbles, no avatars per
 * turn. Speaker identity is a HUD label, the body is plain text on the panel
 * surface, and date separators break the stream into readable sections.
 */
export function ChatTimeline({
  agent,
  messages,
  onRetry,
  className,
  emptyMessage = "No messages in this channel yet.",
}: ChatTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Follow the tail on new messages AND while text streams in, so a growing
  // response stays in view without the operator scrolling.
  const tailLength = messages[messages.length - 1]?.body.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, tailLength]);

  // Computed on the client only; the reference day must not differ between
  // server and client render.
  const { todayKey, yesterdayKey } = useMemo(() => {
    const now = new Date();
    const yest = new Date(now.getTime() - 86_400_000);
    return {
      todayKey: now.toISOString().slice(0, 10),
      yesterdayKey: yest.toISOString().slice(0, 10),
    };
  }, []);

  const groups = useMemo(() => {
    const out: Array<{ key: string; messages: ChatMessage[] }> = [];
    for (const m of messages) {
      const key = dayKey(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.messages.push(m);
      else out.push({ key, messages: [m] });
    }
    return out;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={cn("hud-well flex-1 overflow-y-auto p-4", className)}>
        <p className="t-meta py-8 text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("hud-well flex-1 overflow-y-auto p-3", className)}
      role="log"
      aria-label={`${agent.name} conversation transcript`}
    >
      {groups.map((group) => (
        <section key={group.key} className="mb-4 last:mb-0">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="t-label flex-none">
              {dayLabel(group.key, todayKey, yesterdayKey)}
            </span>
            <span aria-hidden className="hud-rule flex-1" />
          </div>

          <ul className="space-y-3">
            {group.messages.map((m) => {
              const status = STATUS_UI[m.status];
              const isOperator = m.role === "operator";
              return (
                <li key={m.id}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={cn(
                        "font-hud text-[10px] font-bold uppercase tracking-[0.18em]",
                        isOperator ? "text-hud-cyan" : "text-ink-mute",
                      )}
                    >
                      {isOperator ? "YOU" : agent.name}
                    </span>
                    <time
                      dateTime={m.createdAt}
                      className="t-timestamp"
                      suppressHydrationWarning
                    >
                      {formatClock(m.createdAt)}
                    </time>
                    {status && (
                      <span
                        className={cn(
                          "flex items-center gap-1 font-hud text-[9px] font-semibold uppercase tracking-[0.16em]",
                          status.className,
                        )}
                      >
                        <span aria-hidden>{status.glyph}</span>
                        {status.label}
                      </span>
                    )}
                  </div>

                  {/* Delegations sit above the answer for the same reason as
                      tools: the work happened first, and it is what licenses
                      what the synthesis claims. */}
                  {m.delegations && m.delegations.length > 0 && (
                    <div className="mt-2">
                      <p className="t-label mb-1.5">
                        DELEGATED — {m.delegations.length}{" "}
                        {m.delegations.length === 1 ? "AGENT" : "AGENTS"}
                        {m.simulated && (
                          <span className="ml-1.5 text-hud-amber">
                            · SIMULATION
                          </span>
                        )}
                      </p>
                      <ul className="space-y-1.5">
                        {m.delegations.map((d) => (
                          <li key={d.stepId}>
                            <DelegationCard delegation={d} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tool activity sits above the text: it happened first,
                      and it is what licenses any claim the text makes. */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {m.toolCalls.map((t) => (
                        <li key={t.id}>
                          <ToolBlock call={t} />
                        </li>
                      ))}
                    </ul>
                  )}

                  {(m.body || m.status === "streaming") && (
                    <p
                      className={cn(
                        "t-chat mt-1 whitespace-pre-wrap",
                        isOperator ? "text-ink" : "text-ink-mute",
                        // A left rule marks operator turns without resorting to
                        // a bubble; it reads as a command entry in a log.
                        isOperator && "border-l-2 border-hud-cyan/40 pl-2.5",
                      )}
                    >
                      {m.body}
                      {m.status === "streaming" && (
                        <span
                          aria-hidden
                          className="ml-0.5 inline-block animate-blink-cursor text-hud-green"
                        >
                          ▋
                        </span>
                      )}
                    </p>
                  )}

                  {/* Awaiting-runtime turns get an explicit system note so the
                      operator is never left inferring what happened. */}
                  {m.status === "awaiting-runtime" && (
                    <p className="t-timestamp mt-1 pl-2.5">
                      LOCAL COMMAND QUEUED — {agent.name} has no runtime
                      attached, so no response will arrive.
                    </p>
                  )}

                  {m.status === "cancelled" && (
                    <p className="t-timestamp mt-1">
                      Stopped by operator. The response is incomplete.
                    </p>
                  )}

                  {m.status === "error" && (
                    <div className="mt-1.5 border-l-2 border-hud-red/50 pl-2.5">
                      <p className="t-meta text-hud-red">
                        {m.errorMessage ?? "The agent run failed."}
                      </p>
                      {onRetry && (
                        <button
                          type="button"
                          onClick={() => onRetry(m.id)}
                          className="clip-hud-sm mt-1.5 border border-line px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div ref={endRef} />
    </div>
  );
}

/**
 * ToolBlock — one tool invocation, compactly.
 *
 * Shows what ran, whether it succeeded and how long it took. Inputs and raw
 * outputs are deliberately omitted: they are model-facing detail, and a failed
 * call is more useful as "failed" than as a stack of internals.
 */
function ToolBlock({ call }: { call: ChatToolCall }) {
  const running = call.status === "running";
  const failed = call.status === "failed";

  return (
    <div
      className={cn(
        "clip-hud-sm flex items-center gap-2 border px-2 py-1",
        failed
          ? "border-hud-red/40 bg-hud-red/[0.06]"
          : running
            ? "border-hud-cyan/40 bg-hud-cyan/[0.06]"
            : "border-line-soft bg-surface-inset",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "font-data text-[10px]",
          failed ? "text-hud-red" : running ? "text-hud-cyan" : "text-hud-green",
        )}
      >
        {failed ? "×" : running ? "◌" : "✓"}
      </span>
      <span className="font-hud text-[9px] font-bold uppercase tracking-[0.16em] text-ink">
        {call.toolName}
      </span>
      <span
        className={cn(
          "font-hud text-[9px] uppercase tracking-[0.14em]",
          failed ? "text-hud-red" : running ? "text-hud-cyan" : "text-ink-faint",
        )}
      >
        {running ? "running" : failed ? "failed" : "completed"}
      </span>
      {call.summary && (
        <span className="t-timestamp min-w-0 flex-1 truncate">
          {call.summary}
        </span>
      )}
      {typeof call.durationMs === "number" && !running && (
        <span className="t-timestamp ml-auto flex-none tabular-nums">
          {(call.durationMs / 1000).toFixed(2)}s
        </span>
      )}
    </div>
  );
}
