"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useVoiceContext } from "./VoiceProvider";

interface TerminalLogProps {
  /** Show only this agent's traffic plus system lines. */
  agentId?: string;
  /** Max lines rendered. */
  limit?: number;
  className?: string;
}

/**
 * TerminalLog — the comms channel readout.
 *
 * Auto-scrolls to the newest line and exposes itself as an ARIA log so
 * assistive tech announces incoming traffic.
 */
export function TerminalLog({ agentId, limit = 40, className }: TerminalLogProps) {
  const { routedLog } = useVoiceContext();
  const endRef = useRef<HTMLDivElement>(null);

  const lines = routedLog
    .filter((e) => !agentId || e.agentId === agentId || e.agentId === null)
    .slice(-limit);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);

  return (
    <div
      className={cn(
        "hud-well max-h-[220px] min-h-[72px] overflow-y-auto px-3 py-2",
        className,
      )}
      role="log"
      aria-live="polite"
      aria-label="Communications log"
    >
      {lines.length === 0 ? (
        <p className="t-meta">Awaiting output…</p>
      ) : (
        lines.map((entry, i) => (
          <p
            key={`${entry.agentId ?? "sys"}-${i}`}
            className={cn(
              "font-data text-[11px] leading-relaxed",
              entry.line.startsWith("[YOU")
                ? "text-hud-cyan"
                : "text-ink-mute",
            )}
          >
            {entry.line}
          </p>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}
