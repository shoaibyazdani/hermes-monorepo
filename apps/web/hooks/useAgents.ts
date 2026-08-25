"use client";

import { useEffect, useState } from "react";
import type { RadarAgent } from "@/components/hud/RadarSVG";

interface AgentsState {
  agents: RadarAgent[];
  loading: boolean;
  error: string | null;
}

const POLL_MS = 15_000;

export function useAgents(): AgentsState {
  const [state, setState] = useState<AgentsState>({
    agents: [],
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
        if (!cancelled) {
          setState({ agents: data.agents || [], loading: false, error: null });
        }
      } catch (e: any) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: e?.message ?? "fetch failed" }));
        }
      }
    }

    fetchAgents();
    const id = setInterval(fetchAgents, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
