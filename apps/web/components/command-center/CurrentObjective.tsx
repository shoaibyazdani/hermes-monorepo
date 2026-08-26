import { cn } from "@/lib/utils";
import { Panel } from "@/components/hud/Panel";
import { StatusDot } from "@/components/hud/StatusDot";
import { formatClockShort } from "@/lib/format";
import type { Objective, ObjectiveStatus, StatusTone } from "@/lib/types";

const STATUS_VISUAL: Record<
  ObjectiveStatus,
  { label: string; tone: StatusTone; live: boolean }
> = {
  active: { label: "ACTIVE", tone: "active", live: true },
  coordinating: { label: "COORDINATING", tone: "info", live: true },
  waiting: { label: "WAITING", tone: "warn", live: false },
  idle: { label: "IDLE", tone: "neutral", live: false },
};

interface CurrentObjectiveProps {
  objective: Objective | null;
  /** Resolves an agent id to a display name. */
  agentName?: (id: string) => string | undefined;
  stagger?: number;
  className?: string;
}

/**
 * CurrentObjective — what Hermes itself is coordinating.
 *
 * Distinct from a mission (a unit of work) and from an agent's task: this is
 * the orchestrator's own focus, so it names the lead and support cast rather
 * than showing progress.
 */
export function CurrentObjective({
  objective,
  agentName,
  stagger,
  className,
}: CurrentObjectiveProps) {
  if (!objective) {
    return (
      <Panel
        title="Current Objective"
        eyebrow="NONE"
        stagger={stagger}
        className={className}
      >
        <p className="t-meta py-1">
          Hermes has no active objective. Issue a command to begin.
        </p>
      </Panel>
    );
  }

  const visual = STATUS_VISUAL[objective.status];
  const name = (id: string) => agentName?.(id) ?? id.toUpperCase();

  return (
    <Panel
      title="Current Objective"
      eyebrow="HERMES"
      status={visual.tone}
      statusLive={visual.live}
      stagger={stagger}
      className={className}
    >
      <p className="t-command font-semibold text-ink">{objective.title}</p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        {objective.leadAgentId && (
          <div className="flex items-baseline gap-1.5">
            <span className="t-label">LEAD</span>
            <span className="font-hud text-[11px] font-bold uppercase tracking-[0.14em] text-hud-cyan">
              {name(objective.leadAgentId)}
            </span>
          </div>
        )}

        {objective.supportAgentIds.length > 0 && (
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="t-label">SUPPORT</span>
            <span className="truncate font-hud text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              {objective.supportAgentIds.map(name).join(" · ")}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="t-label">STATUS</span>
          <StatusDot tone={visual.tone} live={visual.live} size="xs" />
          <span
            className={cn(
              "font-hud text-[11px] font-bold uppercase tracking-[0.14em]",
              visual.tone === "warn" ? "text-hud-amber" : "text-ink",
            )}
          >
            {visual.label}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="t-label">SINCE</span>
          <span className="font-data text-[11px] tabular-nums text-ink-mute">
            {formatClockShort(objective.startedAt)}
          </span>
        </div>
      </div>
    </Panel>
  );
}
