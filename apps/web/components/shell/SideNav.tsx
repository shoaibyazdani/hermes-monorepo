"use client";

import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { StatusDot } from "@/components/hud/StatusDot";
import type { StatusTone } from "@/lib/types";

/** Per-destination live signal: a count badge and/or a state dot. */
export interface NavSignal {
  count?: number;
  tone?: StatusTone;
  live?: boolean;
}

interface SideNavProps {
  activeKey?: string;
  signals?: Record<string, NavSignal>;
  /** Icon-only rail, used at tablet widths. */
  compact?: boolean;
  /** Invoked after navigating — lets the mobile drawer close itself. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * SideNav — the primary navigation rail.
 *
 * Compact rows, not oversized buttons. Destinations whose route lands in a
 * later phase render as disabled `<span>`s so the architecture is visible
 * without offering a dead link.
 */
export function SideNav({
  activeKey,
  signals,
  compact = false,
  onNavigate,
  className,
}: SideNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn("flex flex-col gap-0.5", className)}
    >
      {!compact && (
        <p className="t-label mb-2 px-2.5 text-ink-ghost">Navigation</p>
      )}

      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <NavRow
              item={item}
              active={item.key === activeKey}
              signal={signals?.[item.key]}
              compact={compact}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavRow({
  item,
  active,
  signal,
  compact,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  signal?: NavSignal;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const rowClass = cn(
    "group relative flex items-center gap-2.5 border-l-2 py-1.5 pr-2 transition-colors duration-[var(--dur-fast)]",
    compact ? "justify-center py-2 pl-2 pr-2" : "pl-2.5",
    active
      ? "border-l-hud-cyan bg-hud-cyan/[0.10] text-hud-cyan"
      : "border-l-transparent text-ink-mute",
    item.available
      ? "hover:border-l-hud-cyan/50 hover:bg-hud-cyan/[0.04] hover:text-ink"
      : "cursor-not-allowed text-ink-ghost",
  );

  const inner = (
    <>
      <Icon
        size={15}
        strokeWidth={1.7}
        className="flex-none"
        aria-hidden
      />

      {!compact && (
        <span className="min-w-0 flex-1 truncate font-hud text-[11px] font-semibold uppercase tracking-[0.18em]">
          {item.label}
        </span>
      )}

      {/* Signals: count badge, then state dot. */}
      {!compact && signal?.count !== undefined && signal.count > 0 && (
        <span className="flex-none border border-line px-1 font-data text-[10px] font-semibold tabular-nums leading-tight text-ink-mute">
          {signal.count}
        </span>
      )}
      {signal?.tone && (
        <StatusDot tone={signal.tone} live={signal.live} size="xs" />
      )}

      {!compact && !item.available && (
        <span className="t-label flex-none text-[8px] text-ink-ghost">SOON</span>
      )}
    </>
  );

  if (!item.available) {
    return (
      <span
        className={rowClass}
        aria-disabled="true"
        title={`${item.description} — available in a later phase`}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={item.href as Route}
      className={rowClass}
      aria-current={active ? "page" : undefined}
      title={compact ? `${item.label} — ${item.description}` : item.description}
      onClick={onNavigate}
    >
      {inner}
      {compact && <span className="sr-only">{item.label}</span>}
    </Link>
  );
}
