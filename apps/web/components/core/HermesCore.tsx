"use client";

import { cn } from "@/lib/utils";
import { Panel } from "@/components/hud/Panel";
import { StatusDot } from "@/components/hud/StatusDot";
import { CORE_STATE_VISUALS } from "@/lib/agent-status";
import { CoreVisualization } from "./CoreVisualization";
import type { Agent, CoreState } from "@/lib/types";

interface HermesCoreProps {
  state: CoreState;
  agents: Agent[];
  /** Agent currently focused by the operator. */
  focusedAgentId?: string | null;
  onAgentSelect?: (agent: Agent) => void;
  /** Number of agents in a live state, shown in the readout. */
  activeCount: number;
  /** 0–100 arc fill — the lead mission's progress. */
  progress?: number;
  /** Compact stats rendered in the panel footer. */
  footerStats?: Array<{ label: string; value: string }>;
  className?: string;
}

/**
 * HermesCore — the visual centre of the Command Center.
 *
 * Wraps `CoreVisualization` in a Panel and pairs it with the state readout.
 * The readout is the authoritative statement of what Hermes is doing; the
 * rings are supporting ambience.
 */
export function HermesCore({
  state,
  agents,
  focusedAgentId,
  onAgentSelect,
  activeCount,
  progress,
  footerStats,
  className,
}: HermesCoreProps) {
  const visual = CORE_STATE_VISUALS[state];

  // "AGENTS ACTIVE" reads better with the count folded in.
  const readout =
    state === "active" ? `${activeCount} AGENTS ACTIVE` : visual.label;

  return (
    <Panel
      title="Hermes Core"
      eyebrow="ORCHESTRATOR"
      status={visual.tone}
      statusLive={visual.live}
      variant={state === "attention" ? "warning" : "active"}
      brackets
      fill
      className={cn("flex flex-col", className)}
      footer={
        footerStats && footerStats.length > 0 ? (
          <>
            {footerStats.map((s) => (
              <span key={s.label} className="flex items-baseline gap-1.5">
                <span className="t-label">{s.label}</span>
                <span className="font-data text-[11px] font-bold tabular-nums text-hud-cyan">
                  {s.value}
                </span>
              </span>
            ))}
          </>
        ) : undefined
      }
    >
      <div className="relative flex flex-1 items-center justify-center py-1">
        <CoreVisualization
          state={state}
          agents={agents}
          focusedAgentId={focusedAgentId}
          onAgentSelect={onAgentSelect}
          progress={progress}
          className="my-auto"
        />

        {/* Hub mark, overlaid on the visualisation's centre. The full state
            reads on the line below — the hub only carries identity. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-hud text-[11px] font-bold uppercase tracking-[0.2em] transition-colors",
              visual.tone === "warn" ? "text-hud-amber" : "text-hud-cyan",
            )}
          >
            HERMES
          </span>
        </div>
      </div>

      {/* State line — the authoritative readout, below the rings. */}
      <div
        className="mt-2 flex items-center justify-center gap-2 border-t border-line-soft pt-3"
        role="status"
      >
        <StatusDot tone={visual.tone} live={visual.live} size="sm" />
        <span
          className={cn(
            "font-hud text-[11px] font-bold uppercase tracking-[0.24em]",
            visual.tone === "warn" ? "text-hud-amber" : "text-ink",
          )}
        >
          {readout}
        </span>
      </div>
    </Panel>
  );
}
