"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/hud/Panel";
import { DataRow } from "@/components/hud/DataRow";
import { PageHeader } from "@/components/shell/PageHeader";
import { RadarSVG } from "@/components/hud/RadarSVG";
import { ChatModal } from "@/components/hud/ChatModal";
import { AgentIndicator } from "@/components/agents/AgentIndicator";
import { AgentActivity } from "@/components/agents/AgentActivity";
import { OperationsList } from "@/components/telemetry/OperationsList";
import { TerminalLog } from "@/components/voice/TerminalLog";
import { useAgents, useAgentNameLookup } from "@/hooks/useAgents";
import { useTrading } from "@/hooks/useTrading";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import { agentStatusVisual } from "@/lib/agent-status";
import { getMockActivity } from "@/lib/mock/activity";
import { getMockMissions } from "@/lib/mock/missions";

const ACTIVITY = getMockActivity();
const MISSIONS = getMockMissions();

/**
 * Live Operations — the real-time situational view.
 *
 * Radar plot of the agent network, market feed from `/api/trading`, live
 * mission traffic and the comms channel. Distinct from the Command Center at
 * `/`, which is the overview; this is the moment-to-moment picture.
 */
export default function CommandCenterClient() {
  const { agents, error: agentsError } = useAgents();
  const { trading, error: tradingError } = useTrading();
  const { setAgents, setActiveAgentId } = useVoiceContext();
  const agentName = useAgentNameLookup(agents);

  const [chatAgent, setChatAgent] = useState<{ id: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    setAgents(agents.map(({ id, name }) => ({ id, name })));
  }, [agents, setAgents]);

  const openChat = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    setActiveAgentId(agent.id);
    setChatAgent({ id: agent.id, name: agent.name });
  };

  const liveCount = agents.filter((a) => agentStatusVisual(a.status).live).length;
  const activeMissions = MISSIONS.filter(
    (m) => m.status === "active" || m.status === "blocked",
  );

  return (
    <div className="flex min-h-full flex-col">
      {/* Legacy Live Talk launcher — retained for Phase 1 compatibility. Voice
          activation is handled by VoiceCommandBar / ChatModal; this hidden
          button exists so legacy scripts that look for #ltLauncher still find it. */}
      <button id="ltLauncher" hidden aria-hidden="true" tabIndex={-1} />

      <PageHeader
        title="Live Operations"
        subtitle="Agent radar · market feed · mission traffic"
        meta={[
          { label: "PLOTTED", value: `${agents.length}` },
          { label: "LIVE", value: `${liveCount}` },
          { label: "FEED", value: trading ? "ONLINE" : "—" },
        ]}
      />

      <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ── Markets ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <Panel
            title="Markets"
            eyebrow={trading ? `${trading.prices.length} PAIRS` : "SYNCING"}
            status={tradingError ? "warn" : "active"}
            statusLive={!tradingError && Boolean(trading)}
            stagger={0}
          >
            {tradingError && (
              <p className="t-meta mb-2 text-hud-amber">
                Feed unavailable ({tradingError}).
              </p>
            )}
            {!trading ? (
              <p className="t-meta py-6">Awaiting market feed…</p>
            ) : trading.prices.length === 0 ? (
              <p className="t-meta py-6">No instruments tracked.</p>
            ) : (
              <ul className="space-y-3">
                {trading.prices.map((p) => {
                  const up = p.changePct >= 0;
                  return (
                    <li
                      key={p.symbol}
                      className="border-b border-line-soft pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="t-label">{p.symbol}</span>
                        <span
                          className={
                            "font-data text-[11px] font-semibold tabular-nums " +
                            (up ? "text-hud-green" : "text-hud-red")
                          }
                        >
                          {up ? "+" : ""}
                          {p.changePct.toFixed(2)}%
                        </span>
                      </div>
                      <div
                        className={
                          "t-metric mt-1 " +
                          (up ? "text-hud-green" : "text-hud-red")
                        }
                      >
                        ${p.price.toFixed(2)}
                      </div>
                      <div className="t-timestamp mt-1">
                        {up ? "+" : ""}
                        {p.change.toFixed(2)} absolute
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Portfolio" eyebrow="USD" status="info" stagger={1}>
            {trading ? (
              <>
                <div className="t-metric text-hud-cyan">
                  ${trading.balance.total.toFixed(2)}
                </div>
                <DataRow
                  label="Unrealised P&L"
                  value={`${trading.balance.pnl >= 0 ? "+" : ""}$${trading.balance.pnl.toFixed(2)}`}
                  tone={trading.balance.pnl >= 0 ? "positive" : "negative"}
                  className="mt-2"
                  divider
                />
                <DataRow
                  label="Open positions"
                  value={`${trading.trades.length}`}
                  tone="muted"
                />
              </>
            ) : (
              <p className="t-meta py-4">Awaiting balance…</p>
            )}
          </Panel>

          <Panel
            title="Recent Trades"
            eyebrow={trading ? `${trading.trades.length}` : "—"}
            stagger={2}
            className="flex-1"
          >
            {!trading || trading.trades.length === 0 ? (
              <p className="t-meta py-4">No trades executed.</p>
            ) : (
              <ul>
                {trading.trades.map((t, i) => (
                  <li key={`${t.symbol}-${i}`}>
                    <DataRow
                      label={`${t.side.toUpperCase()} ${t.symbol}`}
                      value={`${t.amount}`}
                      aside={`${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}`}
                      tone={t.side === "buy" ? "positive" : "negative"}
                      divider
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── Radar ──────────────────────────────────────────────────── */}
        <Panel
          title="Agent Radar"
          eyebrow="NETWORK PLOT"
          status={agentsError ? "warn" : "active"}
          statusLive={!agentsError}
          brackets
          stagger={3}
          className="lg:col-span-2 xl:col-span-1"
          footer={
            <p className="t-timestamp">
              Select a plotted agent to open its command channel.
            </p>
          }
        >
          <div className="bg-radial-radial mx-auto aspect-square w-full max-w-[520px]">
            <RadarSVG agents={agents} onAgentClick={openChat} />
          </div>

          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {agents.map((a) => (
              <li key={a.id}>
                <AgentIndicator agent={a} showStatus />
              </li>
            ))}
          </ul>
        </Panel>

        {/* ── Traffic ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <Panel
            title="Mission Traffic"
            eyebrow={`${activeMissions.length} IN FLIGHT`}
            status={
              activeMissions.some((m) => m.status === "blocked")
                ? "warn"
                : "active"
            }
            statusLive
            stagger={4}
          >
            <OperationsList
              missions={activeMissions}
              agentName={agentName}
              limit={3}
            />
          </Panel>

          <Panel title="Event Stream" eyebrow="LIVE" status="info" stagger={5}>
            <AgentActivity events={ACTIVITY} agentName={agentName} limit={5} />
          </Panel>

          <Panel
            title="Comms"
            eyebrow="CHANNEL"
            status="info"
            stagger={6}
            className="flex-1"
          >
            <TerminalLog />
          </Panel>
        </div>
      </div>

      {chatAgent && (
        <ChatModal
          open
          agentId={chatAgent.id}
          agentName={chatAgent.name}
          onClose={() => setChatAgent(null)}
        />
      )}
    </div>
  );
}
