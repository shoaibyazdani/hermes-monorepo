"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeNavKey } from "@/lib/navigation";
import { HudBackdrop } from "@/components/hud/HudBackdrop";
import { VoiceCommandBar } from "@/components/voice/VoiceCommandBar";
import { useSystemTelemetry } from "@/hooks/useSystemTelemetry";
import { MobileNav } from "./MobileNav";
import { SideNav, type NavSignal } from "./SideNav";
import { TopSystemBar } from "./TopSystemBar";

interface AppShellProps {
  children: React.ReactNode;
  /** Live badges/dots keyed by nav item key. */
  navSignals?: Record<string, NavSignal>;
}

/**
 * AppShell — the Hermes application frame.
 *
 * Layout by breakpoint:
 *   - desktop (lg+): full navigation rail + content + persistent voice bar
 *   - tablet (md):   icon-only rail + content + voice bar
 *   - mobile:        top bar + content + voice bar + bottom destination bar,
 *                    with the full navigation available in a drawer
 *
 * Rendered once from the root layout so every route inherits the same frame
 * and future destinations plug in without redesigning anything.
 */
export function AppShell({ children, navSignals }: AppShellProps) {
  const pathname = usePathname();
  const activeKey = activeNavKey(pathname ?? "/");
  const { status } = useSystemTelemetry();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on route change and on Escape.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      <HudBackdrop />
      <div aria-hidden className="hud-scanline" />

      <a
        href="#hermes-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-hud-cyan focus:bg-surface-raised focus:px-3 focus:py-2 focus:font-hud focus:text-xs focus:uppercase focus:tracking-[0.2em] focus:text-hud-cyan"
      >
        Skip to content
      </a>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <TopSystemBar status={status} onOpenNav={() => setDrawerOpen(true)} />

        <div className="flex min-h-0 flex-1">
          {/* Desktop rail */}
          <aside className="hidden flex-none overflow-y-auto border-r border-line bg-surface-deep/30 py-3 backdrop-blur-sm md:block md:w-shell-nav-compact lg:w-shell-nav lg:px-2">
            <SideNav
              activeKey={activeKey}
              signals={navSignals}
              compact
              className="lg:hidden"
            />
            <SideNav
              activeKey={activeKey}
              signals={navSignals}
              className="hidden lg:flex"
            />
          </aside>

          {/* Content */}
          <main
            id="hermes-main"
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {children}
          </main>
        </div>

        <VoiceCommandBar />
        <MobileNav activeKey={activeKey} className="md:hidden" />
      </div>

      {/* Mobile navigation drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className={cn(
              "absolute inset-y-0 left-0 flex w-[248px] flex-col border-r border-line",
              "bg-surface-deep/95 p-3 backdrop-blur-xl",
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="t-system-title text-hud-cyan">HERMES</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="border border-line p-1.5 text-ink-mute transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan"
                aria-label="Close navigation"
              >
                <X size={15} strokeWidth={1.8} aria-hidden />
              </button>
            </div>
            <SideNav
              activeKey={activeKey}
              signals={navSignals}
              onNavigate={() => setDrawerOpen(false)}
              className="overflow-y-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
