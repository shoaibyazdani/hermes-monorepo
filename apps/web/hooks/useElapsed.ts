"use client";

import { useEffect, useState } from "react";
import { MOCK_NOW_ISO } from "@/lib/mock/clock";
import { formatDuration } from "@/lib/format";

/**
 * Elapsed time since `startedAt`, as "MM:SS" (or "HH:MM:SS" past an hour).
 *
 * Measured against the mock scenario's reference time, not wall-clock: the
 * fixture timestamps are fixed, so real "now" would render nonsense elapsed
 * values. Once real data arrives, `MOCK_NOW_ISO` gives way to `Date.now()`
 * and this hook keeps working unchanged.
 *
 * Renders a stable placeholder on the server and ticks only after mount, so
 * server and client markup match.
 */
export function useElapsed(startedAt: string | undefined): string {
  const [elapsed, setElapsed] = useState("--:--");

  useEffect(() => {
    if (!startedAt) {
      setElapsed("--:--");
      return;
    }

    const start = new Date(startedAt).getTime();
    const base = new Date(MOCK_NOW_ISO).getTime();
    if (Number.isNaN(start) || Number.isNaN(base)) {
      setElapsed("--:--");
      return;
    }

    // Offset from the moment this mounted, so the counter advances in real time
    // while remaining anchored to the scenario clock.
    const mountedAt = Date.now();
    const tick = () =>
      setElapsed(formatDuration((base - start + (Date.now() - mountedAt)) / 1000));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}
