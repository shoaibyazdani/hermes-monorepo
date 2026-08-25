import type { Metadata } from "next";
import CommandCenterClient from "./CommandCenterClient";

export const metadata: Metadata = {
  title: "HERMES · Command Center",
  description: "Hermes command center — agents, markets, comms, voice.",
};

export default function CommandCenterPage() {
  return <CommandCenterClient />;
}
