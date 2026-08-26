"use client";

import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { Panel, TONE_TO_PANEL_VARIANT } from "@/components/hud/Panel";
import { Meter } from "@/components/hud/Meter";
import { StatusDot } from "@/components/hud/StatusDot";
import { agentStatusVisual } from "@/lib/agent-status";
import {
  missionStatusVisual,
  PRIORITY_VISUAL,
} from "@/lib/operations/event-visuals";
import { missionHref } from "@/lib/navigation";
import type { Agent, Mission, MissionTask } from "@/lib/types";

interface OperationCardProps {
  mission: Mission;
  /** Agents assigned to this mission. */
  agents: Agent[];
  tasks: MissionTask[];
  stagger?: number;
  className?: string;
}

/**
 * OperationCard — a mission and who is on it, as one operational row.
 *
 * Unlike a plain mission summary this leads with the crew: each participant
 * gets a line showing state and what they are doing, because on an operations
 * board "who is stuck" matters more than the percentage.
 *
 * The whole card links to the mission; agent rows are plain text so the link
 * target stays unambiguous.
 */
export function OperationCard({
  mission,
  agents,
  tasks,
  stagger,
  className,
}: OperationCardProps) {
  const status = missionStatusVisual(mission.status);
  const priority = PRIORITY_VISUAL[mission.priority];
  const leadId = mission.leadAgentId ?? mission.assignedAgentIds[0];

  const taskFor = (agentId: string) =>
    tasks.find((t) => t.assignedAgentId === agentId && t.status === "active") ??
    tasks.find((t) => t.assignedAgentId === agentId && t.status === "blocked");

  return (
    <Panel
      variant={
        mission.attentionRequired
          ? "warning"
          : TONE_TO_PANEL_VARIANT[status.tone]
      }
      scanning={status.live}
      brackets={priority.emphatic && status.live}
      padding="none"
      stagger={stagger}
      className={cn("h-full", className)}
    >
      <Link
        href={missionHref(mission.id) as Route}
        className="flex h-full flex-col p-4 transition-colors hover:bg-hud-cyan/[0.03]"
      >
        <div className="flex items-baseline gap-2">
          <span className="flex-none font-data text-[11px] font-semibold tracking-[0.1em] text-hud-cyan/80">
            {mission.code}
          </span>
          <span
            className={cn(
              "flex-none font-hud text-[9px] font-bold uppercase tracking-[0.18em]",
              priority.text,
            )}
          >
            {priority.label}
          </span>
          <span
            className={cn(
              "ml-auto flex flex-none items-center gap-1.5 border px-1.5 py-px",
              status.bg,
              status.border,
            )}
          >
            <StatusDot tone={status.tone} live={status.live} size="xs" />
            <span
              className={cn(
                "font-hud text-[9px] font-semibold uppercase tracking-[0.16em]",
                status.text,
              )}
            >
              {status.label}
            </span>
          </span>
        </div>

        <div className="mt-1.5 flex items-baseline gap-3">
          <h3 className="min-w-0 flex-1 truncate font-hud text-[13px] font-bold uppercase tracking-[0.12em] text-ink">
            {mission.title}
          </h3>
          <span className="flex-none font-data text-xs font-bold tabular-nums text-ink-mute">
            {mission.progress}%
          </span>
        </div>

        <Meter
          value={mission.progress}
          tone={
            mission.status === "blocked" || mission.status === "waiting"
              ? "elevated"
              : mission.status === "failed"
                ? "critical"
                : "nominal"
          }
          className="mt-1.5"
          label={`${mission.code} progress`}
        />

        {/* Crew — the operational heart of the card. */}
        <ul className="mt-3 space-y-0">
          {agents.map((a) => {
            const visual = agentStatusVisual(a.status);
            const task = taskFor(a.id);
            return (
              <li key={a.id} className="flex items-baseline gap-2 py-1">
                <StatusDot
                  tone={visual.tone}
                  live={visual.live}
                  size="xs"
                  className="translate-y-[3px]"
                />
                <span className="w-[62px] flex-none font-hud text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                  {a.name}
                </span>
                {a.id === leadId && (
                  <span className="flex-none font-hud text-[8px] uppercase tracking-[0.16em] text-hud-cyan/70">
                    LEAD
                  </span>
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-data text-[11px]",
                    visual.text,
                  )}
                >
                  {task?.status === "blocked"
                    ? (task.blockedReason ?? "blocked")
                    : (task?.title ?? visual.label.toLowerCase())}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto pt-2.5">
          <div className="hud-rule mb-2" />
          <div className="flex items-baseline gap-2">
            <span className="t-timestamp min-w-0 flex-1 truncate">
              {mission.blockedReason ?? mission.phase ?? "IN PROGRESS"}
            </span>
            <span className="t-timestamp flex-none">Open →</span>
          </div>
        </div>
      </Link>
    </Panel>
  );
}
