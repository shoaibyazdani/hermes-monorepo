import { cn } from "@/lib/utils";

interface DataRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional third column, e.g. a delta or unit. */
  aside?: React.ReactNode;
  /** Tints the value. */
  tone?: "default" | "accent" | "positive" | "negative" | "warn" | "muted";
  /** Draws a hairline separator below the row. */
  divider?: boolean;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<DataRowProps["tone"]>, string> = {
  default: "text-ink",
  accent: "text-hud-cyan",
  positive: "text-hud-green",
  negative: "text-hud-red",
  warn: "text-hud-amber",
  muted: "text-ink-faint",
};

/**
 * DataRow — a label/value pair on one technical line.
 *
 * The standard way to present key/value telemetry so spacing and type stay
 * consistent across every panel in the system.
 */
export function DataRow({
  label,
  value,
  aside,
  tone = "default",
  divider = false,
  className,
}: DataRowProps) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-3 py-1.5",
        divider && "border-b border-line-soft last:border-b-0",
        className,
      )}
    >
      <span className="t-label min-w-0 flex-1 truncate normal-case tracking-[0.16em]">
        {label}
      </span>
      <span
        className={cn(
          "flex-none font-data text-xs font-semibold tabular-nums",
          TONE_CLASS[tone],
        )}
      >
        {value}
      </span>
      {aside && <span className="t-timestamp flex-none">{aside}</span>}
    </div>
  );
}
