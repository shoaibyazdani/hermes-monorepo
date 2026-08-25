"use client";

import { cn } from "@/lib/utils";

export type AgentStatus = "working" | "idle" | "sleeping" | "error" | "ready";

interface AgentDotProps {
  x: number;
  y: number;
  status: AgentStatus;
  label?: string;
  onClick?: () => void;
}

const colorByStatus: Record<AgentStatus, string> = {
  working: "var(--green)",
  idle: "var(--text-mute)",
  sleeping: "#818cf8",
  error: "var(--red)",
  ready: "var(--cyan)",
};

export function AgentDot({ x, y, status, label, onClick }: AgentDotProps) {
  const color = colorByStatus[status];
  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      {/* halo (animated via CSS) */}
      <circle
        cx={x}
        cy={y}
        r="6"
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.6"
        className="agent-halo"
        style={{ color }}
      />
      {/* dot */}
      <circle
        cx={x}
        cy={y}
        r="6"
        className={cn("agent-dot", status)}
        style={{ fill: color, filter: `drop-shadow(0 0 6px ${color})` }}
      />
      {label && (
        <text
          x={x}
          y={y + 24}
          fill="var(--text)"
          fontSize="9"
          textAnchor="middle"
          className="font-data"
          letterSpacing="0.1em"
        >
          {label.toUpperCase()}
        </text>
      )}
    </g>
  );
}
