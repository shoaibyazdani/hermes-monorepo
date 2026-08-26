"use client";

import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_KEYS, NAV_ITEMS } from "@/lib/navigation";

interface MobileNavProps {
  activeKey?: string;
  className?: string;
}

/**
 * MobileNav — a fixed bottom destination bar for phone widths.
 *
 * Deliberately a different component from `SideNav`: mobile gets the four
 * most-used destinations at thumb reach, not a collapsed desktop rail. The
 * full list stays reachable through the drawer.
 */
export function MobileNav({ activeKey, className }: MobileNavProps) {
  const items = MOBILE_NAV_KEYS.map((key) =>
    NAV_ITEMS.find((i) => i.key === key),
  ).filter((i): i is (typeof NAV_ITEMS)[number] => Boolean(i));

  return (
    <nav
      aria-label="Primary, compact"
      className={cn(
        "flex flex-none border-t border-line bg-surface-deep/95 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeKey;
        return (
          <Link
            key={item.key}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 border-t-2 py-2 transition-colors",
              active
                ? "border-t-hud-cyan text-hud-cyan"
                : "border-t-transparent text-ink-faint hover:text-ink-mute",
            )}
          >
            <Icon size={17} strokeWidth={1.7} aria-hidden />
            <span className="font-hud text-[9px] font-semibold uppercase tracking-[0.16em]">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
