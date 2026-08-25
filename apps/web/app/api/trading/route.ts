import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Phase 2 placeholder — matches Express server.js shape.
const PLACEHOLDER_TRADING = {
  prices: [
    { symbol: "ETH/USD", price: 3450.21, change: 12.4, changePct: 0.36 },
    { symbol: "BTC/USD", price: 68230.0, change: -340.2, changePct: -0.5 },
    { symbol: "SOL/USD", price: 152.18, change: 2.1, changePct: 1.4 },
  ],
  balance: { total: 67.42, pnl: 17.42 },
  trades: [
    { side: "buy" as const, symbol: "ETH", amount: 0.1, pnl: 4.21 },
    { side: "sell" as const, symbol: "BTC", amount: 0.001, pnl: -0.8 },
  ],
};

export async function GET() {
  return NextResponse.json({ trading: PLACEHOLDER_TRADING });
}
