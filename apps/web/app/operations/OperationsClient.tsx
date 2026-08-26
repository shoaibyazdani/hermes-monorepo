"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Panel } from "@/components/hud/Panel";
import { PageHeader } from "@/components/shell/PageHeader";
import { OperationCard } from "@/components/operations/OperationCard";
import { EventStream } from "@/components/operations/EventStream";
import { SimulationControls } from "@/components/operations/SimulationControls";
import { AttentionRequired } from "@/components/command-center/AttentionRequired";
import { AgentNetwork } from "@/components/agents/AgentNetwork";
import { useOperations } from "@/components/operations/OperationsProvider";
import { useAgentNameLookup } from "@/hooks/useAgents";
import { useLiveAgents } from "@/hooks/useLiveAgents";
import { useUtcClock } from "@/hooks/useUtcClock";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import { agentStatusVisual } from "@/lib/agent-status";
import { getAgentRelations } from "@/lib/mock/agent-registry";
import { agentHref, missionHref } from "@/lib/navigation";
import type { AttentionItem, OperationEvent } from "@/lib/types";

/**
 * Operations — the live operational overview.
 *
 * Answers, in reading order: what needs me, what is running and who is on it,
 * how the network is connected, and what just happened. All state comes from
 * `OperationsProvider`; nothing here holds its own copy.
 */
export default function OperationsClient() {
  const router = useRouter();
  const { agents } = useLiveAgents();
  const agentName = useAgentNameLookup(agents);
  const clock = useUtcClock();
  const { setAgents, setActiveAgentId, activeAgentId } = useVoiceContext();
  const {
    openMissions,
    tasks,
    events,
    attentionItems,
    tasksForMission,
    dismissAttention,
  } = useOperations();

  useEffect(() => {
    setAgents(agents.map(({ id, name }) => ({ id, name })));
  }, [agents, setAgents]);

  const counts = useMemo(() => {
    let active = 0;
    let waiting = 0;
    for (const a of agents) {
      if (["working", "thinking", "listening"].includes(a.status)) active++;
      else if (["waiting", "blocked", "error"].includes(a.status)) waiting++;
    }
    return { active, waiting };
  }, [agents]);

  const agentsFor = useCallback(
    (ids: string[]) =>
      ids
        .map((id) => agents.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [agents],
  );

  /** An event row focuses its originating agent for voice. */
  const selectEvent = useCallback(
    (event: OperationEvent) => {
      if (event.agentId) setActiveAgentId(event.agentId);
    },
    [setActiveAgentId],
  );

  /** Attention items link to the mission they concern, or the agent. */
  const reviewAttention = useCallback(
    (item: AttentionItem) => {
      if (item.agentId) setActiveAgentId(item.agentId);
      router.push(
        (item.missionId
          ? missionHref(item.missionId)
          : agentHref(item.agentId ?? "hermes")) as Route,
      );
    },
    [router, setActiveAgentId],
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Operations"
        subtitle="Live missions · agent collaboration · event stream"
        meta={[
          { label: "AGENTS", value: String(agents.length).padStart(2, "0") },
          {
            label: "MISSIONS",
            value: String(openMissions.length).padStart(2, "0"),
          },
          { label: "ACTIVE", value: String(counts.active).padStart(2, "0") },
          { label: "WAITING", value: String(counts.waiting).padStart(2, "0") },
          { label: "UTC", value: clock },
        ]}
        actions={<SimulationControls />}
      />

      {/* ── Attention ───────────────────────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <div className="p-3 pb-0 sm:p-4 sm:pb-0">
          <AttentionRequired
            items={attentionItems}
            agentName={agentName}
            onReview={reviewAttention}
            onDismiss={(item) => dismissAttention(item.id)}
            stagger={0}
            maxBodyHeight="clamp(260px, 38vh, 460px)"
          />
        </div>
      )}

      {/* ── Active operations ───────────────────────────────────────────── */}
      <div className="p-3 pb-0 sm:p-4 sm:pb-0">
        <Panel
          title="Active Operations"
          eyebrow={`${openMissions.length} IN FLIGHT`}
          status={
            openMissions.some((m) => m.status === "blocked") ? "warn" : "active"
          }
          statusLive
          stagger={1}
        >
          {openMissions.length === 0 ? (
            <p className="t-meta py-8">No operations in flight.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
              {openMissions.map((mission, i) => (
                <li key={mission.id} className="h-full">
                  <OperationCard
                    mission={mission}
                    agents={agentsFor(mission.assignedAgentIds)}
                    tasks={tasksForMission(mission.id)}
                    stagger={2 + i}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Network + event stream ──────────────────────────────────────── */}
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Panel
          title="Network Activity"
          eyebrow="RELATIONSHIPS"
          status="info"
          statusLive
          stagger={5}
          className="flex flex-col"
          footer={
            <p className="t-timestamp">
              Click to target an agent · double-click to open its workspace.
            </p>
          }
        >
          <AgentNetwork
            agents={agents}
            relations={getAgentRelations()}
            selectedAgentId={activeAgentId}
            onSelect={(a) =>
              setActiveAgentId(a.id === activeAgentId ? null : a.id)
            }
            onOpen={(a) => router.push(agentHref(a.id) as Route)}
          />

          {/* Per-agent operational state, in words. */}
          <ul className="mt-3 space-y-0">
            {agents.map((a) => {
              const visual = agentStatusVisual(a.status);
              const task = tasks.find(
                (t) =>
                  t.assignedAgentId === a.id &&
                  (t.status === "active" || t.status === "blocked"),
              );
              return (
                <li
                  key={a.id}
                  className="flex items-baseline gap-2 border-b border-line-soft py-1.5 last:border-b-0"
                >
                  <span className="w-[68px] flex-none font-hud text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                    {a.name}
                  </span>
                  <span
                    className={`w-[64px] flex-none font-hud text-[9px] font-semibold uppercase tracking-[0.14em] ${visual.text}`}
                  >
                    {visual.label}
                  </span>
                  <span className="t-meta min-w-0 flex-1 truncate">
                    {task?.currentStep ?? task?.title ?? a.activity ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Live Event Stream"
          eyebrow={`${events.length} EVENTS`}
          status="info"
          statusLive
          stagger={6}
          className="flex flex-col"
        >
          <div className="max-h-[520px] overflow-y-auto pr-1">
            <EventStream
              events={events}
              agentName={agentName}
              limit={30}
              highlightAgentId={activeAgentId}
              onSelect={selectEvent}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
