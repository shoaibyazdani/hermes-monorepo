import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import type { StatusTone } from "@/lib/types";

interface AgentSummaryProps {
  counts: { total: number; active: number; waiting: number; idle: number };
  className?: string;
}

const ENTRIES: Array<{
  key: "total" | "active" | "waiting" | "idle";
  label: string;
  tone?: StatusTone;
  live?: boolean;
}> = [
  { key: "total", label: "AGENTS" },
  { key: "active", label: "ACTIVE", tone: "active", live: true },
  { key: "waiting", label: "WAITING", tone: "warn" },
  { key: "idle", label: "IDLE", tone: "neutral" },
];

/**
 * AgentSummary — aggregate roster counts as a compact HUD strip.
 *
 * Deliberately small type: this is a glanceable readout inside a panel header
 * area, not a set of dashboard hero numbers.
 */
export function AgentSummary({ counts, className }: AgentSummaryProps) {
  return (
    <dl className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-1", className)}>
      {ENTRIES.map((e) => (
        <div key={e.key} className="flex items-center gap-1.5">
          {e.tone && (
            <StatusDot
              tone={e.tone}
              live={e.live && counts[e.key] > 0}
              size="xs"
            />
          )}
          <dd className="font-data text-xs font-bold tabular-nums text-ink">
            {counts[e.key]}
          </dd>
          <dt className="t-label">{e.label}</dt>
        </div>
      ))}
    </dl>
  );
}
