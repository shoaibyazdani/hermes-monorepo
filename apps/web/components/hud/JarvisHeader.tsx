"use client";

/**
 * JarvisHeader — the dramatic JARVIS landing-page header used across all 3
 * Next.js routes (/command-center, /apex, /usage).
 *
 * Big "J.A.R.V.I.S." wordmark + page-specific tagline + glitch-load animation.
 * Centralized here so the 3 page templates stay in sync.
 */

interface JarvisHeaderProps {
  /** Page-specific tagline shown below the wordmark. */
  tagline?: string;
}

const DEFAULT_TAGLINE = "// JARVIS · Next.js 14 — ambient layer //";

export function JarvisHeader({ tagline = DEFAULT_TAGLINE }: JarvisHeaderProps) {
  return (
    <div className="flex-none px-8 py-7 animate-glitch">
      <h1 className="font-hud text-4xl font-bold tracking-[0.4em] text-hud-cyan [text-shadow:0_0_12px_var(--cyan-glow)]">
        J.A.R.V.I.S.
      </h1>
      <div className="mt-2 font-data text-[11px] tracking-[0.3em] text-ink-mute uppercase">
        {tagline}
      </div>
    </div>
  );
}