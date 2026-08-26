import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/runtime/run-manager";
import { cancelOrchestration } from "@/lib/orchestration/orchestrator";

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

  const b = (typeof body === "object" && body !== null ? body : {}) as {
    runId?: unknown;
    orchestrationId?: unknown;
  };

  // Cancelling an orchestration aborts every delegated run beneath it;
  // completed results are preserved on their steps.
  if (typeof b.orchestrationId === "string" && b.orchestrationId) {
    return NextResponse.json({
      cancelled: cancelOrchestration(b.orchestrationId),
      scope: "orchestration",
    });
  }

  if (typeof b.runId === "string" && b.runId) {
    return NextResponse.json({ cancelled: cancelRun(b.runId), scope: "run" });
  }

  return NextResponse.json(
    { error: "runId or orchestrationId is required." },
    { status: 400 },
  );
}
