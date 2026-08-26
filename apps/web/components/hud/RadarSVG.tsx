"use client";

import { AgentDot } from "./AgentDot";
import type { Agent } from "@/lib/types";

/** Agents plottable on the radar — those carrying viewBox coordinates. */
export type RadarAgent = Agent & { x: number; y: number };

interface RadarSVGProps {
  agents: Agent[];
  onAgentClick?: (id: string) => void;
}

/** Agents without coordinates cannot be plotted; drop them. */
function plottable(agents: Agent[]): RadarAgent[] {
  return agents.filter(
    (a): a is RadarAgent => typeof a.x === "number" && typeof a.y === "number",
  );
}

export function RadarSVG({ agents, onAgentClick }: RadarSVGProps) {
  const plotted = plottable(agents);

  return (
    <svg
      className="radar-svg h-full w-full"
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Agent radar — ${plotted.length} agents plotted`}
    >
      <defs>
        <radialGradient id="sweep-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 212, 255, 0.4)" />
          <stop offset="100%" stopColor="rgba(0, 212, 255, 0)" />
        </radialGradient>
      </defs>

      {/* Rings */}
      <circle className="ring major" cx="200" cy="200" r="190" />
      <circle className="ring major" cx="200" cy="200" r="160" />
      <circle className="ring major" cx="200" cy="200" r="120" />
      <circle className="ring" cx="200" cy="200" r="80" />
      <circle className="ring" cx="200" cy="200" r="40" />

      {/* Cross hairs */}
      <line className="cross" x1="10" y1="200" x2="390" y2="200" />
      <line className="cross" x1="200" y1="10" x2="200" y2="390" />

      {/* Corner brackets */}
      <g>
        <polyline className="corner-bracket" points="20,40 20,20 40,20" />
        <polyline className="corner-bracket" points="360,20 380,20 380,40" />
        <polyline className="corner-bracket" points="380,360 380,380 360,380" />
        <polyline className="corner-bracket" points="40,380 20,380 20,360" />
      </g>

      {/* Cardinal labels */}
      <text className="label" x="200" y="14">N</text>
      <text className="label" x="200" y="394">S</text>
      <text className="label" x="8" y="203">W</text>
      <text className="label" x="386" y="203">E</text>

      {/* Sweep line */}
      <line
        className="sweep"
        x1="200"
        y1="200"
        x2="200"
        y2="20"
        stroke="rgba(0, 212, 255, 0.6)"
        strokeWidth="2"
      />

      {/* Pulse rings */}
      <circle className="pulse-circle" cx="200" cy="200" r="50" />
      <circle
        className="pulse-circle"
        cx="200"
        cy="200"
        r="50"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Agent dots */}
      <g>
        {plotted.map((a) => (
          <AgentDot
            key={a.id}
            x={a.x}
            y={a.y}
            status={a.status}
            label={a.name}
            onClick={onAgentClick ? () => onAgentClick(a.id) : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
