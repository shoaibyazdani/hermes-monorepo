"use client";

import { useState } from "react";
import { Panel } from "@/components/hud/Panel";
import { StatusLine } from "@/components/hud/StatusLine";
import { VoiceInputBar } from "@/components/voice/VoiceInputBar";
import { TerminalLog } from "@/components/voice/TerminalLog";
import { RadarSVG, type RadarAgent } from "@/components/hud/RadarSVG";
import { ChatModal } from "@/components/hud/ChatModal";
import { JarvisHeader } from "@/components/hud/JarvisHeader";
import { useAgents } from "@/hooks/useAgents";
import { useTrading } from "@/hooks/useTrading";
import { useClock } from "@/hooks/useClock";

const FALLBACK_AGENTS: RadarAgent[] = [
  { id: "joy", name: "JOY", status: "idle", x: 200, y: 70 },
  { id: "quant", name: "QUANT", status: "idle", x: 70, y: 200 },
  { id: "sentinel", name: "SENTINEL", status: "idle", x: 330, y: 200 },
];

export default function CommandCenterClient() {
  const { agents } = useAgents();
  const { trading } = useTrading();
  const { utc, pkt } = useClock();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [chatAgentName, setChatAgentName] = useState<string>("");

  const radarAgents: RadarAgent[] = agents.length > 0 ? agents : FALLBACK_AGENTS;

  const openChat = (id: string, name: string) => {
    setChatAgentId(id);
    setChatAgentName(name);
    setChatOpen(true);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Legacy Live Talk launcher pill — kept for Phase 1 compat (test contract).
          Voice activation is now handled by VoiceInputBar / ChatModal; this hidden
          button exists so legacy scripts/CSS that look for #ltLauncher still work. */}
      <button
        id="ltLauncher"
        hidden
        title="Open Live Talk"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>

      {/* JARVIS header (dramatic, like landing page) */}
      <JarvisHeader tagline="// COMMAND CENTER // Markets · Radar · Specialized Agents //" />

      {/* Topbar — preserved status line */}
      <div className="flex-none px-6 pb-3 animate-glitch">
        <div className="flex gap-4 font-data text-xs text-ink-mute justify-end">
          <span className="flex items-center gap-2 px-2 py-1 bg-black/30 border border-hudcss-cyan-faint rounded">
            <span className="w-2 h-2 rounded-full bg-hud-green animate-pulse-dot" />
            Online
          </span>
          <span className="flex items-center gap-2 px-2 py-1 bg-black/30 border border-hudcss-cyan-faint rounded">
            {utc}
          </span>
          <span className="flex items-center gap-2 px-2 py-1 bg-black/30 border border-hudcss-cyan-faint rounded">
            {pkt}
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)_minmax(280px,1fr)] gap-4 px-4 py-2">
        {/* Left: Trading */}
        <div className="flex flex-col gap-3">
          <div className="panel-title">Markets</div>
          {trading?.prices.map((p) => (
            <Panel key={p.symbol}>
              <div className="font-data">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-hud text-xs text-ink-mute uppercase tracking-[0.2em]">
                    {p.symbol}
                  </span>
                </div>
                <div
                  className={`text-4xl font-bold tabular-nums ${
                    p.changePct >= 0 ? "text-hud-green" : "text-hud-red"
                  }`}
                  style={{
                    textShadow:
                      p.changePct >= 0
                        ? "0 0 12px rgba(16,185,129,0.4)"
                        : "0 0 12px rgba(255,59,48,0.4)",
                  }}
                >
                  ${p.price.toFixed(2)}
                </div>
                <div
                  className={`text-sm font-semibold mt-1 ${
                    p.changePct >= 0 ? "text-hud-green" : "text-hud-red"
                  }`}
                >
                  {p.changePct >= 0 ? "+" : ""}
                  {p.change.toFixed(2)} ({p.changePct.toFixed(2)}%)
                </div>
              </div>
            </Panel>
          ))}
          <div className="panel-title">Portfolio</div>
          <Panel>
            <div className="font-data">
              <div className="text-xs text-amber uppercase tracking-[0.2em] font-hud font-semibold">
                Total Balance (USD)
              </div>
              <div
                className="text-2xl font-bold tabular-nums text-amber"
                style={{ textShadow: "0 0 12px var(--amber-glow)" }}
              >
                ${trading?.balance.total.toFixed(2) ?? "—"}
              </div>
              <div className="text-sm text-hud-green mt-1">
                P&amp;L: +${trading?.balance.pnl.toFixed(2) ?? "—"}
              </div>
            </div>
          </Panel>
        </div>

        {/* Center: Radar */}
        <div className="flex items-center justify-center bg-radial-radial">
          <div className="w-full max-w-[700px]">
            <RadarSVG
              agents={radarAgents}
              onAgentClick={(id) => {
                const a = radarAgents.find((x) => x.id === id);
                if (a) openChat(a.id, a.name);
              }}
            />
            <div className="text-center mt-4 font-hud text-xs tracking-[0.3em] text-ink-mute uppercase">
              Listening
            </div>
          </div>
        </div>

        {/* Right: Notifications + Comms */}
        <div className="flex flex-col gap-3">
          <div className="panel-title">Specialized Agents</div>
          {radarAgents.map((a) => (
            <Panel key={a.id}>
              <div className="flex items-center gap-2">
                <span
                  className="text-xl"
                  style={{ filter: `drop-shadow(0 0 8px var(--cyan))` }}
                >
                  ◆
                </span>
                <span className="flex-1 font-hud text-sm font-semibold tracking-[0.05em]">
                  {a.name}
                </span>
                <span
                  className={`font-hud text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.1em] ${
                    a.status === "working"
                      ? "bg-hud-green/20 text-hud-green"
                      : a.status === "sleeping"
                      ? "bg-[#818cf8]/20 text-[#818cf8]"
                      : a.status === "error"
                      ? "bg-hud-red/20 text-hud-red"
                      : "bg-hudcss-cyan-faint text-ink-mute"
                  }`}
                >
                  {a.status}
                </span>
              </div>
            </Panel>
          ))}
          <div className="panel-title">Comms Log</div>
          <Panel>
            <TerminalLog />
          </Panel>
        </div>
      </div>

      {/* Footer / voice bar */}
      <div className="flex-none max-w-[1400px] w-full mx-auto mt-4 px-6 pb-5 animate-glitch">
        <VoiceInputBar />
        <StatusLine
          items={[
            { label: "", value: "ONLINE", pulse: true },
            { label: "AGENTS", value: `${radarAgents.length}` },
            { label: "MARKETS", value: trading ? "LIVE" : "—" },
            { label: "TIME", value: utc },
          ]}
        />
      </div>

      {/* Chat modal */}
      {chatOpen && chatAgentId && (
        <ChatModal
          open={chatOpen}
          agentId={chatAgentId}
          agentName={chatAgentName}
          onClose={() => setChatOpen(false)}
        />
      )}
    </main>
  );
}
