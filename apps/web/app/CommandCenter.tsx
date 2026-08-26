"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Panel } from "@/components/hud/Panel";
import { PageHeader } from "@/components/shell/PageHeader";
import { HermesCore } from "@/components/core/HermesCore";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentActivity } from "@/components/agents/AgentActivity";
import { AgentSummary } from "@/components/command-center/AgentSummary";
import { OperationCard } from "@/components/operations/OperationCard";
import { useOperations } from "@/components/operations/OperationsProvider";
import { AttentionRequired } from "@/components/command-center/AttentionRequired";
import { CurrentObjective } from "@/components/command-center/CurrentObjective";
import { SystemCounters } from "@/components/command-center/SystemCounters";
import { SystemHealth } from "@/components/telemetry/SystemHealth";
import { useCommandCenter } from "@/hooks/useCommandCenter";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import { deriveCoreState } from "@/lib/agent-status";
import { agentHref } from "@/lib/navigation";
import { formatUptime } from "@/lib/format";
import type { ActivityEvent, Agent, AttentionItem } from "@/lib/types";

/**
 * Command Center — the main operational screen.
 *
 * Answers, in reading order: what Hermes is coordinating, what needs the
 * operator, which agents are live and on what, what is in flight, and what
 * just happened. All of it comes from `useCommandCenter`, which is the single
 * seam between this page and its data source.
 */
