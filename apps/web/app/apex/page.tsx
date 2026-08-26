import type { Metadata } from "next";
import { AgentWorkspace } from "@/components/agents/AgentWorkspace";

export const metadata: Metadata = {
  title: "APEX · Engineering",
  description: "Apex agent workspace — engineering, debugging and implementation.",
};

/**
 * `/apex` — preserved alias for the Apex workspace.
 *
 * This route predates `/agents/[agentId]`. Rather than redirect (which would
 * break anything bookmarked or linked), it renders the same `AgentWorkspace`
 * component, so both URLs resolve to one implementation.
 */
export default function ApexPage() {
  return <AgentWorkspace agentId="apex" />;
}
