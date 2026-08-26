import { NextResponse } from "next/server";
import { getMockAgents } from "@/lib/mock/agents";

export const dynamic = "force-dynamic";

/**
 * Placeholder agent roster.
 *
 * Returns the same `Agent` shape the UI consumes (`lib/types`), sourced from
 * the mock roster so there is one definition of the agent network rather than
 * two that can drift. A later phase swaps `getMockAgents()` for the real
 * runtime; the response shape and the `{ agents: [...] }` envelope stay the
 * same, so no client change is needed.
 */
export async function GET() {
  return NextResponse.json({ agents: getMockAgents() });
}
