"use client";

import { useEffect, useMemo, useState } from "react";
import { MOCK_AGENTS } from "@/lib/mock/agents";
import { normalizeAgentStatus } from "@/lib/agent-status";
import type { Agent, AgentDiscipline } from "@/lib/types";

interface AgentsState {
  agents: Agent[];
  loading: boolean;
  error: string | null;
}

const POLL_MS = 15_000;

/** Shape returned by the existing `/api/agents` placeholder route. */
/**
 * Shape returned by `/api/agents`.
 *
 * A partial `Agent` plus the two fields the route is guaranteed to send. The
 * placeholder route already returns the full record; typing it as a partial
 * keeps the adapter honest about a leaner real API later.
 */
type ApiAgent = Partial<Agent> & {
  id: string;
  name: string;
  status: string;
};

const DISCIPLINES: AgentDiscipline[] = [
  "core",
  "engineering",
  "research",
  "qa",
  "analytics",
  "security",
  "operations",
];

function isDiscipline(v: unknown): v is AgentDiscipline {
  return typeof v === "string" && (DISCIPLINES as string[]).includes(v);
}

/**
 * Adapt an API record to the richer `Agent` shape.
 *
 * The placeholder route returns a narrower record than the UI wants, so any
 * field it omits falls back to the mock roster entry with the same id, and
 * then to a neutral default. This keeps the interface fully populated today
 * and requires no component changes once the real API returns everything.
 */
function adapt(raw: ApiAgent): Agent {
  const seed = MOCK_AGENTS.find((m) => m.id === raw.id);

  // Drop keys the response sent as undefined so they cannot blank a seeded
  // value — `{...seed, ...raw}` would otherwise overwrite with undefined.
  const provided = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as Partial<Agent>;

  // Seed first, response second: the API wins on every field it actually
  // sends and the fixture fills the rest. Structuring it this way means a new
  // optional field on `Agent` flows through without editing this function —
  // the previous per-field mapping silently dropped anything not listed.
  const merged: Agent = {
    ...(seed ?? {}),
    ...provided,
    id: raw.id,
    name: raw.name,
    role: raw.role ?? seed?.role ?? "AGENT",
    discipline: isDiscipline(raw.discipline)
      ? raw.discipline
      : (seed?.discipline ?? "operations"),
    status: normalizeAgentStatus(raw.status),
  };

  return merged;
}

/**
 * Agent roster, polled from `/api/agents`.
 *
 * Renders the mock roster until the first response lands, and falls back to it
 * if the request fails — the command center should never show an empty grid
 * because a poll timed out.
 */
export function useAgents(): AgentsState {
  const [state, setState] = useState<AgentsState>({
    agents: MOCK_AGENTS,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw: ApiAgent[] = Array.isArray(data.agents) ? data.agents : [];
        if (!cancelled) {
          setState({
            agents: raw.length > 0 ? raw.map(adapt) : MOCK_AGENTS,
            loading: false,
            error: null,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : "fetch failed",
          }));
        }
      }
    }

    void fetchAgents();
    const id = setInterval(() => void fetchAgents(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}

/** Lookup helper: agent id → display name. */
export function useAgentNameLookup(agents: Agent[]) {
  return useMemo(() => {
    const map = new Map(agents.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id);
  }, [agents]);
}
