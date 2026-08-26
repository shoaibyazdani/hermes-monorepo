import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/types";

const TONE_COLOR: Record<StatusTone, string> = {
  neutral: "text-hud-muted",
  info: "text-hud-cyan",
  active: "text-hud-green",
  warn: "text-hud-amber",
  critical: "text-hud-red",
};

const SIZE_PX: Record<"xs" | "sm" | "md", number> = {
  xs: 5,
  sm: 6,
  md: 8,
};

interface StatusDotProps {
  tone: StatusTone;
  /** Adds an expanding ripple halo to signal ongoing activity. */
  live?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
  /** Accessible label. Omit when an adjacent text label already names the state. */
  label?: string;
}

/**
 * StatusDot — the atom every state indicator is built from.
 *
 * Colour comes from `currentColor` so the ripple halo inherits it for free.
 * Under `prefers-reduced-motion` the halo stops animating but stays visible,
 * so "live" remains distinguishable from "idle".
 */
export function StatusDot({
  tone,
  live = false,
  size = "sm",
  className,
  label,
}: StatusDotProps) {
  const px = SIZE_PX[size];
  return (
    <span
      className={cn(
        "hud-dot",
        live && "hud-dot--live",
        TONE_COLOR[tone],
        className,
      )}
      style={{ width: px, height: px }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
