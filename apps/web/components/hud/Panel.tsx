"use client";

import { cn } from "@/lib/utils";
import { CornerBrackets } from "./CornerBrackets";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  withShimmer?: boolean;
  stagger?: 1 | 2 | 3 | 4 | 5;
}

/**
 * HUD Panel primitive — AR-cut corners + glow border + optional glitch-load
 * + optional holographic shimmer overlay.
 */
export function Panel({
  children,
  className,
  withShimmer = true,
  stagger = 1,
}: PanelProps) {
  return (
    <div
      className={cn(
        "relative bg-bg-panel border border-hudcss-cyan-dim backdrop-blur-xl",
        "p-6",
        // AR cut-corner polygon (16px cuts)
        "[clip-path:polygon(16px_0,calc(100%-16px)_0,100%_16px,100%_calc(100%-16px),calc(100%-16px)_100%,16px_100%,0_calc(100%-16px),0_16px)]",
        stagger === 1 && "animate-glitch",
        stagger === 2 && "animate-glitch [animation-delay:0.06s]",
        stagger === 3 && "animate-glitch [animation-delay:0.12s]",
        stagger === 4 && "animate-glitch [animation-delay:0.18s]",
        stagger === 5 && "animate-glitch [animation-delay:0.24s]",
        className
      )}
    >
      <CornerBrackets />
      {withShimmer && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-hud-shimmer bg-[length:200%_200%] animate-shimmer"
        />
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
