"use client";

import { cn } from "@/lib/utils";
import { agentStatusVisual } from "@/lib/agent-status";
import type { Agent } from "@/lib/types";

interface RingSystemProps {
  centerLabel: string;
  centerSubLabel: string;
  /**
   * Agents plotted as nodes on the outer ring, distributed evenly.
   * Each node is tinted by the agent's status.
   */
  agents?: Agent[];
  /** Called when an orbit node is activated. */
  onAgentSelect?: (agent: Agent) => void;
  className?: string;
}

const OUTER_R = 122;
const MID_R = 92;
const INNER_R = 58;

/**
 * RingSystem — the Hermes Core visualisation.
 *
 * Three counter-rotating rings around a labelled hub, with the agent roster
 * plotted as nodes on the outer orbit. Scales with its container rather than
 * a fixed pixel size, so it works from phone to wide desktop.
 *
 * All rotation is decorative and stops under `prefers-reduced-motion`; the
 * node positions and colours (which carry the actual information) do not move.
 */
export function RingSystem({
  centerLabel,
  centerSubLabel,
  agents = [],
  onAgentSelect,
  className,
}: RingSystemProps) {
  return (
    <div
      className={cn(
        // Capped so the core never crowds out the panels stacked beneath it
        // at tablet widths, where the column is a single full-width stack.
        "relative mx-auto aspect-square w-full max-w-[300px] xl:max-w-[380px]",
        className,
      )}
    >
      {/* Ambient core glow */}
      <div
        aria-hidden
        className="absolute inset-[18%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,217,255,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Outer ring — slow clockwise */}
      <svg
        aria-hidden
        viewBox="-150 -150 300 300"
        className="absolute inset-0 h-full w-full animate-spin-cw"
      >
        <circle
          r={OUTER_R}
          fill="none"
          stroke="var(--accent-line)"
          strokeWidth={1}
          strokeDasharray="3 9"
        />
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1={0}
            y1={-OUTER_R - 5}
            x2={0}
            y2={-OUTER_R + 5}
            stroke="var(--accent-muted)"
            strokeWidth={1.2}
            transform={`rotate(${deg})`}
          />
        ))}
      </svg>

      {/* Mid ring — slower clockwise */}
      <svg
        aria-hidden
        viewBox="-150 -150 300 300"
        className="absolute inset-0 h-full w-full animate-spin-cw-slow"
      >
        <circle
          r={MID_R}
          fill="none"
          stroke="rgba(0,217,255,0.10)"
          strokeWidth={1}
        />
        <path
          d={`M 0 ${-MID_R} A ${MID_R} ${MID_R} 0 0 1 ${MID_R} 0`}
          fill="none"
          stroke="var(--accent-muted)"
          strokeWidth={1.4}
          strokeLinecap="round"
          opacity={0.5}
        />
      </svg>

      {/* Inner ring — counter-clockwise */}
      <svg
        aria-hidden
        viewBox="-150 -150 300 300"
        className="absolute inset-0 h-full w-full animate-spin-ccw"
      >
        <circle
          r={INNER_R}
          fill="none"
          stroke="var(--accent-line)"
          strokeWidth={1}
          strokeDasharray="18 8"
        />
        {[45, 135, 225, 315].map((deg) => (
          <circle
            key={deg}
            cx={0}
            cy={-INNER_R}
            r={1.8}
            fill="var(--accent)"
            transform={`rotate(${deg})`}
          />
        ))}
      </svg>

      {/* Agent orbit nodes — static, so labels stay readable. */}
      {agents.length > 0 && (
        <ul className="absolute inset-0">
          {agents.map((agent, i) => {
            const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
            // Percentage positioning keeps nodes aligned as the box scales.
            // Inset from the ring radius so the labels stay inside the panel.
            const pct = (OUTER_R / 150) * 50 * 0.88;
            const left = 50 + Math.cos(angle) * pct;
            const top = 50 + Math.sin(angle) * pct;
            const visual = agentStatusVisual(agent.status);

            const node = (
              <>
                <span
                  className={cn(
                    "hud-dot",
                    visual.live && "hud-dot--live",
                    visual.text,
                  )}
                  style={{ width: 7, height: 7 }}
                />
                <span className="font-hud text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-ink-mute">
                  {agent.name}
                </span>
              </>
            );

            return (
              <li
                key={agent.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {onAgentSelect ? (
                  <button
                    type="button"
                    onClick={() => onAgentSelect(agent)}
                    title={`${agent.name} — ${visual.label}`}
                    className="flex flex-col items-center gap-1 p-1 transition-opacity hover:opacity-100 focus-visible:opacity-100 md:opacity-80"
                  >
                    {node}
                    <span className="sr-only">
                      {agent.name}, {visual.label}
                    </span>
                  </button>
                ) : (
                  <span className="flex flex-col items-center gap-1 p-1">
                    {node}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="font-hud text-lg font-bold uppercase tracking-[0.3em] text-hud-cyan sm:text-xl">
          {centerLabel}
        </div>
        <div className="t-label mt-1.5 tracking-[0.2em]">{centerSubLabel}</div>
      </div>
    </div>
  );
}
