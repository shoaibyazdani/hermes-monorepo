import type { Metadata } from "next";
import MissionDetailClient from "./MissionDetailClient";

interface PageProps {
  params: { missionId: string };
}

export const metadata: Metadata = {
  title: "Mission",
  description: "Hermes mission detail — tasks, crew and live timeline.",
};

/**
 * Mission detail.
 *
 * Rendered client-side rather than pre-generated: missions can be created in
 * the session and the scenario advances, so the id set is not fixed at build
 * time.
 */
export default function MissionDetailPage({ params }: PageProps) {
  return <MissionDetailClient missionId={params.missionId} />;
}
