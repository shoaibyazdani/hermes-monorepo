"use client";

import { useEffect, useState } from "react";

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
}

export interface TradingData {
  prices: PriceData[];
  balance: { total: number; pnl: number };
  trades: Array<{ side: "buy" | "sell"; symbol: string; amount: number; pnl: number }>;
}

interface TradingState {
  trading: TradingData | null;
  loading: boolean;
  error: string | null;
}

const POLL_MS = 5_000;

const EMPTY: TradingData = {
  prices: [],
  balance: { total: 0, pnl: 0 },
  trades: [],
};

export function useTrading(): TradingState {
  const [state, setState] = useState<TradingState>({
    trading: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchTrading() {
      try {
        const res = await fetch("/api/trading");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setState({ trading: data.trading || EMPTY, loading: false, error: null });
        }
      } catch (e: any) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: e?.message ?? "fetch failed" }));
        }
      }
    }

    fetchTrading();
    const id = setInterval(fetchTrading, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
