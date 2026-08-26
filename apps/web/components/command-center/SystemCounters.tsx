import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { SystemCounters as Counters } from "@/lib/types";

interface SystemCountersProps {
  counters: Counters;
  className?: string;
}

/**
 * SystemCounters — glanceable activity level for the whole system.
 *
 * Kept deliberately quiet: small labels, tabular figures, no card chrome. The
 * point is peripheral awareness, so only a non-zero error count takes on
 * colour — everything else stays neutral.
 */
export function SystemCounters({ counters, className }: SystemCountersProps) {
  const entries: Array<{ label: string; value: number; alert?: boolean }> = [
    { label: "EVENTS TODAY", value: counters.eventsToday },
    { label: "MISSIONS", value: counters.missions },
    { label: "COMPLETED", value: counters.completed },
    { label: "ERRORS", value: counters.errors, alert: counters.errors > 0 },
  ];

  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4",
        className,
      )}
    >
      {entries.map((e) => (
        <div key={e.label} className="min-w-0">
          <dt className="t-label leading-tight">{e.label}</dt>
          <dd
            className={cn(
              "mt-1 font-data text-base font-bold tabular-nums",
              e.alert ? "text-hud-red" : "text-ink",
            )}
          >
            {formatCount(e.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
