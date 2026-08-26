import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Phase 2 placeholder — matches Express server.js /api/usage shape.
const PLACEHOLDER_USAGE = {
  total: 127,
  byAgent: [
    { agent: "joy", calls: 82, tokens: 142_300 },
    { agent: "sentinel", calls: 31, tokens: 48_100 },
    { agent: "quant", calls: 14, tokens: 22_700 },
  ],
  bySkill: [
    { skill: "smart-apply", mentions: 41, lastUsed: "2026-08-25" },
    { skill: "openclaw-twitter", mentions: 18, lastUsed: "2026-08-25" },
    { skill: "email-apply-pipeline", mentions: 27, lastUsed: "2026-08-25" },
  ],
};

export async function GET() {
  return NextResponse.json({ usage: PLACEHOLDER_USAGE });
}
