"use client";

import { cn } from "@/lib/utils";
import { agentStatusVisual } from "@/lib/agent-status";
import type { Agent, CoreState, StatusTone } from "@/lib/types";

const OUTER_R = 128; // telemetry ring
const STATUS_R = 108; // state arc
const RADAR_R = 74; // inner radar
const HUB_R = 30;

/** Ring accent per core state. Only the status arc changes colour. */
const STATE_STROKE: Record<CoreState, string> = {
  idle: "var(--status-neutral)",
  active: "var(--status-active)",
  processing: "var(--accent)",
  attention: "var(--status-warn)",
};

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-hud-muted",
  info: "text-hud-cyan",
  active: "text-hud-green",
  warn: "text-hud-amber",
  critical: "text-hud-red",
};

interface CoreVisualizationProps {
  state: CoreState;
  /** Agents plotted as orbit markers. */
  agents: Agent[];
  /** Focused agent id — its marker is emphasised. */
  focusedAgentId?: string | null;
  onAgentSelect?: (agent: Agent) => void;
  /** 0–100 fill of the status arc, e.g. mission progress. */
  progress?: number;
  className?: string;
}

/**
 * CoreVisualization — the layered Hermes Core.
 *
 * Four concentric layers, outermost first:
 *   1. telemetry ring    — dashed, slow clockwise, purely ambient
 *   2. status arc        — colour and fill carry the core state + progress
 *   3. inner radar       — static rings and crosshair
 *   4. hub               — the Hermes indicator itself
 * plus agent orbit markers, which are *not* rotated so their labels stay
 * readable and their hit targets stay still.
 *
 * Kept to a few dozen SVG nodes and CSS-only animation — no canvas, no
 * per-frame JS. All rotation stops under `prefers-reduced-motion`; the
 * information-carrying parts (arc colour, marker colour, labels) do not move
 * in the first place, so nothing is lost.
 */
export function CoreVisualization({
  state,
  agents,
  focusedAgentId,
  onAgentSelect,
  progress,
  className,
}: CoreVisualizationProps) {
  const stroke = STATE_STROKE[state];

  // Status arc: circumference-based dash so `progress` reads as a filled arc.
  const circumference = 2 * Math.PI * STATUS_R;
  const filled =
    typeof progress === "number"
      ? (Math.min(100, Math.max(0, progress)) / 100) * circumference
      : circumference * 0.68;

  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full max-w-[260px] sm:max-w-[300px] xl:max-w-[340px]",
        className,
      )}
    >
      {/* Ambient glow behind the hub */}
      <div
        aria-hidden
        className="absolute inset-[22%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,217,255,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Layer 1 — telemetry ring (rotates) */}
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
          strokeDasharray="2 10"
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

      {/* Layer 2 — status arc (static; colour carries meaning) */}
      <svg
        aria-hidden
        viewBox="-150 -150 300 300"
        className="absolute inset-0 h-full w-full -rotate-90"
      >
        <circle
          r={STATUS_R}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={2}
        />
        <circle
          r={STATUS_R}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          opacity={0.75}
          className="transition-[stroke-dasharray,stroke] duration-[var(--dur-slow)] ease-hud"
        />
      </svg>

      {/* Layer 3 — inner radar (counter-rotating sweep) */}
      <svg
        aria-hidden
        viewBox="-150 -150 300 300"
        className="absolute inset-0 h-full w-full"
      >
        <circle
          r={RADAR_R}
          fill="none"
          stroke="var(--accent-line)"
          strokeWidth={1}
        />
        <circle
          r={RADAR_R * 0.62}
          fill="none"
          stroke="var(--accent-line-soft)"
          strokeWidth={1}
        />
        <line
          x1={-RADAR_R}
          y1={0}
          x2={RADAR_R}
          y2={0}
          stroke="var(--accent-line-soft)"
          strokeWidth={1}
          strokeDasharray="2 5"
        />
        <line
          x1={0}
          y1={-RADAR_R}
          x2={0}
          y2={RADAR_R}
          stroke="var(--accent-line-soft)"
          strokeWidth={1}
          strokeDasharray="2 5"
        />
      </svg>

      {/* Radar sweep — its own layer so only this rotates */}
      <svg
        aria-hidden
        viewBox="-150 -150 300 300"
        className="absolute inset-0 h-full w-full animate-spin-ccw"
      >
        <defs>
          <linearGradient id="core-sweep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-RADAR_R}
          stroke="url(#core-sweep)"
          strokeWidth={2}
        />
      </svg>

      {/* Layer 4 — hub */}
      <svg
        aria-hidden
        viewBox="-150 -150 300 300"
        className="absolute inset-0 h-full w-full"
      >
        <circle r={HUB_R} fill="rgba(3,6,13,0.75)" />
        <circle
          r={HUB_R}
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          opacity={0.7}
          className="transition-[stroke] duration-[var(--dur-slow)]"
        />
      </svg>

      {/* Agent orbit markers — static so labels stay upright and clickable. */}
      {agents.length > 0 && (
        <ul className="absolute inset-0">
          {agents.map((agent, i) => {
            const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
            // Percentage placement keeps markers aligned as the box scales.
            const radiusPct = (OUTER_R / 150) * 50 * 0.86;
            const left = 50 + Math.cos(angle) * radiusPct;
            const top = 50 + Math.sin(angle) * radiusPct;
            const visual = agentStatusVisual(agent.status);
            const focused = agent.id === focusedAgentId;

            return (
              <li
                key={agent.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <OrbitMarker
                  agent={agent}
                  tone={visual.tone}
                  live={visual.live}
                  label={visual.label}
                  focused={focused}
                  onSelect={onAgentSelect}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OrbitMarker({
  agent,
  tone,
  live,
  label,
  focused,
  onSelect,
}: {
  agent: Agent;
  tone: StatusTone;
  live: boolean;
  label: string;
  focused: boolean;
  onSelect?: (agent: Agent) => void;
}) {
  const body = (
    <>
      <span
        className={cn("hud-dot", live && "hud-dot--live", TONE_TEXT[tone])}
        style={{ width: focused ? 9 : 7, height: focused ? 9 : 7 }}
      />
      <span
        className={cn(
          "font-hud text-[8px] font-semibold uppercase leading-none tracking-[0.14em] transition-colors",
          focused ? "text-hud-cyan" : "text-ink-mute",
        )}
      >
        {agent.name}
      </span>
    </>
  );

  if (!onSelect) {
    return <span className="flex flex-col items-center gap-1 p-1">{body}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(agent)}
      aria-pressed={focused}
      title={`${agent.name} — ${label}`}
      className={cn(
        "flex flex-col items-center gap-1 rounded-sm p-1 transition-opacity",
        focused ? "opacity-100" : "opacity-75 hover:opacity-100",
      )}
    >
      {body}
      <span className="sr-only">
        {agent.name}, {label}. {agent.activity ?? ""}
      </span>
    </button>
  );
}
