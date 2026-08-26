import { cn } from "@/lib/utils";

interface HudCornersProps {
  /** Bracket arm length in px. */
  size?: number;
  /** Inset from the panel edge in px. */
  inset?: number;
  className?: string;
}

/**
 * Four L-shaped corner brackets — the targeting-reticle motif.
 *
 * Purely decorative, so it is `aria-hidden` and never intercepts pointers.
 * Use sparingly: brackets mark a panel as primary, not as merely present.
 */
export function HudCorners({
  size = 14,
  inset = 5,
  className,
}: HudCornersProps) {
  const box = { width: size, height: size } as const;
  const base = "absolute border-hud-cyan/55 pointer-events-none";

  return (
    <span aria-hidden className={cn("absolute inset-0 z-0", className)}>
      <span
        className={cn(base, "border-t border-l")}
        style={{ ...box, top: inset, left: inset }}
      />
      <span
        className={cn(base, "border-t border-r")}
        style={{ ...box, top: inset, right: inset }}
      />
      <span
        className={cn(base, "border-b border-r")}
        style={{ ...box, bottom: inset, right: inset }}
      />
      <span
        className={cn(base, "border-b border-l")}
        style={{ ...box, bottom: inset, left: inset }}
      />
    </span>
  );
}
