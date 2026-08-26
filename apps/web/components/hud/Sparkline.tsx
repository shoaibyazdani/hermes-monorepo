import { cn } from "@/lib/utils";
import type { MetricTone } from "@/lib/types";

const TONE_STROKE: Record<MetricTone, string> = {
  nominal: "var(--status-active)",
  elevated: "var(--status-warn)",
  critical: "var(--status-critical)",
};

interface SparklineProps {
  /** Samples, oldest to newest. Needs at least two points to draw. */
  data: number[];
  tone?: MetricTone;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Sparkline — a bare trend line for a metric's recent history.
 *
 * No axes, no labels: the number beside it carries the value, this only
 * carries the shape. Decorative, so it is hidden from assistive tech.
 */
export function Sparkline({
  data,
  tone = "nominal",
  width = 64,
  height = 18,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      // Inset by 1px top and bottom so the stroke is never clipped.
      const y = height - 1 - ((v - min) / span) * (height - 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("flex-none overflow-visible", className)}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
}
