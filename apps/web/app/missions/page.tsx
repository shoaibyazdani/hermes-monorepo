import type { Metadata } from "next";
import MissionsClient from "./MissionsClient";

export const metadata: Metadata = {
  title: "Missions",
  description: "Hermes mission board — objectives, crews and progress.",
};

export default function MissionsPage() {
  return <MissionsClient />;
}
