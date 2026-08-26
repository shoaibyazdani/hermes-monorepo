"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { HudCorners } from "./HudCorners";
import { StatusDot } from "./StatusDot";
import type { StatusTone } from "@/lib/types";

/**
 * Panel — the core Hermes surface primitive.
 *
 * Everything that holds information sits inside one. Variants carry state
 * (default / active / warning / critical / glass / bare) so screens never
 * hand-roll a border colour.
 */
const panelVariants = cva(
  [
    "relative isolate",
    "border backdrop-blur-md",
    "transition-[border-color,box-shadow,background-color] duration-[var(--dur-base)] ease-hud",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-surface border-line shadow-panel",
        active:
          "bg-surface border-hud-cyan/45 shadow-[var(--shadow-panel),0_0_24px_-8px_var(--accent-glow)]",
        warning:
          "bg-surface border-hud-amber/45 shadow-[var(--shadow-panel),0_0_24px_-10px_rgba(245,158,11,0.5)]",
        critical:
          "bg-surface border-hud-red/50 shadow-[var(--shadow-panel),0_0_26px_-10px_rgba(255,59,48,0.55)]",
        glass:
          "bg-surface-glass border-line-soft shadow-none",
        bare: "bg-transparent border-transparent shadow-none",
      },
      /** Corner clip size. */
      corners: {
        none: "",
        sm: "clip-hud-sm",
        md: "clip-hud",
        lg: "clip-hud-lg",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-5",
      },
      /** Lifts the border and adds a faint illumination on pointer-over. */
      interactive: {
        true: "hover:border-hud-cyan/50 hover:bg-surface-raised focus-within:border-hud-cyan/50",
        false: "",
      },
      /** Renders the animated scanning sheen. Reserve for live work. */
      scanning: {
        true: "hud-scanning overflow-hidden",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      corners: "md",
      padding: "md",
      interactive: false,
      scanning: false,
    },
  },
);

/** Panel border tone per status tone — used by callers mapping agent state. */
export const TONE_TO_PANEL_VARIANT: Record<
  StatusTone,
  NonNullable<VariantProps<typeof panelVariants>["variant"]>
> = {
  neutral: "default",
  info: "active",
  active: "active",
  warn: "warning",
  critical: "critical",
};

export interface PanelProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title">,
    VariantProps<typeof panelVariants> {
  /** Panel header title. Rendered in the panel-title type level. */
  title?: React.ReactNode;
  /** Small uppercase label rendered to the right of the title. */
  eyebrow?: React.ReactNode;
  /** Status indicator shown beside the title. */
  status?: StatusTone;
  /** Marks the status dot as live (adds the ripple halo). */
  statusLive?: boolean;
  /** Actions rendered at the far right of the header row. */
  actions?: React.ReactNode;
  /** Telemetry strip rendered below the body, above the bottom border. */
  footer?: React.ReactNode;
  /** Draws L-shaped corner brackets. Off by default — use for emphasis. */
  brackets?: boolean;
  /**
   * Lets the body grow to fill the panel's height. Use when the panel is
   * stretched by a taller sibling column and the content should centre in the
   * space rather than leave a void beneath it.
   */
  fill?: boolean;
  /** Entrance stagger index; multiplied by 55ms. */
  stagger?: number;
  /** Render as a different element (e.g. "section", "li"). */
  as?: "div" | "section" | "article" | "li" | "aside";
}

export function Panel({
  children,
  className,
  variant,
  corners,
  padding,
  interactive,
  scanning,
  title,
  eyebrow,
  status,
  statusLive,
  actions,
  footer,
  brackets = false,
  fill = false,
  stagger,
  as: Tag = "div",
  style,
  ...rest
}: PanelProps) {
  const hasHeader = Boolean(title || eyebrow || actions || status);

  return (
    <Tag
      className={cn(
        panelVariants({ variant, corners, padding, interactive, scanning }),
        stagger !== undefined && "hud-reveal",
        className,
      )}
      style={
        stagger !== undefined
          ? ({ ...style, "--reveal-delay": `${stagger * 55}ms` } as React.CSSProperties)
          : style
      }
      {...rest}
    >
      {brackets && <HudCorners />}

      {hasHeader && (
        <header className="relative z-[1] mb-3 flex items-center gap-2.5">
          {status && <StatusDot tone={status} live={statusLive} size="sm" />}
          {title && <h2 className="t-panel-title truncate">{title}</h2>}
          {eyebrow && (
            <span className="t-label truncate text-ink-ghost">{eyebrow}</span>
          )}
          <div className="ml-auto flex flex-none items-center gap-2">
            {actions}
          </div>
        </header>
      )}

      {hasHeader && <div className="hud-rule relative z-[1] mb-3" />}

      <div className={cn("relative z-[1]", fill && "flex min-h-0 flex-1 flex-col")}>
        {children}
      </div>

      {footer && (
        <>
          <div className="hud-rule relative z-[1] mt-3" />
          <footer className="relative z-[1] mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {footer}
          </footer>
        </>
      )}
    </Tag>
  );
}

export { panelVariants };
