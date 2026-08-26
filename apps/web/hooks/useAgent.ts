"use client";

import { useCallback, useMemo } from "react";
import { useLiveAgents } from "./useLiveAgents";
import { getAgentDetail, relationsForAgent } from "@/lib/mock/agent-registry";
import { getAgentActivity } from "@/lib/mock/agent-activity";
import { findMockMission } from "@/lib/mock/missions";
import type {
  ActivityEvent,
  Agent,
  AgentRelation,
  Mission,
} from "@/lib/types";

export interface UseAgentResult {
  /** The agent, or null once loading finishes and no such id exists. */
  agent: Agent | null;
  /** Mission the agent is currently assigned to, if any. */
  mission: Mission | null;
  /** Whether this agent leads its current mission. */
  isMissionLead: boolean;
  activity: ActivityEvent[];
  relations: AgentRelation[];
  loading: boolean;
  error: string | null;
  /** Resolve an agent id to a display name. */
  agentName: (id: string) => string | undefined;
}

/**
 * Everything one agent's workspace renders.
 *
 * Merges the live roster entry from `/api/agents` with the richer mock detail
 * record (capabilities, tools, config, telemetry, memory), its event history
 * and its relationships.
 *
 * Conversations deliberately live elsewhere: `ConversationProvider` owns them
 * so every route shares one store rather than each page keeping its own copy.
 */
export function useAgent(agentId: string): UseAgentResult {
  const { agents, loading, error } = useLiveAgents();

  const agentName = useCallback(
    (id: string) => agents.find((a) => a.id === id)?.name,
    [agents],
  );

  const agent = useMemo<Agent | null>(() => {
    const base = agents.find((a) => a.id === agentId);
    if (!base) return null;

    // Fold the detail record in. The roster is the source of truth for live
    // state; the detail record supplies the static identity and config.
    const detail = getAgentDetail(agentId);
    if (!detail) return base;

    return {
      ...base,
      codename: base.codename ?? detail.codename,
      description: base.description ?? detail.description,
      registeredAt: base.registeredAt ?? detail.registeredAt,
      capabilities: base.capabilities ?? detail.capabilities,
      tools: base.tools ?? detail.tools,
      config: base.config ?? detail.config,
      telemetry: base.telemetry ?? detail.telemetry,
      memory: base.memory ?? detail.memory,
    };
  }, [agents, agentId]);

  const mission = useMemo(
    () => (agent?.missionId ? findMockMission(agent.missionId) ?? null : null),
    [agent],
  );

  const isMissionLead = Boolean(
    mission &&
      agent &&
      (mission.leadAgentId ?? mission.assignedAgentIds[0]) === agent.id,
  );

  return {
    agent,
    mission,
    isMissionLead,
    activity: getAgentActivity(agentId),
    relations: relationsForAgent(agentId),
    loading,
    error,
    agentName,
  };
}
