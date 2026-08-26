"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/hud/Panel";
import { Meter } from "@/components/hud/Meter";
import { DataRow } from "@/components/hud/DataRow";
import { PageHeader } from "@/components/shell/PageHeader";
import { AgentActivity } from "@/components/agents/AgentActivity";
import { useAgents, useAgentNameLookup } from "@/hooks/useAgents";
import { formatCount } from "@/lib/format";
import { getMockActivity } from "@/lib/mock/activity";

const ACTIVITY = getMockActivity();
const REFRESH_MS = 30_000;

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

/**
 * Usage — call volume, token spend and skill activity.
 *
 * Reads the existing `/api/usage` placeholder route unchanged.
 */
export default function UsageClient() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { agents } = useAgents();
  const agentName = useAgentNameLookup(agents);

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
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    const id = setInterval(() => void fetchData(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const totalTokens = usage?.byAgent.reduce((acc, a) => acc + a.tokens, 0) ?? 0;
  const maxCalls = Math.max(...(usage?.byAgent.map((a) => a.calls) ?? [1]), 1);
  const maxMentions = Math.max(
    ...(usage?.bySkill.map((s) => s.mentions) ?? [1]),
    1,
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Usage"
        subtitle="Call volume · token spend · skill activity"
        meta={[
          { label: "REFRESH", value: `${REFRESH_MS / 1000}s` },
          { label: "STATUS", value: error ? "STALE" : loading ? "SYNCING" : "LIVE" },
        ]}
      />

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Total Calls"
            value={usage ? formatCount(usage.total) : "—"}
            sub="aggregate"
            stagger={0}
          />
          <StatTile
            label="Total Tokens"
            value={totalTokens ? formatCount(totalTokens) : "—"}
            sub="across agents"
            stagger={1}
          />
          <StatTile
            label="Agents"
            value={usage ? `${usage.byAgent.length}` : "—"}
            sub="reporting"
            stagger={2}
          />
          <StatTile
            label="Skills"
            value={usage ? `${usage.bySkill.length}` : "—"}
            sub="tracked"
            stagger={3}
          />
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Calls by agent */}
          <Panel
            title="Calls by Agent"
            eyebrow={usage ? `${usage.byAgent.length}` : "—"}
            status={error ? "warn" : "info"}
            stagger={4}
          >
            {error && (
              <p className="t-meta mb-3 text-hud-amber">
                Failed to load: {error}
              </p>
            )}
            {loading && !usage && (
              <p className="t-meta py-6">Loading usage data…</p>
            )}
            {usage && usage.byAgent.length === 0 && (
              <p className="t-meta py-6">No agent calls recorded.</p>
            )}
            {usage && usage.byAgent.length > 0 && (
              <ul className="space-y-3">
                {usage.byAgent.map((a) => (
                  <li key={a.agent}>
                    <div className="flex items-baseline gap-3">
                      <span className="t-label min-w-0 flex-1 truncate">
                        {a.agent}
                      </span>
                      <span className="flex-none font-data text-xs font-bold tabular-nums text-hud-cyan">
                        {formatCount(a.calls)}
                      </span>
                      <span className="t-timestamp flex-none">
                        {formatCount(a.tokens)} tok
                      </span>
                    </div>
                    <Meter
                      value={a.calls}
                      max={maxCalls}
                      className="mt-1.5"
                      label={`${a.agent} calls`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Skill mentions */}
          <Panel
            title="Skill Mentions"
            eyebrow={usage ? `${usage.bySkill.length}` : "—"}
            status="info"
            stagger={5}
          >
            {loading && !usage && (
              <p className="t-meta py-6">Loading skill data…</p>
            )}
            {usage && usage.bySkill.length === 0 && (
              <p className="t-meta py-6">No skill activity yet.</p>
            )}
            {usage?.bySkill.map((s) => (
              <div key={s.skill} className="mb-3 last:mb-0">
                <div className="flex items-baseline gap-3">
                  <span className="t-label min-w-0 flex-1 truncate">
                    {s.skill}
                  </span>
                  <span className="flex-none font-data text-xs font-bold tabular-nums text-hud-cyan">
                    {s.mentions}&times;
                  </span>
                  <span className="t-timestamp flex-none">{s.lastUsed}</span>
                </div>
                <Meter
                  value={s.mentions}
                  max={maxMentions}
                  className="mt-1.5"
                  label={`${s.skill} mentions`}
                />
              </div>
            ))}
          </Panel>

          {/* Activity */}
          <Panel
            title="Recent Activity"
            eyebrow="EVENT LOG"
            status="info"
            stagger={6}
            className="lg:col-span-2"
            footer={
              <p className="t-timestamp">
                Mock event stream — a live `/api/logs` feed lands in a later phase.
              </p>
            }
          >
            <AgentActivity events={ACTIVITY} agentName={agentName} limit={8} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  stagger,
}: {
  label: string;
  value: string;
  sub?: string;
  stagger?: number;
}) {
  return (
    <Panel padding="md" stagger={stagger}>
      <div className="t-label">{label}</div>
      <div className="t-metric mt-2 text-hud-cyan">{value}</div>
      {sub && <div className="t-timestamp mt-1.5">{sub}</div>}
    </Panel>
  );
}
