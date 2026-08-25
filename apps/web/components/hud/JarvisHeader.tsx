"use client";

/**
 * JarvisHeader — the dramatic JARVIS landing-page header used across all 4
 * Next.js routes (/, /command-center, /apex, /usage).
 *
 * Big "J.A.R.V.I.S." wordmark + page-specific tagline + glitch-load animation
 * + a horizontal nav bar so users can jump between pages without typing URLs.
 */

interface JarvisHeaderProps {
  /** Page-specific tagline shown below the wordmark. */
  tagline?: string;
  /** Which nav item is active. Drives the highlight on the corresponding link. */
  current?: "dashboard" | "command" | "agents" | "logs";
}

const DEFAULT_TAGLINE = "// JARVIS · Next.js 14 — ambient layer //";

const NAV_ITEMS: Array<{
  key: NonNullable<JarvisHeaderProps["current"]>;
  href: string;
  label: string;
}> = [
  { key: "dashboard", href: "/", label: "Dashboard" },
  { key: "command", href: "/command-center", label: "Command" },
  { key: "agents", href: "/apex", label: "Agents" },
  { key: "logs", href: "/usage", label: "Logs" },
];

export function JarvisHeader({
  tagline = DEFAULT_TAGLINE,
  current,
}: JarvisHeaderProps) {
  return (
    <div className="flex-none px-8 pt-7 pb-4 animate-glitch">
      {/* Wordmark + tagline */}
      <div className="flex flex-col items-center text-center">
        <h1
          className="font-hud text-4xl font-bold tracking-[0.4em] text-hud-cyan"
          style={{ textShadow: "0 0 12px var(--cyan-glow)" }}
        >
          J.A.R.V.I.S.
        </h1>
        <div className="mt-2 font-data text-[11px] tracking-[0.3em] text-ink-mute uppercase">
          {tagline}
        </div>
      </div>

      {/* Nav row — horizontal bar of links to all 4 pages */}
      <nav className="mt-6 flex justify-center">
        <div className="flex gap-1 font-hud text-[11px] tracking-[0.25em] uppercase">
          {NAV_ITEMS.map((item) => {
            const isActive = current === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                className={
                  "px-4 py-1.5 border transition-all " +
                  (isActive
                    ? "border-hud-cyan text-hud-cyan bg-hud-cyan/10"
                    : "border-hudcss-cyan-dim text-ink-mute hover:border-hud-cyan hover:text-hud-cyan")
                }
                style={
                  isActive
                    ? { textShadow: "0 0 8px var(--cyan-glow)" }
                    : undefined
                }
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}