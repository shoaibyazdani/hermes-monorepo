"use client";

import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/hud/Panel";
import { ATTENTION_SEVERITY_VISUALS } from "@/lib/agent-status";
import { formatClockShort } from "@/lib/format";
import type { AttentionItem } from "@/lib/types";

interface AttentionRequiredProps {
  items: AttentionItem[];
  /** Resolves an agent id to a display name. */
  agentName?: (id: string) => string | undefined;
  /** Opens the review surface for an item. */
  onReview?: (item: AttentionItem) => void;
  /** Locally dismisses an item. */
  onDismiss?: (item: AttentionItem) => void;
  /** CSS max-height for the item list; overflow scrolls. */
  maxBodyHeight?: string;
  stagger?: number;
  className?: string;
}

/**
 * AttentionRequired — requests blocking on the operator.
 *
 * Deliberately asymmetric: with nothing outstanding it collapses to a quiet
 * "all clear" line, and only takes on the critical panel treatment when
 * something is actually waiting. A permanently loud alert box teaches people
 * to ignore it.
 *
 * Review and dismiss are UI-only for now — there is no approval backend to
 * inform, and this must not imply an action reached an agent.
 */
export function AttentionRequired({
  items,
  agentName,
  onReview,
  onDismiss,
  maxBodyHeight,
  stagger,
  className,
}: AttentionRequiredProps) {
  if (items.length === 0) {
    return (
      <Panel
        title="Attention"
        eyebrow="ALL CLEAR"
        status="active"
        stagger={stagger}
        className={className}
      >
        <p className="t-meta py-1">
          Nothing is waiting on you. All agents are proceeding autonomously.
        </p>
      </Panel>
    );
  }

  // The most severe outstanding item sets the panel's tone.
  const worst = items.some((i) => i.severity === "critical")
    ? "critical"
    : items.some((i) => i.severity === "warn")
      ? "warn"
      : "info";

  return (
    <Panel
      title="Attention Required"
      eyebrow={`${items.length} PENDING`}
      status={worst === "critical" ? "critical" : "warn"}
      statusLive
      variant={worst === "critical" ? "critical" : "warning"}
      brackets
      stagger={stagger}
      className={className}
      footer={
        <p className="t-timestamp">
          Review and dismiss are local to this session — the approval pipeline
          lands with the Approvals route.
        </p>
      }
    >
      <ul
        className="space-y-2.5 overflow-y-auto pr-1"
        style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
      >
        {items.map((item) => {
          const visual = ATTENTION_SEVERITY_VISUALS[item.severity];
          const who = item.agentId ? agentName?.(item.agentId) : undefined;

          return (
            <li
              key={item.id}
              className={cn("clip-hud-sm border p-3", visual.bg, visual.border)}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={13}
                  strokeWidth={2}
                  className={cn("mt-0.5 flex-none", visual.text)}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={cn(
                        "font-hud text-[10px] font-bold uppercase tracking-[0.18em]",
                        visual.text,
                      )}
                    >
                      {visual.label}
                    </span>
                    {who && (
                      <span className="font-hud text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                        {who}
                      </span>
                    )}
                    <span className="t-timestamp ml-auto">
                      {formatClockShort(item.raisedAt)}
                    </span>
                  </div>

                  <p className="t-command mt-1 text-ink">{item.title}</p>

                  <div className="mt-1.5">
                    <span className="t-label">ACTION</span>
                    <p className="t-meta mt-0.5 text-ink-mute">{item.action}</p>
                  </div>

                  {item.detail && (
                    <p className="t-timestamp mt-1.5">{item.detail}</p>
                  )}

                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onReview?.(item)}
                      className="clip-hud-sm flex items-center gap-1.5 border border-hud-cyan/50 bg-hud-cyan/10 px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-hud-cyan transition-colors hover:bg-hud-cyan/20"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss?.(item)}
                      className="clip-hud-sm flex items-center gap-1.5 border border-line px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint transition-colors hover:border-hud-cyan/40 hover:text-ink-mute"
                    >
                      <Check size={11} strokeWidth={2} aria-hidden />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
