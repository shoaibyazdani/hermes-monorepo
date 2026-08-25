"use client";

import { cn } from "@/lib/utils";

interface RingSystemProps {
  size?: number; // pixels, default 560
  centerLabel: string;
  centerSubLabel: string;
}

/**
 * Ambient orbiting rings — 3 concentric SVGs at different speeds.
 * Center hub text rendered above by parent.
 */
export function RingSystem({
  size = 560,
  centerLabel,
  centerSubLabel,
}: RingSystemProps) {
  return (
    <div
      className="relative"
      style={{ width: size, height: size, maxWidth: "90%" }}
    >
      {/* Outer ring — 12s clockwise */}
      <svg
        viewBox="-150 -150 300 300"
        className="absolute inset-0 w-full h-full [filter:drop-shadow(0_0_4px_var(--cyan-glow))] animate-spin-cw"
      >
        <circle
          r="120"
          fill="none"
          stroke="var(--cyan-dim)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />
        <circle cx="0" cy="-120" r="4" fill="var(--cyan)" />
        <circle cx="104" cy="60" r="4" fill="var(--cyan)" />
        <circle cx="-104" cy="60" r="4" fill="var(--cyan)" />
      </svg>

      {/* Mid ring — 18s clockwise */}
      <svg
        viewBox="-150 -150 300 300"
        className="absolute inset-0 w-full h-full [filter:drop-shadow(0_0_4px_var(--cyan-glow))] animate-spin-cw-slow"
      >
        <circle
          r="90"
          fill="none"
          stroke="rgba(255, 107, 53, 0.2)"
          strokeWidth="1"
          strokeDasharray="2 12"
        />
        <circle cx="0" cy="-90" r="3" fill="var(--amber)" />
        <circle cx="-90" cy="0" r="3" fill="var(--amber)" />
        <circle cx="90" cy="0" r="3" fill="var(--amber)" />
      </svg>

      {/* Inner ring — 24s counter-clockwise */}
      <svg
        viewBox="-150 -150 300 300"
        className="absolute inset-0 w-full h-full [filter:drop-shadow(0_0_4px_var(--cyan-glow))] animate-spin-ccw"
      >
        <circle
          r="50"
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="1.2"
          strokeDasharray="6 4"
        />
        <circle cx="0" cy="-50" r="3" fill="var(--cyan)" />
        <circle cx="50" cy="0" r="3" fill="var(--cyan)" />
        <circle cx="0" cy="50" r="3" fill="var(--cyan)" />
        <circle cx="-50" cy="0" r="3" fill="var(--cyan)" />
      </svg>

      {/* Center hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="font-hud text-2xl font-bold tracking-[0.4em] text-hud-cyan [text-shadow:0_0_16px_var(--cyan-glow)]">
          {centerLabel}
        </div>
        <div className="mt-1.5 font-data text-[10px] tracking-[0.3em] text-ink-mute uppercase">
          {centerSubLabel}
        </div>
      </div>
    </div>
  );
}
