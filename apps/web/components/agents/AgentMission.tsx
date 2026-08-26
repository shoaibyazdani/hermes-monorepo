import { cn } from "@/lib/utils";
import { Meter } from "@/components/hud/Meter";
import { missionStatusVisual } from "@/lib/operations/event-visuals";
import { formatClockShort } from "@/lib/format";
import type { Mission } from "@/lib/types";

interface AgentMissionProps {
  mission: Mission | null;
  /** Whether the viewed agent leads this mission. */
  isLead: boolean;
  /** Resolves an agent id to a display name. */
  agentName?: (id: string) => string | undefined;
  className?: string;
}

/**
 * AgentMission — the mission this agent is assigned to, from its perspective.
 *
 * Leads with the agent's own role in the mission rather than the mission's
 * global state: inside a workspace, "am I the lead here" is the first thing
 * that matters.
 */
export function AgentMission({
  mission,
  isLead,
  agentName,
  className,
}: AgentMissionProps) {
  if (!mission) {
    return (
      <div className={cn("py-2", className)}>
        <p className="font-hud text-[11px] font-bold uppercase tracking-[0.2em] text-ink-mute">
          No active mission
        </p>
        <p className="t-meta mt-1.5">Agent is available for assignment.</p>
      </div>
    );
  }

  const status = missionStatusVisual(mission.status);
  const leadId = mission.leadAgentId ?? mission.assignedAgentIds[0];
  const supportIds =
    mission.supportingAgentIds ??
    mission.assignedAgentIds.filter((id) => id !== leadId);
  const name = (id: string) => agentName?.(id) ?? id.toUpperCase();

  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className="font-data text-[11px] font-semibold tracking-[0.1em] text-hud-cyan/80">
          {mission.code}
        </span>
        <span
          className={cn(
            "ml-auto border px-1.5 py-px font-hud text-[9px] font-semibold uppercase tracking-[0.16em]",
            status.bg,
            status.border,
            status.text,
          )}
        >
          {status.label}
        </span>
      </div>

      <h3 className="t-command mt-1.5 font-semibold text-ink">
        {mission.title}
      </h3>
      {mission.description && (
        <p className="t-meta mt-1">{mission.description}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Field label="ROLE" value={isLead ? "LEAD" : "SUPPORT"} accent />
        <Field label="PHASE" value={mission.phase ?? "—"} />
        {!isLead && leadId && <Field label="LEAD" value={name(leadId)} />}
        {isLead && supportIds.length > 0 && (
          <Field label="SUPPORT" value={supportIds.map(name).join(" · ")} />
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="t-label">PROGRESS</span>
          <span className="font-data text-[11px] font-bold tabular-nums text-ink-mute">
            {mission.progress}%
          </span>
        </div>
        <Meter
          value={mission.progress}
          tone={
            mission.status === "blocked" || mission.status === "waiting"
              ? "elevated"
              : "nominal"
          }
          label={`${mission.code} progress`}
        />
      </div>

      <div className="hud-rule my-3" />

      <div className="flex items-baseline gap-3">
        <span className="t-timestamp">
          Started {formatClockShort(mission.startedAt)}
        </span>
        {mission.lastActivityAt && (
          <span className="t-timestamp ml-auto">
            Latest {formatClockShort(mission.lastActivityAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="t-label">{label}</div>
      <div
        className={cn(
          "mt-0.5 truncate font-hud text-[11px] font-bold uppercase tracking-[0.14em]",
          accent ? "text-hud-cyan" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}
