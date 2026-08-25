"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/hud/Panel";
import { StatusLine } from "@/components/hud/StatusLine";
import { VoiceInputBar } from "@/components/voice/VoiceInputBar";
import { TerminalLog } from "@/components/voice/TerminalLog";
import { ChatModal } from "@/components/hud/ChatModal";
import { JarvisHeader } from "@/components/hud/JarvisHeader";
import { useTrading } from "@/hooks/useTrading";
import { useAgents } from "@/hooks/useAgents";
import { useClock } from "@/hooks/useClock";
import { useVoiceContext } from "@/components/voice/VoiceProvider";

export default function ApexClient() {
  const { trading } = useTrading();
  const { agents } = useAgents();
  const { utc } = useClock();
  const { setAgents } = useVoiceContext();

  // Push the agent list into VoiceContext so @-mention parsing knows the agents.
  useEffect(() => {
    setAgents(agents.map(({ id, name }) => ({ id, name })));
  }, [agents, setAgents]);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState({ id: "", name: "" });

  const btc = trading?.prices.find((p) => p.symbol === "BTC/USD");
  const eth = trading?.prices.find((p) => p.symbol === "ETH/USD");
  const sol = trading?.prices.find((p) => p.symbol === "SOL/USD");

  const activeAgents = agents.filter(
    (a) => a.status === "working" || a.status === "ready"
  );

  const openChat = (id: string, name: string) => {
    setChatAgent({ id, name });
    setChatOpen(true);
  };

  const fmt = (n: number | undefined) =>
    typeof n === "number" && !Number.isNaN(n)
      ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : "—";

  return (
    <main className="min-h-screen flex flex-col">
      {/* JARVIS header (dramatic, like landing page) */}
      <JarvisHeader
        tagline="// APEX · HUMANOID OS // Multi-agent execution view //"
        current="agents"
      />

      {/* Apex headline */}
      <div className="text-center px-6 pt-8 pb-4 font-hud">
        <div className="text-xs tracking-[0.5em] text-cyan/70 uppercase mb-2">
          Apex · Humanoid OS
        </div>
        <h1
          className="text-4xl md:text-5xl font-bold tracking-[0.3em]"
          style={{
            color: "#ff6432",
            textShadow: "0 0 20px rgba(255, 100, 50, 0.8)",
            textTransform: "uppercase",
          }}
        >
          Apex
        </h1>
        <div className="mt-2 text-xs tracking-[0.4em] text-hud-cyan uppercase">
          Run your business · from anywhere
        </div>
      </div>

      {/* Main 3-col grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-2">
        {/* Left: System stats */}
        <div className="flex flex-col gap-3">
          <Panel stagger={1}>
            <div className="font-hud text-xs tracking-[0.3em] text-hud-cyan uppercase">
              Active Agents
            </div>
            <div
              className="text-5xl font-bold text-hud-cyan tabular-nums mt-1"
              style={{ textShadow: "0 0 12px var(--cyan-glow)" }}
            >
              {activeAgents.length}
              <span className="text-base text-ink-mute ml-2">
                / {agents.length}
              </span>
            </div>
            <div className="text-xs text-ink-mute mt-1 uppercase tracking-wider">
              live
            </div>
          </Panel>
          <Panel stagger={2}>
            <div className="font-hud text-xs tracking-[0.3em] text-hud-cyan uppercase">
              ETH/USD
            </div>
            <div
              className={`text-3xl font-bold tabular-nums mt-1 ${
                (eth?.changePct ?? 0) >= 0 ? "text-hud-green" : "text-hud-red"
              }`}
              style={{ textShadow: "0 0 12px var(--cyan-glow)" }}
            >
              {fmt(eth?.price)}
            </div>
            <div
              className={`text-sm font-semibold mt-1 ${
                (eth?.changePct ?? 0) >= 0 ? "text-hud-green" : "text-hud-red"
              }`}
            >
              {eth ? `${eth.changePct >= 0 ? "+" : ""}${eth.changePct.toFixed(2)}%` : "—"}
            </div>
          </Panel>
          <Panel stagger={3}>
            <div className="font-hud text-xs tracking-[0.3em] text-hud-cyan uppercase">
              BTC/USD
            </div>
            <div
              className={`text-3xl font-bold tabular-nums mt-1 ${
                (btc?.changePct ?? 0) >= 0 ? "text-hud-green" : "text-hud-red"
              }`}
              style={{ textShadow: "0 0 12px var(--cyan-glow)" }}
            >
              {fmt(btc?.price)}
            </div>
            <div
              className={`text-sm font-semibold mt-1 ${
                (btc?.changePct ?? 0) >= 0 ? "text-hud-green" : "text-hud-red"
              }`}
            >
              {btc ? `${btc.changePct >= 0 ? "+" : ""}${btc.changePct.toFixed(2)}%` : "—"}
            </div>
          </Panel>
        </div>

        {/* Center: silhouette SVG + quick actions */}
        <div className="flex flex-col items-center justify-start gap-4 relative">
          {/* Faint humanoid silhouette (static SVG; Phase 3 will add canvas particles) */}
          <div className="relative w-full max-w-[420px] aspect-[3/4]">
            <svg
              viewBox="0 0 600 800"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
              style={{ filter: "drop-shadow(0 0 24px rgba(0,200,255,0.25))" }}
            >
              <defs>
                <radialGradient id="apex-silhouette-glow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="rgba(0, 200, 255, 0.08)" />
                  <stop offset="100%" stopColor="rgba(0, 200, 255, 0)" />
                </radialGradient>
              </defs>
              <path
                d="M 300 80
                   C 220 80, 180 130, 180 200
                   C 180 250, 210 290, 240 305
                   C 230 320, 225 340, 235 365
                   C 220 370, 200 380, 180 400
                   C 150 420, 110 440, 80 480
                   C 60 540, 65 620, 90 700
                   C 105 760, 115 790, 120 800
                   L 480 800
                   C 485 790, 495 760, 510 700
                   C 535 620, 540 540, 520 480
                   C 490 440, 450 420, 420 400
                   C 400 380, 380 370, 365 365
                   C 375 340, 370 320, 360 305
                   C 390 290, 420 250, 420 200
                   C 420 130, 380 80, 300 80
                   Z"
                fill="url(#apex-silhouette-glow)"
                stroke="rgba(0, 200, 255, 0.2)"
                strokeWidth={1}
              />
              {/* Core glow dot at the chest */}
              <circle cx={300} cy={320} r={8} fill="rgba(0,200,255,0.9)">
                <animate
                  attributeName="r"
                  values="6;10;6"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;1;0.8"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </div>

          <div className="font-hud text-xs tracking-[0.5em] text-cyan/70 uppercase">
            Assembling
          </div>
        </div>

        {/* Right: System + Jobs + SOL */}
        <div className="flex flex-col gap-3">
          <Panel stagger={1}>
            <div className="font-hud text-xs tracking-[0.3em] text-hud-cyan uppercase">
              System
            </div>
            <div className="mt-2 space-y-1 text-xs font-data text-ink-mute">
              <div className="flex justify-between">
                <span>VPS</span>
                <span className="text-hud-green">● Online</span>
              </div>
              <div className="flex justify-between">
                <span>Network</span>
                <span className="text-hud-cyan">Tailscale · vps</span>
              </div>
              <div className="flex justify-between">
                <span>Uptime</span>
                <span className="text-hud-cyan">● ASSEMBLED</span>
              </div>
            </div>
          </Panel>
          <Panel stagger={2}>
            <div className="font-hud text-xs tracking-[0.3em] text-hud-cyan uppercase">
              Jobs Sent
            </div>
            <div
              className="text-3xl font-bold tabular-nums text-hud-cyan mt-1"
              style={{ textShadow: "0 0 12px var(--cyan-glow)" }}
            >
              —
            </div>
            <div className="text-xs text-ink-mute mt-1 uppercase tracking-wider">
              Phase 3 wires this to auto-apply.
            </div>
          </Panel>
          <Panel stagger={3}>
            <div className="font-hud text-xs tracking-[0.3em] text-hud-cyan uppercase">
              SOL/USD
            </div>
            <div
              className={`text-3xl font-bold tabular-nums mt-1 ${
                (sol?.changePct ?? 0) >= 0 ? "text-hud-green" : "text-hud-red"
              }`}
              style={{ textShadow: "0 0 12px var(--cyan-glow)" }}
            >
              {fmt(sol?.price)}
            </div>
            <div
              className={`text-sm font-semibold mt-1 ${
                (sol?.changePct ?? 0) >= 0 ? "text-hud-green" : "text-hud-red"
              }`}
            >
              {sol ? `${sol.changePct >= 0 ? "+" : ""}${sol.changePct.toFixed(2)}%` : "—"}
            </div>
          </Panel>
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
            { label: "AGENTS", value: `${activeAgents.length}/${agents.length}` },
            { label: "MARKETS", value: trading ? "LIVE" : "—" },
            { label: "TIME", value: utc },
          ]}
        />
      </div>

      {/* Chat modal */}
      {chatOpen && chatAgent.id && (
        <ChatModal
          open={chatOpen}
          agentId={chatAgent.id}
          agentName={chatAgent.name}
          onClose={() => setChatOpen(false)}
        />
      )}
    </main>
  );
}
