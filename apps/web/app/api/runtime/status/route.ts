import { NextResponse } from "next/server";
import { getPublicRuntimeStatus } from "@/lib/runtime/config";

export const dynamic = "force-dynamic";

/**
 * Runtime status for the browser.
 *
 * Returns only the narrow public subset — never the API key or base URL. This
 * is what flips the operational screens between SIMULATION and LIVE, so the
 * indicator derives from real configuration rather than a hand-set flag.
 */
export async function GET() {
  return NextResponse.json(getPublicRuntimeStatus());
}
