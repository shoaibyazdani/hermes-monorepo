"use client";

import { useEffect, useState } from "react";
import { MOCK_METRICS, MOCK_SYSTEM_STATUS } from "@/lib/mock/metrics";
import type { MetricTone, SystemMetric, SystemStatus } from "@/lib/types";

const TICK_MS = 3000;

/** Percent metrics turn amber past 75 and red past 90. */
function toneFor(metric: SystemMetric, value: number): MetricTone {
  if (metric.unit !== "%") return metric.tone;
  if (metric.id === "api") {
    // Availability: low is bad, not high.
    if (value < 99) return "critical";
    if (value < 99.5) return "elevated";
    return "nominal";
  }
  if (value >= 90) return "critical";
  if (value >= 75) return "elevated";
  return "nominal";
}

/**
 * Mock system telemetry with gentle client-side drift.
 *
 * Renders the fixed baseline from `lib/mock/metrics` on the server and for the
 * first client paint — identical markup, no hydration mismatch — then walks
 * each reading by a small random step so the interface reads as live.
 *
 * A later phase replaces the interval with a real subscription; the returned
 * shape is the contract and does not change.
 */
export function useSystemTelemetry(): {
  metrics: SystemMetric[];
  status: SystemStatus;
} {
  const [metrics, setMetrics] = useState<SystemMetric[]>(MOCK_METRICS);
  const [status, setStatus] = useState<SystemStatus>(MOCK_SYSTEM_STATUS);

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => {
          const bound = m.max ?? 100;
          // Availability sits near its ceiling, so it drifts within a narrow
          // band at one decimal; everything else walks proportionally.
          const isAvailability = m.id === "api";
          const step = isAvailability
            ? (Math.random() - 0.5) * 0.3
            : (Math.random() - 0.5) * bound * 0.06;
          const next = Math.min(bound, Math.max(0, m.value + step));
          const rounded = isAvailability
            ? Math.min(99.9, Math.round(next * 10) / 10)
            : Math.round(next);
          const history = [...(m.history ?? []), rounded].slice(-12);
          return { ...m, value: rounded, tone: toneFor(m, rounded), history };
        }),
      );

      setStatus((prev) => ({
        ...prev,
        uptimeSeconds: prev.uptimeSeconds + TICK_MS / 1000,
      }));
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  return { metrics, status };
}
