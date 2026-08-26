"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import { useUtcClock } from "@/hooks/useUtcClock";
import type { StatusTone, SystemStatus } from "@/lib/types";

const SYSTEM_STATE: Record<
  SystemStatus["state"],
  { label: string; tone: StatusTone }
> = {
  online: { label: "SYSTEM ONLINE", tone: "active" },
  degraded: { label: "SYSTEM DEGRADED", tone: "warn" },
  offline: { label: "SYSTEM OFFLINE", tone: "critical" },
};

interface TopSystemBarProps {
  status: SystemStatus;
  /** Opens the mobile navigation drawer. Absent on desktop. */
  onOpenNav?: () => void;
  className?: string;
}

/**
 * TopSystemBar — the persistent system identity + vitals strip.
 *
 * Values arrive as props so a later phase can swap the mock `SystemStatus`
 * for a live feed without touching this component.
 */
export function TopSystemBar({
  status,
  onOpenNav,
  className,
}: TopSystemBarProps) {
  const clock = useUtcClock();
  const state = SYSTEM_STATE[status.state];

  return (
    <header
      className={cn(
        "flex h-topbar flex-none items-center gap-3 border-b border-line bg-surface-deep/80 px-3 backdrop-blur-md sm:px-4",
        className,
      )}
    >
      {onOpenNav && (
        <button
          type="button"
          onClick={onOpenNav}
          className="-ml-1 flex-none border border-line p-1.5 text-ink-mute transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={16} strokeWidth={1.8} aria-hidden />
        </button>
      )}

      {/* Identity */}
      <div className="flex min-w-0 flex-none items-baseline gap-2">
        <span className="t-system-title truncate text-hud-cyan">HERMES</span>
        <span
          aria-hidden
          className="hidden font-data text-[10px] tracking-[0.24em] text-ink-ghost sm:inline"
        >
          // COMMAND NETWORK
        </span>
      </div>

      <span aria-hidden className="hud-rule mx-1 hidden min-w-6 flex-1 sm:block" />

      {/* Vitals */}
      <dl className="flex min-w-0 flex-1 items-center justify-end gap-x-4 overflow-hidden sm:flex-none sm:justify-start">
        <Vital
          tone={state.tone}
          live={status.state === "online"}
          label={state.label}
          labelClassName="hidden sm:inline"
        />
        <Vital
          tone="info"
          label={`${status.agentsOnline} AGENTS`}
          hideBelow="md"
        />
        <Vital
          tone={status.activeMissions > 0 ? "active" : "neutral"}
          live={status.activeMissions > 0}
          label={`${status.activeMissions} ACTIVE ${
            status.activeMissions === 1 ? "MISSION" : "MISSIONS"
          }`}
          hideBelow="lg"
        />
      </dl>

      <span aria-hidden className="hud-rule mx-1 hidden min-w-6 flex-1 lg:block" />

      {/* Clock — suppressHydrationWarning because the first client tick
          legitimately differs from the server-rendered second. */}
      <time
        className="flex-none font-data text-xs font-semibold tabular-nums tracking-[0.14em] text-ink-mute"
        suppressHydrationWarning
      >
        {clock}
      </time>
    </header>
  );
}

function Vital({
  tone,
  live,
  label,
  hideBelow,
  labelClassName,
}: {
  tone: StatusTone;
  live?: boolean;
  label: string;
  hideBelow?: "md" | "lg";
  /** Hides just the text (the dot stays) — used to keep the bar narrow. */
  labelClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-none items-center gap-1.5",
        hideBelow === "md" && "hidden md:flex",
        hideBelow === "lg" && "hidden lg:flex",
      )}
    >
      <StatusDot tone={tone} live={live} size="xs" />
      <dt className="sr-only">System vital</dt>
      <dd
        className={cn(
          "font-hud text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute",
          labelClassName,
        )}
      >
        {label}
      </dd>
    </div>
  );
}
