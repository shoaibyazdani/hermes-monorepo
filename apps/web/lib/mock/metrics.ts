import type { SystemMetric, SystemStatus } from "../types";

/** Baseline readings. `useSystemTelemetry` adds client-side drift on top. */
export const MOCK_METRICS: SystemMetric[] = [
  {
    id: "cpu",
    label: "CPU",
    value: 34,
    unit: "%",
    max: 100,
    tone: "nominal",
    history: [28, 31, 30, 36, 33, 39, 35, 34],
  },
  {
    id: "memory",
    label: "MEMORY",
    value: 61,
    unit: "%",
    max: 100,
    tone: "elevated",
    history: [54, 56, 58, 57, 60, 62, 61, 61],
  },
  {
    id: "network",
    label: "NETWORK",
    value: 84,
    unit: "ms",
    max: 250,
    tone: "nominal",
    history: [92, 88, 96, 81, 84, 79, 87, 84],
  },
  {
    id: "api",
    label: "API",
    value: 99.8,
    unit: "%",
    max: 100,
    tone: "nominal",
    history: [99.9, 99.8, 99.9, 99.7, 99.8, 99.9, 99.8, 99.8],
  },
  {
    id: "voice",
    label: "VOICE",
    value: 42,
    unit: "ms",
    max: 200,
    tone: "nominal",
    history: [48, 44, 51, 40, 42, 45, 41, 42],
  },
  {
    id: "runtime",
    label: "AGENT RUNTIME",
    value: 72,
    unit: "%",
    max: 100,
    tone: "elevated",
    history: [61, 65, 68, 70, 74, 71, 73, 72],
  },
];

export const MOCK_SYSTEM_STATUS: SystemStatus = {
  state: "online",
  agentsOnline: 6,
  agentsTotal: 7,
  activeMissions: 2,
  uptimeSeconds: 15_591,
};

export function getMockMetrics(): SystemMetric[] {
  return MOCK_METRICS;
}
