"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/hud/Panel";
import { DataRow } from "@/components/hud/DataRow";
import { StatusDot } from "@/components/hud/StatusDot";
import { AgentAvatar } from "./AgentAvatar";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { AgentActivity } from "./AgentActivity";
import { AgentMission } from "./AgentMission";
import { useOperations } from "@/components/operations/OperationsProvider";
import { Meter } from "@/components/hud/Meter";
import { missionHref } from "@/lib/navigation";
import { AgentConversation } from "@/components/chat/AgentConversation";
import { AgentNetwork } from "./AgentNetwork";
import { SimulationControls } from "@/components/operations/SimulationControls";
import { AgentCapabilities, AgentTools } from "./AgentCapabilities";
import {
  AgentConfigPanel,
  AgentMemoryPreview,
  AgentTelemetryPanel,
} from "./AgentTelemetryPanel";
import { useAgent } from "@/hooks/useAgent";
import { useLiveAgents } from "@/hooks/useLiveAgents";
import { useElapsed } from "@/hooks/useElapsed";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import { agentStatusVisual, RELATION_VISUALS } from "@/lib/agent-status";
import { getAgentRelations } from "@/lib/mock/agent-registry";
import { formatClock } from "@/lib/format";
import type { Agent } from "@/lib/types";

interface AgentWorkspaceProps {
  agentId: string;
}

/**
 * AgentWorkspace — one agent's operational screen.
 *
 * Rendered by both `/agents/[agentId]` and the preserved `/apex` route, so the
 * workspace exists once regardless of how it was reached.
 *
 * Layout intent: identity and status first, then the work (mission → task →
 * step), then the evidence (activity), then the machinery (tools, config,
 * telemetry, memory), then the network, with the channel anchored at the end
 * as the primary action.
 */
