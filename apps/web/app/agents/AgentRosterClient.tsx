"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Panel } from "@/components/hud/Panel";
import { PageHeader } from "@/components/shell/PageHeader";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentNetwork } from "@/components/agents/AgentNetwork";
import { AgentSummary } from "@/components/command-center/AgentSummary";
import { useLiveAgents } from "@/hooks/useLiveAgents";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import { agentStatusVisual } from "@/lib/agent-status";
import { getAgentRelations } from "@/lib/mock/agent-registry";
import { agentHref } from "@/lib/navigation";
import type { Agent } from "@/lib/types";

/**
 * Roster groups. Ordered by how much attention each band deserves: live work
 * first, then anything stalled, then dormant agents.
 */
const GROUPS: Array<{
  key: string;
  label: string;
  statuses: Agent["status"][];
}> = [
  {
    key: "active",
    label: "Active",
    statuses: ["working", "thinking", "listening"],
  },
  {
    key: "attention",
    label: "Needs Attention",
    statuses: ["waiting", "blocked", "error"],
  },
  {
    key: "dormant",
    label: "Idle",
    statuses: ["idle", "completed", "offline"],
  },
];

/**
 * Agent Network — the roster screen.
 *
 * An operations view of the whole agent fleet: aggregate counts, the
 * relationship graph, and the roster grouped by state. Selecting a card
 * targets that agent for voice; opening one enters its workspace.
 */
export default function AgentRosterClient() {
  const router = useRouter();
  const { agents, loading, error } = useLiveAgents();
  const { setAgents, setActiveAgentId, activeAgentId } = useVoiceContext();

  const [networkSelection, setNetworkSelection] = useState<string | null>(null);

  useEffect(() => {
    setAgents(agents.map(({ id, name }) => ({ id, name })));
  }, [agents, setAgents]);

  const counts = useMemo(() => {
    let active = 0;
    let waiting = 0;
    let idle = 0;
    for (const a of agents) {
      if (["working", "thinking", "listening"].includes(a.status)) active++;
      else if (["waiting", "blocked", "error"].includes(a.status)) waiting++;
      else idle++;
    }
    return { total: agents.length, active, waiting, idle };
  }, [agents]);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        agents: agents.filter((a) => g.statuses.includes(a.status)),
      })).filter((g) => g.agents.length > 0),
    [agents],
  );

  /** Selecting targets the agent for voice; it does not navigate. */
  const selectAgent = useCallback(
    (agent: Agent) => {
      setNetworkSelection(agent.id);
      setActiveAgentId(agent.id === activeAgentId ? null : agent.id);
    },
    [activeAgentId, setActiveAgentId],
  );

  /** Opening enters the agent's workspace. */
  const openAgent = useCallback(
    (agent: Agent) => {
      setActiveAgentId(agent.id);
      router.push(agentHref(agent.id) as Route);
    },
    [router, setActiveAgentId],
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Agent Network"
        subtitle="Roster · status · relationships"
        meta={[
          { label: "REGISTERED", value: String(counts.total).padStart(2, "0") },
          { label: "ACTIVE", value: String(counts.active).padStart(2, "0") },
          { label: "ATTENTION", value: String(counts.waiting).padStart(2, "0") },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 p-3 pb-0 sm:p-4 sm:pb-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Relationship graph */}
        <Panel
          title="Network Topology"
          eyebrow={`${getAgentRelations().length} LINKS`}
          status="info"
          statusLive
          brackets
          stagger={0}
          footer={
            <p className="t-timestamp">
              Click to target · double-click or Enter to open a workspace.
            </p>
          }
        >
          <AgentNetwork
            agents={agents}
            relations={getAgentRelations()}
            selectedAgentId={networkSelection ?? activeAgentId}
            onSelect={selectAgent}
            onOpen={openAgent}
          />
        </Panel>

        {/* Fleet summary */}
        <Panel
          title="Fleet Status"
          eyebrow={loading ? "SYNCING" : "REGISTERED"}
          status={error ? "warn" : "active"}
          statusLive={!error && !loading}
          stagger={1}
          className="flex flex-col"
          fill
        >
          <AgentSummary counts={counts} className="mb-3" />
          <div className="hud-rule mb-3" />

          {error && (
            <p className="t-meta mb-3 text-hud-amber">
              Live roster unavailable ({error}) — showing last known state.
            </p>
          )}

          <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto">
            {agents.map((a) => {
              const visual = agentStatusVisual(a.status);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => openAgent(a)}
                    className="flex w-full items-baseline gap-3 border-b border-line-soft py-2 text-left transition-colors last:border-b-0 hover:bg-hud-cyan/[0.04]"
                  >
                    <span className="w-[74px] flex-none font-hud text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
                      {a.name}
                    </span>
                    <span className="t-label w-[80px] flex-none">{a.role}</span>
                    <span className="t-meta min-w-0 flex-1 truncate">
                      {a.currentTask ?? a.activity ?? "—"}
                    </span>
                    <span
                      className={`flex-none font-hud text-[9px] font-semibold uppercase tracking-[0.16em] ${visual.text}`}
                    >
                      {visual.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* Grouped roster */}
      <div className="flex-1 p-3 sm:p-4">
        {agents.length === 0 && !loading ? (
          <Panel title="Roster" eyebrow="EMPTY" status="warn">
            <p className="t-meta py-8">No agents registered on this network.</p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {grouped.map((group, gi) => (
              <Panel
                key={group.key}
                title={group.label}
                eyebrow={`${group.agents.length}`}
                status={
                  group.key === "active"
                    ? "active"
                    : group.key === "attention"
                      ? "warn"
                      : "neutral"
                }
                statusLive={group.key === "active"}
                stagger={2 + gi}
              >
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {group.agents.map((agent, i) => (
                    <li key={agent.id} className="h-full">
                      <AgentCard
                        agent={agent}
                        onSelect={openAgent}
                        selected={agent.id === activeAgentId}
                        stagger={3 + gi + i}
                      />
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
