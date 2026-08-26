import { cn } from "@/lib/utils";
import type { MetricTone } from "@/lib/types";
import { METRIC_TONE_BAR } from "@/lib/agent-status";

interface MeterProps {
  /** Current reading. */
  value: number;
  /** Upper bound. Defaults to 100. */
  max?: number;
  tone?: MetricTone;
  /** Bar height in px. */
  height?: number;
  className?: string;
  /** Accessible name for the meter. */
  label?: string;
}

/**
 * Meter — a thin horizontal fill bar for bounded readings.
 *
 * Uses the native `meter` ARIA role so screen readers announce the value
 * without needing the surrounding text.
 */
export function Meter({
  value,
  max = 100,
  tone = "nominal",
  height = 3,
  className,
  label,
}: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      className={cn("w-full overflow-hidden bg-surface-inset", className)}
      style={{ height }}
      role="meter"
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full transition-[width] duration-[var(--dur-base)] ease-hud",
          METRIC_TONE_BAR[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
