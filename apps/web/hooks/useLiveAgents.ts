"use client";

import { useMemo } from "react";
import { useAgents } from "./useAgents";
import { useOperations } from "@/components/operations/OperationsProvider";
import type { Agent } from "@/lib/types";

/**
 * The agent roster with live run status applied.
 *
 * `useAgents` reports the roster's baseline state. When a real run is in
 * flight, `OperationsProvider` holds a status derived from its events —
 * thinking, working, error — and this overlays it so every screen showing an
 * agent reflects what it is actually doing right now.
 *
 * One override map, applied in one place: screens do not each merge it.
 */
export function useLiveAgents(): {
  agents: Agent[];
  loading: boolean;
  error: string | null;
} {
  const { agents, loading, error } = useAgents();
  const { liveAgentStatus } = useOperations();

  const merged = useMemo(() => {
    if (Object.keys(liveAgentStatus).length === 0) return agents;
    return agents.map((a) =>
      liveAgentStatus[a.id] ? { ...a, status: liveAgentStatus[a.id] } : a,
    );
  }, [agents, liveAgentStatus]);

  return { agents: merged, loading, error };
}
