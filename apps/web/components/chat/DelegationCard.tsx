"use client";

import Link from "next/link";
import type { Route } from "next";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import { agentHref } from "@/lib/navigation";
import type { ChatDelegation, StatusTone } from "@/lib/types";

const STATUS_UI: Record<
  ChatDelegation["status"],
  { glyph: string; label: string; tone: StatusTone; text: string; live: boolean }
> = {
  queued: {
    glyph: "○",
    label: "QUEUED",
    tone: "neutral",
    text: "text-ink-faint",
    live: false,
  },
  running: {
    glyph: "◌",
    label: "WORKING",
    tone: "active",
    text: "text-hud-green",
    live: true,
  },
  completed: {
    glyph: "✓",
    label: "COMPLETED",
    tone: "active",
    text: "text-hud-green",
    live: false,
  },
  failed: {
    glyph: "×",
    label: "FAILED",
    tone: "critical",
    text: "text-hud-red",
    live: false,
  },
  cancelled: {
    glyph: "■",
    label: "CANCELLED",
    tone: "neutral",
    text: "text-ink-faint",
    live: false,
  },
};

interface DelegationCardProps {
  delegation: ChatDelegation;
  className?: string;
}

/**
 * DelegationCard — one delegated step inside the Hermes conversation.
 *
 * Shows what was asked of which agent and how it went, without reproducing the
 * agent's transcript here: the delegated turns live in that agent's own
 * conversation, and the card links there rather than duplicating them.
 *
 * A failure is shown as a failure. Nothing is summarised into a success.
 */
export function DelegationCard({ delegation, className }: DelegationCardProps) {
  const ui = STATUS_UI[delegation.status];
  const name = delegation.agentId.toUpperCase();

  return (
    <div
      className={cn(
        "clip-hud-sm border bg-surface-inset p-2.5",
        delegation.status === "failed"
          ? "border-hud-red/40"
          : delegation.status === "running"
            ? "border-hud-green/40"
            : "border-line-soft",
        className,
      )}
    >
      <div className="flex items-baseline gap-2">
        <StatusDot tone={ui.tone} live={ui.live} size="xs" className="translate-y-[3px]" />
        <span className="font-hud text-[10px] font-bold uppercase tracking-[0.16em] text-ink">
          {name}
        </span>
        <span
          className={cn(
            "font-hud text-[9px] font-semibold uppercase tracking-[0.16em]",
            ui.text,
          )}
        >
          <span aria-hidden className="mr-1">
            {ui.glyph}
          </span>
          {ui.label}
        </span>
        {typeof delegation.durationMs === "number" && (
          <span className="t-timestamp ml-auto tabular-nums">
            {(delegation.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      <p className="t-timestamp mt-1 line-clamp-2">{delegation.task}</p>

      {delegation.summary && delegation.status === "completed" && (
        <p className="t-chat mt-1.5 line-clamp-4 border-l-2 border-hud-green/30 pl-2 text-ink-mute">
          {delegation.summary}
        </p>
      )}

      {delegation.failureReason && (
        <p className="t-meta mt-1.5 border-l-2 border-hud-red/40 pl-2 text-hud-red">
          {delegation.failureReason}
        </p>
      )}

      {delegation.conversationId && (
        <Link
          href={
            `${agentHref(delegation.agentId)}?conversation=${delegation.conversationId}` as Route
          }
          className="clip-hud-sm mt-2 inline-flex items-center gap-1.5 border border-line px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan"
        >
          <ExternalLink size={10} strokeWidth={2} aria-hidden />
          Open {name}
        </Link>
      )}
    </div>
  );
}