export function AgentWorkspace({ agentId }: AgentWorkspaceProps) {
  const {
    agent,
    mission,
    isMissionLead,
    activity,
    loading,
    error,
    agentName,
  } = useAgent(agentId);

  const { agents } = useLiveAgents();
  const { setAgents, setActiveAgentId, activeAgentId } = useVoiceContext();
  // Live operational assignment, from the shared operations store rather than
  // the static mock mission on the agent record.
  const { missionForAgent, taskForAgent, live, activeOrchestrations } =
    useOperations();

  // Only where a simulated orchestration is actually on screen: the transport
  // has nothing to drive on an agent that is not part of one.
  const showSimulationTransport =
    !live &&
    activeOrchestrations.some(
      (o) =>
        o.conversationId.startsWith("simulation-") &&
        (agentId === "hermes" || o.steps.some((st) => st.agentId === agentId)),
    );
  const elapsed = useElapsed(agent?.startedAt);
  const channelRef = useRef<HTMLDivElement>(null);

  // Publish the roster so @-mention routing works from this page too.
  useEffect(() => {
    setAgents(agents.map(({ id, name }) => ({ id, name })));
  }, [agents, setAgents]);

  const isVoiceTarget = activeAgentId === agentId;

  /** Target this agent for voice and scroll the channel into view. */
  const openChannel = useCallback(() => {
    setActiveAgentId(agentId);
    channelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // The composer is a textarea (Shift+Enter inserts newlines), so target it
    // by id rather than by tag.
    document
      .getElementById(`composer-${agentId}`)
      ?.focus({ preventScroll: true });
  }, [agentId, setActiveAgentId]);

  if (loading && !agent) {
    return (
      <div className="p-4">
        <Panel title="Agent Workspace" eyebrow="LOADING">
          <p className="t-meta py-8">Resolving agent record…</p>
        </Panel>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-4">
        <Panel title="Agent Not Found" eyebrow={agentId.toUpperCase()} status="warn">
          <p className="t-meta py-4">
            No agent is registered under{" "}
            <span className="font-data text-ink">{agentId}</span>
            {error ? ` (roster unavailable: ${error})` : ""}.
          </p>
          <Link
            href={"/agents" as Route}
            className="clip-hud-sm mt-2 inline-flex items-center gap-1.5 border border-hud-cyan/50 bg-hud-cyan/10 px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-hud-cyan"
          >
            <ArrowLeft size={12} strokeWidth={2} aria-hidden />
            Agent network
          </Link>
        </Panel>
      </div>
    );
  }

  const visual = agentStatusVisual(agent.status);
  const operation = missionForAgent(agent.id);
  const opTask = taskForAgent(agent.id);

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex-none border-b border-line-soft px-3 py-3 sm:px-4">
        <Link
          href={"/agents" as Route}
          className="inline-flex items-center gap-1.5 font-hud text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-hud-cyan"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden />
          Agent network
        </Link>

        <div className="mt-2.5 flex flex-wrap items-start gap-x-4 gap-y-3">
          <AgentAvatar agent={agent} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="font-hud text-lg font-bold uppercase tracking-[0.24em] text-ink">
                {agent.name}
              </h1>
              {agent.codename && (
                <span className="font-data text-[11px] tracking-[0.1em] text-ink-ghost">
                  {agent.codename}
                </span>
              )}
              <AgentStatusBadge status={agent.status} />
              {isVoiceTarget && (
                <span className="clip-hud-sm flex items-center gap-1.5 border border-hud-cyan/50 bg-hud-cyan/10 px-2 py-0.5">
                  <StatusDot tone="info" live size="xs" />
                  <span className="font-hud text-[9px] font-bold uppercase tracking-[0.16em] text-hud-cyan">
                    Voice target
                  </span>
                </span>
              )}
            </div>

            <p className="t-label mt-1.5">{agent.role} AGENT</p>
            {agent.description && (
              <p className="t-meta mt-1.5 max-w-prose text-ink-mute">
                {agent.description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={openChannel}
            className="clip-hud-sm flex flex-none items-center gap-2 border border-hud-cyan/60 bg-hud-cyan/10 px-3 py-2 font-hud text-[10px] font-bold uppercase tracking-[0.18em] text-hud-cyan transition-colors hover:bg-hud-cyan/20"
          >
            <MessageSquare size={13} strokeWidth={1.9} aria-hidden />
            Talk to {agent.name}
          </button>
        </div>

        {error && (
          <p className="t-meta mt-3 text-hud-amber">
            Live roster unavailable ({error}) — showing last known state.
          </p>
        )}
      </header>

      {/* ── Current operation ───────────────────────────────────────────── */}
      {operation && (
        <div className="p-3 pb-0 sm:p-4 sm:pb-0">
          <Panel
            title="Current Operation"
            eyebrow={operation.code}
            status="active"
            statusLive
            variant="active"
            brackets
            stagger={0}
            actions={
              <Link
                href={missionHref(operation.id) as Route}
                className="clip-hud-sm flex items-center gap-1.5 border border-hud-cyan/50 bg-hud-cyan/10 px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] text-hud-cyan transition-colors hover:bg-hud-cyan/20"
              >
                Open mission →
              </Link>
            }
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <h2 className="min-w-0 flex-1 font-hud text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
                {operation.title}
              </h2>
              <span className="flex-none font-data text-xs font-bold tabular-nums text-ink-mute">
                {operation.progress}%
              </span>
            </div>
            <Meter
              value={operation.progress}
              tone={operation.status === "blocked" ? "elevated" : "nominal"}
              className="mt-2"
              label={`${operation.code} progress`}
            />

            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <Field label="TASK" value={opTask?.title ?? "—"} />
              <Field
                label="STEP"
                value={opTask?.currentStep ?? "—"}
                muted
              />
              <Field label="PHASE" value={operation.phase ?? "—"} muted />
            </div>

            {opTask?.status === "blocked" && opTask.blockedReason && (
              <p className="t-meta mt-2.5 border-l-2 border-hud-amber/50 pl-2 text-hud-amber">
                {opTask.blockedReason}
              </p>
            )}
          </Panel>
        </div>
      )}

      {/* ── Band 1: mission + status ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 p-3 pb-0 sm:p-4 sm:pb-0 lg:grid-cols-2">
        <Panel
          title="Current Mission"
          eyebrow={mission ? (isMissionLead ? "LEAD" : "SUPPORT") : "UNASSIGNED"}
          status={mission ? "active" : "neutral"}
          statusLive={Boolean(mission)}
          stagger={0}
        >
          <AgentMission
            mission={mission}
            isLead={isMissionLead}
            agentName={agentName}
          />
        </Panel>

        <Panel
          title="Agent Status"
          eyebrow="RUNTIME"
          status={visual.tone}
          statusLive={visual.live}
          variant={visual.tone === "warn" ? "warning" : "active"}
          stagger={1}
        >
          {/* Mission → task → step: three distinct levels of granularity. */}
          <div className="space-y-2.5">
            <Field label="CURRENT TASK" value={agent.currentTask ?? "—"} />
            <Field label="CURRENT STEP" value={agent.currentStep ?? "—"} muted />
          </div>

          <div className="hud-rule my-3" />

          <DataRow
            label="Started"
            value={agent.startedAt ? formatClock(agent.startedAt) : "—"}
            divider
          />
          <DataRow
            label="Active for"
            value={agent.startedAt ? elapsed : "—"}
            divider
          />
          <DataRow
            label="Last seen"
            value={agent.lastSeen ? formatClock(agent.lastSeen) : "—"}
            tone="muted"
            divider
          />
          <DataRow
            label="Runtime"
            value={agent.config?.model ?? "—"}
            tone="accent"
            divider
          />
          <DataRow
            label="Channel"
            value={agent.sessionOpen ? "OPEN" : "CLOSED"}
            tone={agent.sessionOpen ? "positive" : "muted"}
          />
        </Panel>
      </div>

      {/* ── Band 2: activity + capabilities/tools ───────────────────────── */}
      <div className="grid grid-cols-1 gap-3 p-3 pb-0 sm:p-4 sm:pb-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel
          title="Live Activity"
          eyebrow={`${activity.length} EVENTS`}
          status="info"
          statusLive
          stagger={2}
        >
          <div className="max-h-[340px] overflow-y-auto pr-1">
            <AgentActivity
              events={activity}
              agentName={agentName}
              emptyMessage={`No activity recorded for ${agent.name}.`}
            />
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title="Capabilities" eyebrow="COMPETENCIES" stagger={3}>
            <AgentCapabilities capabilities={agent.capabilities} />
          </Panel>

          <Panel
            title="Available Tools"
            eyebrow={`${agent.tools?.filter((t) => t.enabled).length ?? 0} ENABLED`}
            stagger={4}
            footer={
              <p className="t-timestamp">
                Informational — the tool runtime lands in a later phase.
              </p>
            }
          >
            <AgentTools tools={agent.tools} />
          </Panel>
        </div>
      </div>

      {/* ── Band 3: telemetry, config, memory ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 p-3 pb-0 sm:p-4 sm:pb-0 lg:grid-cols-3">
        <Panel
          title="Agent Telemetry"
          eyebrow="SIMULATED"
          stagger={5}
          footer={
            <p className="t-timestamp">
              Mock counters — not production telemetry.
            </p>
          }
        >
          <AgentTelemetryPanel telemetry={agent.telemetry} />
        </Panel>

        <Panel title="Configuration" eyebrow="READ ONLY" stagger={6}>
          <AgentConfigPanel config={agent.config} />
          {agent.registeredAt && (
            <>
              <div className="hud-rule my-3" />
              <DataRow
                label="Registered"
                value={agent.registeredAt.slice(0, 10)}
                tone="muted"
              />
            </>
          )}
        </Panel>

        <Panel title="Agent Memory" eyebrow="PREVIEW" stagger={7}>
          <AgentMemoryPreview memory={agent.memory} />
        </Panel>
      </div>

      {/* ── Band 4: network + channel ───────────────────────────────────── */}
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel
          title="Network Position"
          eyebrow="RELATIONSHIPS"
          stagger={8}
          footer={
            <p className="t-timestamp">
              Mock relationships — no agent-to-agent channel exists yet.
            </p>
          }
        >
          <AgentNetwork
            agents={agents}
            relations={getAgentRelations()}
            selectedAgentId={agent.id}
          />

          <RelationList agentId={agent.id} agentName={agentName} />
        </Panel>

        <Panel
          title={`${agent.name} Channel`}
          eyebrow={isVoiceTarget ? "TARGETED" : "IDLE"}
          status={isVoiceTarget ? "info" : "neutral"}
          statusLive={isVoiceTarget}
          variant={isVoiceTarget ? "active" : "default"}
          stagger={9}
          className="flex flex-col"
          fill
          // The transport appears where a simulated orchestration is visible,
          // so the scenario can be driven from the channel showing it rather
          // than only from Operations.
          actions={showSimulationTransport ? <SimulationControls /> : undefined}
        >
          <div ref={channelRef} className="flex min-h-0 flex-1 flex-col">
            <AgentConversation agent={agent} className="flex-1" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** The agent's edges, written out so the graph is readable without hovering. */
function RelationList({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: (id: string) => string | undefined;
}) {
  const rels = getAgentRelations().filter(
    (r) => r.fromAgentId === agentId || r.toAgentId === agentId,
  );
  if (rels.length === 0) return null;

  const name = (id: string) => agentName(id) ?? id.toUpperCase();

  return (
    <ul className="mt-3 space-y-0">
      {rels.map((r, i) => {
        const visual = RELATION_VISUALS[r.kind];
        const outgoing = r.fromAgentId === agentId;
        const other = outgoing ? r.toAgentId : r.fromAgentId;
        return (
          <li
            key={`${r.fromAgentId}-${r.toAgentId}-${i}`}
            className="flex items-baseline gap-2 border-b border-line-soft py-1.5 last:border-b-0"
          >
            <span aria-hidden className="t-timestamp flex-none">
              {outgoing ? "→" : "←"}
            </span>
            <span className="flex-none font-hud text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
              {name(other)}
            </span>
            <span
              className={cn(
                "flex-none font-hud text-[9px] uppercase tracking-[0.16em]",
                visual.text,
              )}
            >
              {visual.label}
            </span>
            {r.label && (
              <span className="t-timestamp ml-auto truncate">{r.label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Field({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="t-label">{label}</div>
      <p
        className={cn(
          "t-command mt-0.5",
          muted ? "text-ink-mute" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
