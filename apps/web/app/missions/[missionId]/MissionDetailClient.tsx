"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/hud/Panel";
import { Meter } from "@/components/hud/Meter";
import { StatusDot } from "@/components/hud/StatusDot";
import { TaskChain } from "@/components/operations/TaskChain";
import { MissionNetwork } from "@/components/operations/MissionNetwork";
import { EventStream } from "@/components/operations/EventStream";
import { ReassignDialog } from "@/components/operations/ReassignDialog";
import { SimulationControls } from "@/components/operations/SimulationControls";
import { useOperations } from "@/components/operations/OperationsProvider";
import { useAgents, useAgentNameLookup } from "@/hooks/useAgents";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import {
  missionStatusVisual,
  PRIORITY_VISUAL,
} from "@/lib/operations/event-visuals";
import { agentStatusVisual } from "@/lib/agent-status";
import { formatClockShort } from "@/lib/format";
import { agentHref } from "@/lib/navigation";
import type { MissionTask } from "@/lib/types";

interface MissionDetailClientProps {
  missionId: string;
}

/**
 * Mission detail — one live operation.
 *
 * Layout intent: what the mission is and how far along, then the crew and the
 * work (tasks with dependencies), then the network showing what is passing
 * between agents, then the timeline of what actually happened.
 */
