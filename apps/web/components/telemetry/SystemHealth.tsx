import { cn } from "@/lib/utils";
import { Meter } from "@/components/hud/Meter";
import { Sparkline } from "@/components/hud/Sparkline";
import { METRIC_TONE_CLASS } from "@/lib/agent-status";
import type { SystemMetric } from "@/lib/types";

interface SystemHealthProps {
  metrics: SystemMetric[];
  className?: string;
}

/**
 * SystemHealth — the vitals readout.
 *
 * One row per metric: label, trend sparkline, value, and a bounded meter.
 * Tone comes from the metric itself so thresholds live in one place.
 */
export function SystemHealth({ metrics, className }: SystemHealthProps) {
  if (metrics.length === 0) {
    return <p className="t-meta py-4">No metrics reporting.</p>;
  }

  return (
    <ul className={cn("space-y-2.5", className)}>
      {metrics.map((m) => (
        <li key={m.id}>
          <div className="flex items-center gap-2">
            <span className="t-label min-w-0 flex-1 truncate">{m.label}</span>
            {m.history && m.history.length > 1 && (
              <Sparkline data={m.history} tone={m.tone} width={48} height={14} />
            )}
            <span
              className={cn(
                "flex-none font-data text-xs font-bold tabular-nums",
                METRIC_TONE_CLASS[m.tone],
              )}
            >
              {m.value}
              <span className="ml-0.5 text-[10px] font-normal text-ink-ghost">
                {m.unit}
              </span>
            </span>
          </div>
          {m.max !== undefined && (
            <Meter
              value={m.value}
              max={m.max}
              tone={m.tone}
              className="mt-1.5"
              label={m.label}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
