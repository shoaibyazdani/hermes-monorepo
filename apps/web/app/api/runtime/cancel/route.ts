import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/runtime/run-manager";

export const dynamic = "force-dynamic";

/**
 * Cancel an in-flight run.
 *
 * Aborts the upstream provider call so a stopped run stops costing tokens,
 * rather than merely hiding its output. The run transitions to `cancelled`;
 * it can never report `completed` afterwards.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const runId =
    typeof body === "object" && body !== null
      ? (body as { runId?: unknown }).runId
      : undefined;

  if (typeof runId !== "string" || !runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  const cancelled = cancelRun(runId);
  return NextResponse.json({ cancelled });
}