export default function MissionDetailClient({
  missionId,
}: MissionDetailClientProps) {
  const router = useRouter();
  const { agents } = useAgents();
  const agentName = useAgentNameLookup(agents);
  const { setActiveAgentId } = useVoiceContext();
  const { getMission, tasksForMission, eventsForMission, reassignTask } =
    useOperations();

  const [reassigning, setReassigning] = useState<MissionTask | null>(null);

  const mission = getMission(missionId);
  const tasks = useMemo(
    () => (mission ? tasksForMission(mission.id) : []),
    [mission, tasksForMission],
  );
  const events = useMemo(
    () => (mission ? eventsForMission(mission.id) : []),
    [mission, eventsForMission],
  );

  const crew = useMemo(
    () =>
      mission
        ? mission.assignedAgentIds
            .map((id) => agents.find((a) => a.id === id))
            .filter((a): a is NonNullable<typeof a> => Boolean(a))
        : [],
    [mission, agents],
  );

  /** Opening an agent from a mission carries the mission as voice target. */
  const openAgent = useCallback(
    (agentId: string) => {
      setActiveAgentId(agentId);
      router.push(agentHref(agentId) as Route);
    },
    [router, setActiveAgentId],
  );

  if (!mission) {
    return (
      <div className="p-4">
        <Panel title="Mission Not Found" eyebrow={missionId} status="warn">
          <p className="t-meta py-4">
            No mission is registered under{" "}
            <span className="font-data text-ink">{missionId}</span>.
          </p>
          <Link
            href={"/missions" as Route}
            className="clip-hud-sm mt-2 inline-flex items-center gap-1.5 border border-hud-cyan/50 bg-hud-cyan/10 px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-hud-cyan"
          >
            <ArrowLeft size={12} strokeWidth={2} aria-hidden />
            Missions
          </Link>
        </Panel>
      </div>
    );
  }

  const status = missionStatusVisual(mission.status);
  const priority = PRIORITY_VISUAL[mission.priority];
  const leadId = mission.leadAgentId ?? mission.assignedAgentIds[0];
  const supportIds =
    mission.supportingAgentIds ??
    mission.assignedAgentIds.filter((id) => id !== leadId);
  const name = (id: string) => agentName(id) ?? id.toUpperCase();
  const currentTask = tasks.find((t) => t.id === mission.currentTaskId);

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex-none border-b border-line-soft px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={"/missions" as Route}
            className="inline-flex items-center gap-1.5 font-hud text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-hud-cyan"
          >
            <ArrowLeft size={12} strokeWidth={2} aria-hidden />
            Missions
          </Link>
          <SimulationControls className="ml-auto" />
        </div>

        <div className="mt-2.5 flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-data text-[11px] font-semibold tracking-[0.1em] text-hud-cyan/80">
                {mission.code}
              </span>
              <h1 className="font-hud text-lg font-bold uppercase tracking-[0.2em] text-ink">
                {mission.title}
              </h1>
              <span
                className={cn(
                  "flex items-center gap-1.5 border px-1.5 py-0.5",
                  status.bg,
                  status.border,
                )}
              >
                <StatusDot tone={status.tone} live={status.live} size="xs" />
                <span
                  className={cn(
                    "font-hud text-[9px] font-bold uppercase tracking-[0.16em]",
                    status.text,
                  )}
                >
                  {status.label}
                </span>
              </span>
              <span
                className={cn(
                  "font-hud text-[9px] font-bold uppercase tracking-[0.18em]",
                  priority.text,
                )}
              >
                {priority.label}
              </span>
            </div>

            {mission.description && (
              <p className="t-meta mt-1.5 max-w-prose text-ink-mute">
                {mission.description}
              </p>
            )}
          </div>
        </div>

        {mission.blockedReason && (
          <p className="t-meta mt-2.5 border-l-2 border-hud-amber/50 pl-2 text-hud-amber">
            {mission.blockedReason}
          </p>
        )}
      </header>

      {/* ── Band 1: progress + crew ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 p-3 pb-0 sm:p-4 sm:pb-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel
          title="Progress"
          eyebrow={mission.phase ?? "IN PROGRESS"}
          status={status.tone}
          statusLive={status.live}
          variant={status.tone === "warn" ? "warning" : "active"}
          brackets
          stagger={0}
        >
          <div className="flex items-baseline gap-3">
            <span className="t-metric text-ink">{mission.progress}%</span>
            <span className="t-label">{mission.phase ?? "—"}</span>
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
            height={5}
            className="mt-2"
            label={`${mission.code} progress`}
          />

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            <Field label="LEAD" value={leadId ? name(leadId) : "—"} accent />
            <Field
              label="SUPPORT"
              value={supportIds.length ? supportIds.map(name).join(" · ") : "—"}
            />
            <Field label="STARTED" value={formatClockShort(mission.startedAt)} />
            <Field
              label="LATEST"
              value={
                mission.lastActivityAt
                  ? formatClockShort(mission.lastActivityAt)
                  : "—"
              }
            />
          </div>

          {currentTask && (
            <>
              <div className="hud-rule my-3" />
              <div className="space-y-1">
                <span className="t-label">CURRENT TASK</span>
                <p className="t-command text-ink">{currentTask.title}</p>
                {currentTask.currentStep && (
                  <p className="t-timestamp">
                    STEP · {currentTask.currentStep}
                  </p>
                )}
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Crew"
          eyebrow={`${crew.length} AGENTS`}
          status="info"
          stagger={1}
          footer={
            <p className="t-timestamp">
              Opening an agent sets it as the voice target.
            </p>
          }
        >
          <ul className="space-y-0">
            {crew.map((a) => {
              const visual = agentStatusVisual(a.status);
              const task = tasks.find(
                (t) =>
                  t.assignedAgentId === a.id &&
                  (t.status === "active" || t.status === "blocked"),
              );
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => openAgent(a.id)}
                    className="flex w-full items-baseline gap-2 border-b border-line-soft py-2 text-left transition-colors last:border-b-0 hover:bg-hud-cyan/[0.04]"
                  >
                    <StatusDot
                      tone={visual.tone}
                      live={visual.live}
                      size="xs"
                      className="translate-y-[3px]"
                    />
                    <span className="w-[64px] flex-none font-hud text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
                      {a.name}
                    </span>
                    {a.id === leadId && (
                      <span className="flex-none font-hud text-[8px] uppercase tracking-[0.16em] text-hud-cyan/70">
                        LEAD
                      </span>
                    )}
                    <span className="t-meta min-w-0 flex-1 truncate">
                      {task?.title ?? a.activity ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "flex-none font-hud text-[9px] font-semibold uppercase tracking-[0.14em]",
                        visual.text,
                      )}
                    >
                      {visual.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Communication — routes to the agent's existing channel. Mission
              channels (group chat) are a later concept. */}
          <div className="hud-rule my-3" />
          <span className="t-label">COMMUNICATION</span>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {crew.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => openAgent(a.id)}
                  className="clip-hud-sm flex items-center gap-1.5 border border-line px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-mute transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan"
                >
                  <MessageSquare size={10} strokeWidth={2} aria-hidden />
                  Talk to {a.name}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* ── Band 2: tasks + mission network ─────────────────────────────── */}
      <div className="grid flex-1 grid-cols-1 items-start gap-3 p-3 pb-0 sm:p-4 sm:pb-0 lg:grid-cols-2">
        <Panel
          title="Task Chain"
          eyebrow={`${tasks.filter((t) => t.status === "completed").length}/${tasks.length} DONE`}
          status={
            tasks.some((t) => t.status === "blocked") ? "warn" : "active"
          }
          statusLive={tasks.some((t) => t.status === "active")}
          stagger={2}
        >
          <TaskChain
            tasks={tasks}
            agentName={agentName}
            onReassign={setReassigning}
            selectedTaskId={mission.currentTaskId ?? null}
          />
        </Panel>

        <Panel
          title="Mission Network"
          eyebrow="PARTICIPANTS"
          status="info"
          statusLive
          stagger={3}
          footer={
            <p className="t-timestamp">
              Flows derived from mission events — simulated, not live traffic.
            </p>
          }
        >
          <MissionNetwork
            mission={mission}
            agents={crew}
            tasks={tasks}
            events={events}
            onSelect={(a) => openAgent(a.id)}
          />
        </Panel>
      </div>

      {/* ── Band 3: timeline ────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4">
        <Panel
          title="Mission Timeline"
          eyebrow={`${events.length} EVENTS`}
          status="info"
          statusLive
          stagger={4}
        >
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <EventStream
              events={events}
              agentName={agentName}
              onSelect={(e) => e.agentId && setActiveAgentId(e.agentId)}
              emptyMessage="No events recorded for this mission yet."
            />
          </div>
        </Panel>
      </div>

      {reassigning && (
        <ReassignDialog
          task={reassigning}
          agents={agents}
          onConfirm={(agentId) => {
            reassignTask(reassigning.id, agentId);
            setReassigning(null);
          }}
          onCancel={() => setReassigning(null)}
        />
      )}
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
