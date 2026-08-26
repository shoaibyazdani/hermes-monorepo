import type { Metadata } from "next";
import UsageClient from "./UsageClient";

export const metadata: Metadata = {
  title: "NODAL · Usage Stats",
  description: "Hermes usage stats — calls by agent, skill mentions, recent activity.",
};

export default function UsagePage() {
  return <UsageClient />;
}
