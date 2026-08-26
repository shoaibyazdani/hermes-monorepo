import type { Metadata } from "next";
import CommandCenter from "./CommandCenter";

export const metadata: Metadata = {
  title: "Command Center",
  description:
    "Hermes command center — agent network, live operations and system health.",
};

/**
 * `/` is the Command Center: the system overview an operator lands on.
 *
 * `/command-center` is kept as the Live Operations view (radar, markets, comms)
 * rather than being deleted — the two are complementary, and the navigation
 * labels them "Command" and "Operations" to make the split explicit.
 */
export default function HomePage() {
  return <CommandCenter />;
}
