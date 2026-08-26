"use client";

import { cn } from "@/lib/utils";
import { agentStatusVisual } from "@/lib/agent-status";
import type { AgentStatus } from "@/lib/types";

// Re-exported for the components that imported the type from here originally.
export type { AgentStatus };

interface AgentDotProps {
  x: number;
  y: number;
  status: AgentStatus;
  label?: string;
  onClick?: () => void;
}

/**
 * AgentDot — an agent plotted inside the radar's 400x400 viewBox.
 *
 * Colour and the "is it live" halo both come from `agentStatusVisual`, so the
 * radar stays in step with cards and badges automatically.
 */
export function AgentDot({ x, y, status, label, onClick }: AgentDotProps) {
  const visual = agentStatusVisual(status);
  const color = visual.css;

  const dot = (
    <>
      {visual.live && (
        <circle
          cx={x}
          cy={y}
          r="6"
          fill="none"
          stroke={color}
          strokeWidth="1"
          className="agent-halo"
          style={{ color }}
        />
      )}
      <circle
        cx={x}
        cy={y}
        r="5"
        className={cn("agent-dot", status)}
        style={{ fill: color, filter: `drop-shadow(0 0 5px ${color})` }}
      />
      {label && (
        <text
          x={x}
          y={y + 20}
          fill="var(--text-mute)"
          fontSize="8"
          textAnchor="middle"
          fontFamily="var(--font-hud)"
          fontWeight="600"
          letterSpacing="1.2"
        >
          {label.toUpperCase()}
        </text>
      )}
    </>
  );

  if (!onClick) return <g>{dot}</g>;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label ?? "Agent"} — ${visual.label}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer [&:focus-visible>circle:first-of-type]:stroke-hud-cyan [&:focus-visible>circle:first-of-type]:stroke-2"
    >
      {/* Generous invisible hit target — the visible dot is only 5px. It also
          carries the focus ring, since the dot itself is too small to show one. */}
      <circle cx={x} cy={y} r="14" fill="transparent" stroke="none" />
      {dot}
    </g>
  );
}
