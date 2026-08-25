"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/hud/Panel";
import { StatusLine } from "@/components/hud/StatusLine";
import { useClock } from "@/hooks/useClock";

interface AgentUsage {
  agent: string;
  calls: number;
  tokens: number;
}

interface SkillUsage {
  skill: string;
  mentions: number;
  lastUsed: string;
}

interface UsageData {
  total: number;
  byAgent: AgentUsage[];
  bySkill: SkillUsage[];
}

export default function UsageClient() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { utc } = useClock();

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setUsage(data.usage ?? null);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "fetch failed");
      }
    }
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const totalTokens =
    usage?.byAgent.reduce((acc, a) => acc + a.tokens, 0) ?? 0;

  const maxMentions = Math.max(
    ...(usage?.bySkill.map((s) => s.mentions) ?? [1]),
    1
  );

  return (
    <main className="min-h-screen flex flex-col">
      {/* Topbar */}
      <div className="flex-none h-[60px] flex items-center justify-between px-6 bg-bg-panel border border-hudcss-cyan-dim backdrop-blur-xl ar-corners animate-glitch">
        <div className="flex items-center gap-3">
          <div className="brand-mark" />
          <span
            className="font-hud font-bold text-lg tracking-[0.3em] text-hud-cyan"
            style={{ textShadow: "0 0 8px var(--cyan-glow)" }}
          >
            NODAL
          </span>
        </div>
        <nav className="flex gap-7 font-hud text-sm tracking-[0.15em] uppercase">
          <a href="/" className="text-ink-mute hover:text-hud-cyan">
            Dashboard
          </a>
          <a href="/command-center" className="text-ink-mute hover:text-hud-cyan">
            Command
          </a>
          <a href="/apex" className="text-ink-mute hover:text-hud-cyan">
            Apex
          </a>
          <a
            href="/usage"
            className="text-hud-cyan"
            style={{ textShadow: "0 0 8px var(--cyan-glow)" }}
          >
            Usage
          </a>
        </nav>
        <div className="flex gap-4 font-data text-xs text-ink-mute">
          <span className="flex items-center gap-2 px-2 py-1 bg-black/30 border border-hudcss-cyan-faint rounded">
            <span className="w-2 h-2 rounded-full bg-hud-green animate-pulse-dot" />
            Live
          </span>
          <span className="flex items-center gap-2 px-2 py-1 bg-black/30 border border-hudcss-cyan-faint rounded">
            {utc}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="px-6 pt-6 pb-4">
        <h1
          className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, #00D9FF 0%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Usage Stats
        </h1>
        <div className="mt-1 text-sm text-ink-mute">
          Agent calls, skill mentions, recent activity — auto-refresh every 30s
        </div>
      </div>

      {/* Stat cards row */}
      <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Calls"
          value={usage ? usage.total.toLocaleString() : "—"}
          sub="aggregate"
        />
        <StatCard
          label="Total Tokens"
          value={totalTokens ? totalTokens.toLocaleString() : "—"}
          sub="across agents"
        />
        <StatCard
          label="Agents"
          value={usage ? `${usage.byAgent.length}` : "—"}
          sub="active"
        />
        <StatCard
          label="Skills"
          value={usage ? `${usage.bySkill.length}` : "—"}
          sub="tracked"
        />
      </div>

      {/* Main 2-col grid */}
      <div className="flex-1 px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Agent */}
        <Panel stagger={1} className="min-h-[200px]">
          <div className="panel-title">Calls by Agent</div>
          {error && (
            <div className="text-xs text-hud-red mb-2">
              Failed to load: {error}
            </div>
          )}
          {!usage && !error && (
            <div className="text-xs text-ink-mute">Loading…</div>
          )}
          {usage?.byAgent.map((a) => (
            <div
              key={a.agent}
              className="flex items-center justify-between py-2 border-b border-hudcss-cyan-faint last:border-b-0 font-data text-sm"
            >
              <span className="font-hud uppercase tracking-[0.1em] text-ink">
                {a.agent}
              </span>
              <span className="tabular-nums text-hud-cyan font-bold">
                {a.calls.toLocaleString()} <span className="text-xs text-ink-mute font-normal">calls</span>
              </span>
              <span className="text-xs text-ink-mute tabular-nums">
                {a.tokens.toLocaleString()} tok
              </span>
            </div>
          ))}
        </Panel>

        {/* Skill Mentions (bar chart, inline SVG-ish via Tailwind) */}
        <Panel stagger={2} className="min-h-[200px]">
          <div className="panel-title">Skill Mentions</div>
          {usage?.bySkill.length === 0 && (
            <div className="text-xs text-ink-mute">No skill activity yet.</div>
          )}
          {usage?.bySkill.map((s) => {
            const pct = (s.mentions / maxMentions) * 100;
            return (
              <div key={s.skill} className="mb-3 last:mb-0">
                <div className="flex justify-between font-data text-xs">
                  <span className="font-hud uppercase tracking-[0.05em]">
                    {s.skill}
                  </span>
                  <span className="text-ink-mute">{s.mentions}×</span>
                </div>
                <div className="mt-1 h-1 bg-black/30 rounded overflow-hidden">
                  <div
                    className="h-1 bg-hud-cyan rounded"
                    style={{
                      width: `${pct}%`,
                      boxShadow: "0 0 6px var(--cyan-glow)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </Panel>

        {/* Recent activity placeholder */}
        <Panel stagger={3} className="lg:col-span-2 min-h-[120px]">
          <div className="panel-title">Recent Activity</div>
          <div className="font-data text-xs text-ink-mute space-y-1">
            <p>
              Activity feed — Phase 2 placeholder. Phase 3 will hook this to a
              real <code>/api/logs</code> endpoint streaming the last 50 log
              lines.
            </p>
            <p>
              While you wait, watch the right column on{" "}
              <a href="/command-center" className="text-hud-cyan hover:underline">
                /command-center
              </a>{" "}
              for live coms output.
            </p>
          </div>
        </Panel>
      </div>

      {/* Footer */}
      <div className="flex-none max-w-[1400px] w-full mx-auto px-6 pb-6 animate-glitch">
        <StatusLine
          items={[
            { label: "", value: "ONLINE", pulse: true },
            { label: "REFRESH", value: "30s" },
            { label: "TOTAL", value: usage ? `${usage.total}` : "—" },
            { label: "TIME", value: utc },
          ]}
        />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-[rgba(20,24,58,0.6)] to-[rgba(15,18,38,0.6)] border border-hudcss-cyan-dim rounded-lg p-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, #00D9FF, #8b5cf6)",
        }}
      />
      <div className="text-[11px] text-ink-mute uppercase tracking-[0.15em]">
        {label}
      </div>
      <div
        className="text-3xl font-bold text-hud-cyan tabular-nums mt-1"
        style={{ textShadow: "0 0 8px var(--cyan-glow)" }}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-mute/70 mt-1">{sub}</div>}
    </div>
  );
}
