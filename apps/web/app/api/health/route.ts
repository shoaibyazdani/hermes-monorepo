import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "hermes-web",
    version: "0.1.0",
    nextjs: true,
  });
}
