"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/hud/Panel";
import { RingSystem } from "@/components/hud/RingSystem";
import { Typewriter } from "@/components/hud/Typewriter";
import { StatusLine } from "@/components/hud/StatusLine";
import { VoiceInputBar } from "@/components/voice/VoiceInputBar";
import { TerminalLog } from "@/components/voice/TerminalLog";

export default function JarvisPage() {
  const [seconds, setSeconds] = useState(15591);
  const [ringLabel, setRingLabel] = useState("JARVIS");
  const [ringSub, setRingSub] = useState("Awaiting command");

  // Live uptime counter
  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Cycle ring center labels every 4s
  useEffect(() => {
    const labels = ["JARVIS", "STANDBY", "ONLINE"];
    const subs = ["Awaiting command", "Systems nominal", "Ready"];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % labels.length;
      setRingLabel(labels[i]);
      setRingSub(subs[i]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const uptime = `${hh}:${mm}:${ss}`;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex-none px-8 py-7 animate-glitch">
        <h1 className="font-hud text-4xl font-bold tracking-[0.4em] text-hud-cyan [text-shadow:0_0_12px_var(--cyan-glow)]">
          J.A.R.V.I.S.
        </h1>
        <div className="mt-2 font-data text-[11px] tracking-[0.3em] text-ink-mute uppercase">
          // Phase 2A on Next.js 14 — ambient layer //
        </div>
      </div>

      {/* Layout grid */}
      <div className="flex-1 grid grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)_minmax(280px,1fr)] gap-[18px] px-[18px] relative z-[2]">
        {/* Left column */}
        <div className="flex flex-col gap-[14px] min-h-0">
          <div className="font-hud text-sm tracking-[0.3em] text-hud-cyan uppercase [text-shadow:0_0_8px_var(--cyan-glow)] mb-3">
            SYSTEM STATUS
          </div>
          <Panel stagger={1}>
            <div className="font-data text-xs text-ink-mute space-y-1">
              <Row label="UPTIME" value={uptime} />
              <Row label="CPU" value="23%" tone="up" />
              <Row label="MEMORY" value="4.2 GB" tone="up" />
              <Row label="NETWORK LATENCY" value="84 ms" tone="down" />
              <Row label="ACTIVE THREADS" value="7" tone="amber" />
            </div>
          </Panel>

          <div className="font-hud text-sm tracking-[0.3em] text-hud-cyan uppercase [text-shadow:0_0_8px_var(--cyan-glow)] mb-3 mt-5">
            ACTIVE TASKS
          </div>
          <Panel stagger={2}>
            <div className="font-data text-xs text-ink-mute space-y-1">
              <Row label="SCAN.MARKETS" value="RUN" tone="up" />
              <Row label="TRADE.ETH" value="RUN" tone="up" />
              <Row label="SEND.APPLY" value="WAIT" tone="amber" />
              <Row label="WATCH.SCALPER" value="RUN" tone="up" />
            </div>
          </Panel>
        </div>

        {/* Center column */}
        <div className="flex flex-col gap-[14px] min-h-0">
          <Panel
            stagger={3}
            className="flex-1 flex items-center justify-center p-3 min-h-[320px]"
          >
            <RingSystem
              centerLabel={ringLabel}
              centerSubLabel={ringSub}
            />
          </Panel>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-[14px] min-h-0">
          <div className="font-hud text-sm tracking-[0.3em] text-hud-cyan uppercase [text-shadow:0_0_8px_var(--cyan-glow)] mb-3">
            NOTIFICATIONS
          </div>
          <Panel stagger={4}>
            <div className="font-data text-xs text-ink-mute space-y-1">
              <Row label="12:42" value="ALOIS SOLUTIONS" tone="up" />
              <Row label="11:08" value="SCAN COMPLETE" />
              <Row label="09:15" value="MARKETS OPEN" />
              <Row label="04:00" value="CRON APPLIED" />
            </div>
          </Panel>

          <div className="font-hud text-sm tracking-[0.3em] text-hud-cyan uppercase [text-shadow:0_0_8px_var(--cyan-glow)] mb-3 mt-5">
            COMMS LOG
          </div>
          <Panel stagger={5}>
            <TerminalLog />
          </Panel>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none max-w-[1400px] w-full mx-auto mt-[18px] px-6 pb-[22px] animate-glitch">
        <VoiceInputBar />
        <StatusLine
          items={[
            { label: "", value: "ONLINE", pulse: true },
            { label: "UPTIME", value: uptime },
            { label: "CPU", value: "23%" },
            { label: "MEM", value: "4.2 GB" },
          ]}
        />
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "amber";
}) {
  const toneClass =
    tone === "up"
      ? "text-hud-green [text-shadow:0_0_6px_rgba(16,185,129,0.4)]"
      : tone === "down"
      ? "text-hud-red [text-shadow:0_0_6px_rgba(255,59,48,0.4)]"
      : tone === "amber"
      ? "text-hud-amber [text-shadow:0_0_6px_var(--amber-glow)]"
      : "text-hud-cyan";
  return (
    <div className="flex justify-between py-1">
      <span>{label}</span>
      <span className={`font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}