export default function CommandCenter() {
  const router = useRouter();
  const {
    agents,
    activity,
    metrics,
    systemStatus,
    currentObjective,
    counters,
    loading,
    error,
    agentName,
    agentCounts,
  } = useCommandCenter();

  // Missions, tasks and attention come from the operational store, so the
  // Command Center reflects live operations rather than a second copy.
  const {
    openMissions: activeMissions,
    tasksForMission,
    attentionItems,
    dismissAttention,
  } = useOperations();

  const { setAgents, setActiveAgentId, activeAgentId } = useVoiceContext();

  // Publish the roster to the voice layer so @-mention routing knows the agents.
  useEffect(() => {
    setAgents(agents.map(({ id, name }) => ({ id, name })));
  }, [agents, setAgents]);

  const coreState = deriveCoreState(agents, attentionItems.length);

  // The lead mission drives the core's progress arc.
  const leadMission = useMemo(
    () =>
      activeMissions.find((m) => m.id === currentObjective?.missionId) ??
      activeMissions[0],
    [activeMissions, currentObjective],
  );

  /** Focus an agent: targets it for voice and highlights it across the board. */
  const focusAgent = useCallback(
    (agent: Agent) => {
      setActiveAgentId(agent.id === activeAgentId ? null : agent.id);
    },
    [activeAgentId, setActiveAgentId],
  );

  /** Open an agent's workspace, targeting it on the way in. */
  const openAgent = useCallback(
    (agent: Agent) => {
      setActiveAgentId(agent.id);
      router.push(agentHref(agent.id) as Route);
    },
    [router, setActiveAgentId],
  );

  /** Clicking an event focuses the agent it came from. */
  const selectActivity = useCallback(
    (event: ActivityEvent) => {
      if (event.agentId) setActiveAgentId(event.agentId);
    },
    [setActiveAgentId],
  );

  /**
   * Reviewing an attention item opens the workspace of the agent that raised
   * it — the closest review surface until the Approvals route lands.
   */
  const reviewAttention = useCallback(
    (item: AttentionItem) => {
      if (!item.agentId) return;
      setActiveAgentId(item.agentId);
      router.push(agentHref(item.agentId) as Route);
    },
    [router, setActiveAgentId],
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Command Center"
        subtitle="Mission control · agent network · live operations"
        meta={[
          { label: "UPTIME", value: formatUptime(systemStatus.uptimeSeconds) },
          {
            label: "AGENTS",
            value: `${agentCounts.active}/${agentCounts.total}`,
          },
          { label: "MISSIONS", value: `${activeMissions.length}` },
        ]}
      />

      {/* ── Band 1: core, objective + attention, telemetry ──────────────── */}
      <div className="grid grid-cols-1 gap-3 p-3 pb-0 sm:p-4 sm:pb-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.3fr)_minmax(0,0.95fr)]">
        <HermesCore
          state={coreState}
          agents={agents}
          focusedAgentId={activeAgentId}
          onAgentSelect={focusAgent}
          activeCount={agentCounts.active}
          progress={leadMission?.progress}
          footerStats={[
            { label: "NODES", value: `${agentCounts.total}` },
            { label: "ACTIVE", value: `${agentCounts.active}` },
            { label: "MISSIONS", value: `${activeMissions.length}` },
          ]}
        />

        {/* Centre column: what Hermes is doing, and what it needs. */}
        <div className="flex flex-col gap-3">
          <CurrentObjective
            objective={currentObjective}
            agentName={agentName}
            stagger={1}
          />
          {/* A long queue scrolls rather than stretching the band — otherwise
              a busy day leaves the core rings floating in empty space. */}
          <AttentionRequired
            items={attentionItems}
            agentName={agentName}
            onReview={reviewAttention}
            onDismiss={(item) => dismissAttention(item.id)}
            stagger={2}
            className="flex-1"
            maxBodyHeight="clamp(240px, 34vh, 420px)"
          />
        </div>

        {/* Right column: telemetry. */}
        <div className="flex flex-col gap-3">
          <Panel
            title="System Health"
            eyebrow="TELEMETRY"
            status="info"
            stagger={3}
            footer={
              <p className="t-timestamp">
                Simulated readings — real telemetry replaces the mock source.
              </p>
            }
          >
            <SystemHealth metrics={metrics} />
          </Panel>

          <Panel title="Activity Level" eyebrow="TODAY" stagger={4}>
            <SystemCounters counters={counters} />
          </Panel>
        </div>
      </div>

      {/* ── Band 2: the agent roster ────────────────────────────────────── */}
      <div className="p-3 pb-0 sm:p-4 sm:pb-0">
        <Panel
          title="Active Agents"
          eyebrow={loading ? "SYNCING" : undefined}
          status={error ? "warn" : "active"}
          statusLive={!error && !loading}
          stagger={5}
          actions={<AgentSummary counts={agentCounts} />}
        >
          {error && (
            <p className="t-meta mb-3 text-hud-amber">
              Live roster unavailable ({error}) — showing last known state.
            </p>
          )}

          {agents.length === 0 ? (
            <p className="t-meta py-8">No agents registered on this network.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {agents.map((agent, i) => (
                <li key={agent.id} className="h-full">
                  <AgentCard
                    agent={agent}
                    onSelect={openAgent}
                    selected={agent.id === activeAgentId}
                    stagger={6 + i}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Band 3: activity feed + missions ────────────────────────────── */}
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel
          title="Live Activity"
          eyebrow={`${activity.length} EVENTS`}
          status="info"
          statusLive
          stagger={7}
          className="flex flex-col"
        >
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <AgentActivity
              events={activity}
              agentName={agentName}
              limit={12}
              onSelect={selectActivity}
              highlightAgentId={activeAgentId}
            />
          </div>
        </Panel>

        <Panel
          title="Active Missions"
          eyebrow={`${activeMissions.length} IN FLIGHT`}
          status={
            activeMissions.some(
              (m) => m.status === "blocked" || m.status === "waiting",
            )
              ? "warn"
              : "active"
          }
          statusLive
          stagger={8}
          className="flex flex-col"
        >
          {activeMissions.length === 0 ? (
            <p className="t-meta py-8">No missions in flight.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {activeMissions.map((mission, i) => (
                <li key={mission.id} className="h-full">
                  <OperationCard
                    mission={mission}
                    agents={mission.assignedAgentIds
                      .map((id) => agents.find((a) => a.id === id))
                      .filter((a): a is Agent => Boolean(a))}
                    tasks={tasksForMission(mission.id)}
                    stagger={9 + i}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
