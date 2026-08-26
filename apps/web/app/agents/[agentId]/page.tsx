import type { Metadata } from "next";
import { AgentWorkspace } from "@/components/agents/AgentWorkspace";
import { getAgentDetail } from "@/lib/mock/agent-registry";
import { findMockAgent, MOCK_AGENTS } from "@/lib/mock/agents";

interface PageProps {
  params: { agentId: string };
}

/**
 * Pre-render a workspace per known agent.
 *
 * The roster is static today, so every agent page can be built ahead of time.
 * `dynamicParams` stays on so an agent registered at runtime still resolves.
 */
export function generateStaticParams() {
  return MOCK_AGENTS.map((a) => ({ agentId: a.id }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const agent = findMockAgent(params.agentId);
  const detail = getAgentDetail(params.agentId);
  if (!agent) {
    return { title: "Unknown Agent" };
  }
  return {
    title: `${agent.name} · ${agent.role}`,
    description: detail?.description ?? `${agent.name} agent workspace.`,
  };
}

export default function AgentDetailPage({ params }: PageProps) {
  return <AgentWorkspace agentId={params.agentId} />;
}
