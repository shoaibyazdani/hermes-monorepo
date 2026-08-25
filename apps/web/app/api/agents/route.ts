import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Agent {
  id: string;
  name: string;
  status: "working" | "idle" | "sleeping" | "error" | "ready";
  x: number;
  y: number;
}

// Phase 2 placeholder — matches Express server.js shape so the UI renders.
// Real implementation lands in Phase 3.
const PLACEHOLDER_AGENTS: Agent[] = [
  { id: "joy", name: "JOY", status: "working", x: 200, y: 70 },
  { id: "quant", name: "QUANT", status: "idle", x: 70, y: 200 },
  { id: "sentinel", name: "SENTINEL", status: "working", x: 330, y: 200 },
  { id: "scout", name: "SCOUT", status: "sleeping", x: 130, y: 330 },
  { id: "fixer", name: "FIXER", status: "ready", x: 270, y: 330 },
];

export async function GET() {
  return NextResponse.json({ agents: PLACEHOLDER_AGENTS });
}
