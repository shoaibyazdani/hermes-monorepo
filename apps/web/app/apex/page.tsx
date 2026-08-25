import type { Metadata } from "next";
import ApexClient from "./ApexClient";

export const metadata: Metadata = {
  title: "HERMES · Apex — Humanoid OS",
  description: "Apex — run your business from anywhere.",
};

export default function ApexPage() {
  return <ApexClient />;
}
