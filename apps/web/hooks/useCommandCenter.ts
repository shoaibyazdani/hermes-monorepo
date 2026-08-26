"use client";

import { useCallback, useMemo, useState } from "react";
import { useLiveAgents } from "./useLiveAgents";
import { useSystemTelemetry } from "./useSystemTelemetry";
import { getActiveMissions, getMockMissions } from "@/lib/mock/missions";
import { getMockActivity } from "@/lib/mock/activity";
import {
  getMockAttentionItems,
  getMockCounters,
  getMockObjective,
} from "@/lib/mock/command-center";
import type { Agent, CommandCenterState, Mission } from "@/lib/types";

/**
 * Assembles everything the Command Center renders into one `CommandCenterState`.
 *
 * This is the single seam between the page and its data. Today the agent
 * roster is live (`/api/agents`) while missions, activity, attention and
 * counters come from `lib/mock/*`; a later phase replaces those sources
 * without any component needing to change.
 */
export interface UseCommandCenterResult extends CommandCenterState {
  loading: boolean;
  /** Non-null when the live roster could not be fetched. */
  error: string | null;
  /** Missions still in flight — what the board leads with. */
  activeMissions: Mission[];
  /** Resolve an agent id to its record. */
  agentById: (id: string | null | undefined) => Agent | undefined;
  /** Resolve an agent id to its display name. */
  agentName: (id: string) => string | undefined;
  /** Aggregate roster counts for the summary strip. */
  agentCounts: {
    total: number;
    active: number;
    waiting: number;
    idle: number;
  };
  /** Locally dismiss an attention item. UI-only until Approvals ships. */
  dismissAttention: (id: string) => void;
}

export function useCommandCenter(): UseCommandCenterResult {
  const { agents, loading, error } = useLiveAgents();
  const { metrics, status } = useSystemTelemetry();

  // Dismissals are local: there is no approval backend to inform yet, so this
  // deliberately does not pretend an action reached an agent.
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const dismissAttention = useCallback((id: string) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const attentionItems = useMemo(
    () => getMockAttentionItems().filter((a) => !dismissedIds.includes(a.id)),
    [dismissedIds],
  );

  const agentIndex = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents],
  );

  const agentById = useCallback(
    (id: string | null | undefined) => (id ? agentIndex.get(id) : undefined),
    [agentIndex],
  );

  const agentName = useCallback(
    (id: string) => agentIndex.get(id)?.name,
    [agentIndex],
  );

  const agentCounts = useMemo(() => {
    let active = 0;
    let waiting = 0;
    let idle = 0;
    for (const a of agents) {
      switch (a.status) {
        case "working":
        case "thinking":
        case "listening":
          active++;
          break;
        case "waiting":
        case "blocked":
        case "error":
          waiting++;
          break;
        default:
          idle++;
      }
    }
    return { total: agents.length, active, waiting, idle };
  }, [agents]);

  const missions = getMockMissions();
  const activeMissions = getActiveMissions();

  return {
    agents,
    missions,
    activeMissions,
    activity: getMockActivity(),
    metrics,
    systemStatus: {
      ...status,
      agentsTotal: agents.length,
      agentsOnline: agents.filter((a) => a.status !== "offline").length,
      activeMissions: activeMissions.length,
    },
    attentionItems,
    currentObjective: getMockObjective(),
    counters: getMockCounters(),
    loading,
    error,
    agentById,
    agentName,
    agentCounts,
    dismissAttention,
  };
}
