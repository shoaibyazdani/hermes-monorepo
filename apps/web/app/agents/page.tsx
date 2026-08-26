import type { Metadata } from "next";
import AgentRosterClient from "./AgentRosterClient";

export const metadata: Metadata = {
  title: "Agent Network",
  description:
    "Hermes agent network — roster, status, relationships and workspaces.",
};

export default function AgentsPage() {
  return <AgentRosterClient />;
}
