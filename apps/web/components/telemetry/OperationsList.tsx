import { cn } from "@/lib/utils";
import { Meter } from "@/components/hud/Meter";
import { missionStatusVisual } from "@/lib/operations/event-visuals";
import { formatClockShort } from "@/lib/format";
import type { MetricTone, Mission, MissionPriority } from "@/lib/types";

const PRIORITY_MARK: Record<MissionPriority, { label: string; className: string }> =
  {
    low: { label: "LOW", className: "text-ink-ghost" },
    normal: { label: "NORM", className: "text-ink-faint" },
    high: { label: "HIGH", className: "text-hud-amber" },
    critical: { label: "CRIT", className: "text-hud-red" },
  };

const STATUS_METER_TONE: Record<string, MetricTone> = {
  queued: "nominal",
  active: "nominal",
  review: "nominal",
  blocked: "elevated",
  completed: "nominal",
  failed: "critical",
};

interface OperationsListProps {
  missions: Mission[];
  /** Resolves an agent id to a display name for the assignee line. */
  agentName?: (id: string) => string | undefined;
  limit?: number;
  className?: string;
}

/**
 * OperationsList — currently-running work, one row per mission.
 *
 * Shows the code, title, status, priority, assignees and progress. Read-only
 * for now; mission control lands with the Missions route.
 */
export function OperationsList({
  missions,
  agentName,
  limit,
  className,
}: OperationsListProps) {
  const shown = limit ? missions.slice(0, limit) : missions;

  if (shown.length === 0) {
    return (
      <p className="t-meta py-6">No operations in flight.</p>
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {shown.map((mission) => {
        const status = missionStatusVisual(mission.status);
        const priority = PRIORITY_MARK[mission.priority];
        const assignees = mission.assignedAgentIds
          .map((id) => agentName?.(id) ?? id.toUpperCase())
          .join(" · ");

        return (
          <li
            key={mission.id}
            className="border-b border-line-soft pb-3 last:border-b-0 last:pb-0"
          >
            <div className="flex items-baseline gap-2">
              <span className="flex-none font-data text-[11px] font-semibold tracking-[0.1em] text-hud-cyan/80">
                {mission.code}
              </span>
              <span
                className={cn(
                  "flex-none font-hud text-[9px] font-bold uppercase tracking-[0.18em]",
                  priority.className,
                )}
              >
                {priority.label}
              </span>
              <span className="ml-auto flex-none">
                <span
                  className={cn(
                    "border px-1.5 py-px font-hud text-[9px] font-semibold uppercase tracking-[0.16em]",
                    status.bg,
                    status.border,
                    status.text,
                  )}
                >
                  {status.label}
                </span>
              </span>
            </div>

            <p className="t-command mt-1.5 text-ink">{mission.title}</p>

            <div className="mt-2 flex items-center gap-2">
              <span className="t-timestamp flex-none">
                {formatClockShort(mission.startedAt)}
              </span>
              <span className="t-timestamp min-w-0 flex-1 truncate">
                {assignees}
              </span>
              <span className="flex-none font-data text-[11px] font-semibold tabular-nums text-ink-mute">
                {mission.progress}%
              </span>
            </div>

            <Meter
              value={mission.progress}
              tone={STATUS_METER_TONE[mission.status] ?? "nominal"}
              className="mt-1.5"
              label={`${mission.code} progress`}
            />
          </li>
        );
      })}
    </ul>
  );
}
