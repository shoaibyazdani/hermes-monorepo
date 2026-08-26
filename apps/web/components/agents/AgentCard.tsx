"use client";

import { cn } from "@/lib/utils";
import { Panel, TONE_TO_PANEL_VARIANT } from "@/components/hud/Panel";
import { Meter } from "@/components/hud/Meter";
import { agentStatusVisual } from "@/lib/agent-status";
import { useElapsed } from "@/hooks/useElapsed";
import { formatClock } from "@/lib/format";
import { AgentAvatar } from "./AgentAvatar";
import { AgentStatusBadge } from "./AgentStatusBadge";
import type { Agent, MetricTone } from "@/lib/types";

interface AgentCardProps {
  agent: Agent;
  /** Makes the whole card a button. */
  onSelect?: (agent: Agent) => void;
  /** Marks this card as the currently focused agent. */
  selected?: boolean;
  /** Hides the activity line and progress meter. */
  compact?: boolean;
  stagger?: number;
  className?: string;
}

/** Progress bars adopt the tone of the agent's state, not the value. */
const TONE_TO_METRIC: Record<string, MetricTone> = {
  neutral: "nominal",
  info: "nominal",
  active: "nominal",
  warn: "elevated",
  critical: "critical",
};

/**
 * AgentCard — the standard agent tile used across Command Center and Agents.
 *
 * Visual intensity is tiered by state: a live agent keeps an accented border
 * and the scanning sheen, while an idle one recedes. Scanning a wall of cards
 * should surface the busy agents first.
 *
 * Selectable variants render a real `<button>` so keyboard and screen-reader
 * users get activation and focus for free.
 */
export function AgentCard({
  agent,
  onSelect,
  selected = false,
  compact = false,
  stagger,
  className,
}: AgentCardProps) {
  const visual = agentStatusVisual(agent.status);
  const interactive = Boolean(onSelect);
  const elapsed = useElapsed(agent.startedAt);
  const dormant = agent.status === "idle" || agent.status === "offline";

  const body = (
    <>
      <div className="flex items-start gap-2.5">
        <AgentAvatar agent={agent} size={compact ? "sm" : "md"} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "t-agent-name",
                dormant ? "text-ink-mute" : "text-ink",
              )}
            >
              {agent.name}
            </span>
            <AgentStatusBadge status={agent.status} />
          </div>
          <div className="t-label mt-1 truncate">{agent.role}</div>
        </div>
      </div>

      {!compact && agent.activity && (
        <p
          className={cn(
            "t-meta mt-3 line-clamp-2 text-left",
            dormant ? "text-ink-faint" : "text-ink-mute",
          )}
        >
          {agent.activity}
        </p>
      )}

      {!compact && typeof agent.progress === "number" && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="t-label">PROGRESS</span>
            <span className="font-data text-[11px] font-semibold tabular-nums text-ink-mute">
              {agent.progress}%
            </span>
          </div>
          <Meter
            value={agent.progress}
            tone={TONE_TO_METRIC[visual.tone] ?? "nominal"}
            label={`${agent.name} progress`}
          />
        </div>
      )}

      {/* Operational footer: the concrete step, and how long it has been
          running. `mt-auto` pins it to the bottom so cards in a row align. */}
      {!compact && (agent.currentStep || agent.startedAt || agent.lastSeen) && (
        <div className="mt-auto pt-3">
          <div className="hud-rule mb-2" />
          <div className="flex items-baseline gap-2">
            {agent.currentStep && (
              <span className="t-timestamp min-w-0 flex-1 truncate">
                {agent.currentStep}
              </span>
            )}
            {agent.startedAt ? (
              <span
                className="t-timestamp flex-none tabular-nums"
                suppressHydrationWarning
                title="Elapsed on current task"
              >
                {elapsed} elapsed
              </span>
            ) : (
              agent.lastSeen && (
                <span className="t-timestamp flex-none tabular-nums">
                  {formatClock(agent.lastSeen)}
                </span>
              )
            )}
          </div>
        </div>
      )}
    </>
  );

  const panelClass = cn(
    // Full height so cards in the same grid row align, regardless of whether
    // an agent reports a progress meter.
    "h-full text-left",
    interactive && "cursor-pointer",
    selected && "border-hud-cyan/70 bg-surface-raised",
    // Dormant agents recede so live ones read first.
    dormant && !selected && "opacity-70 transition-opacity hover:opacity-100",
    className,
  );

  if (interactive) {
    return (
      <Panel
        as="div"
        variant={selected ? "active" : TONE_TO_PANEL_VARIANT[visual.tone]}
        interactive
        scanning={visual.live && !compact}
        padding="none"
        stagger={stagger}
        className={panelClass}
      >
        <button
          type="button"
          onClick={() => onSelect?.(agent)}
          aria-pressed={selected}
          className="flex h-full w-full flex-col p-4 text-left"
        >
          {body}
        </button>
      </Panel>
    );
  }

  return (
    <Panel
      variant={TONE_TO_PANEL_VARIANT[visual.tone]}
      scanning={visual.live && !compact}
      stagger={stagger}
      className={cn(panelClass, "flex flex-col")}
    >
      {body}
    </Panel>
  );
}
