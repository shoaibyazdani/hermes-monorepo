"use client";

import { cn } from "@/lib/utils";
import { agentStatusVisual } from "@/lib/agent-status";
import type { Agent, Mission, MissionTask, OperationEvent } from "@/lib/types";

interface MissionNetworkProps {
  mission: Mission;
  /** Agents participating in this mission, lead first. */
  agents: Agent[];
  tasks: MissionTask[];
  /** Recent mission events, used to draw the live flows between agents. */
  events: OperationEvent[];
  onSelect?: (agent: Agent) => void;
  className?: string;
}

/** Flow kinds drawn between mission participants. */
const FLOW_STYLE = {
  delegation: { stroke: "var(--accent)", dashed: false, label: "DELEGATED" },
  handoff: { stroke: "var(--status-active)", dashed: false, label: "HANDOFF" },
  waiting: { stroke: "var(--status-warn)", dashed: true, label: "WAITING ON" },
} as const;

type FlowKind = keyof typeof FLOW_STYLE;

interface Flow {
  from: string;
  to: string;
  kind: FlowKind;
  label: string;
}

/**
 * MissionNetwork — who is on this mission and what is passing between them.
 *
 * Deliberately different from the global `AgentNetwork`, which answers "how is
 * the fleet related". This answers "who is participating here and what is the
 * work doing right now": the lead sits at the top, support fans out beneath,
 * and edges are drawn from actual mission events rather than a static graph.
 *
 * Plain SVG — a handful of nodes and edges, so a layout library would add a
 * dependency and per-frame work for a shape already known.
 */
export function MissionNetwork({
  mission,
  agents,
  tasks,
  events,
  onSelect,
  className,
}: MissionNetworkProps) {
  const leadId = mission.leadAgentId ?? mission.assignedAgentIds[0];
  const lead = agents.find((a) => a.id === leadId);
  const support = agents.filter((a) => a.id !== leadId);

  /**
   * Derive flows from the mission's recent events.
   *
   * Only the newest directed event per agent pair is drawn, so the diagram
   * shows the current relationship rather than an accumulated history.
   */
  const flows: Flow[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (!e.agentId || !e.targetAgentId) continue;
    const key = `${e.agentId}->${e.targetAgentId}`;
    if (seen.has(key)) continue;

    let kind: FlowKind | null = null;
    if (e.type === "delegation") kind = "delegation";
    else if (e.type === "handoff") kind = "handoff";
    else if (e.type === "agent-waiting") kind = "waiting";
    if (!kind) continue;

    seen.add(key);
    flows.push({
      from: e.agentId,
      to: e.targetAgentId,
      kind,
      label: FLOW_STYLE[kind].label,
    });
  }

  // Layout: lead centred on top, support spread along a row beneath.
  const W = 400;
  const LEAD_Y = 52;
  const SUPPORT_Y = 158;
  const pos = new Map<string, { x: number; y: number }>();
  if (lead) pos.set(lead.id, { x: W / 2, y: LEAD_Y });
  support.forEach((a, i) => {
    const slot = support.length === 1 ? 0.5 : i / (support.length - 1);
    pos.set(a.id, { x: 70 + slot * (W - 140), y: SUPPORT_Y });
  });

  const taskFor = (agentId: string) =>
    tasks.find((t) => t.assignedAgentId === agentId && t.status === "active") ??
    tasks.find((t) => t.assignedAgentId === agentId && t.status === "blocked");

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${W} 210`}
        className="h-auto w-full"
        role="img"
        aria-label={`${mission.title} participants — ${agents.length} agents`}
      >
        {/* Structural edges: lead to each supporting agent. */}
        <g>
          {lead &&
            support.map((a) => {
              const from = pos.get(lead.id);
              const to = pos.get(a.id);
              if (!from || !to) return null;
              return (
                <line
                  key={`struct-${a.id}`}
                  x1={from.x}
                  y1={from.y + 18}
                  x2={to.x}
                  y2={to.y - 18}
                  stroke="var(--border)"
                  strokeWidth={1}
                  opacity={0.5}
                />
              );
            })}
        </g>

        {/* Live flows derived from events, drawn over the structure. */}
        <defs>
          <marker
            id="mission-arrow"
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
          </marker>
        </defs>
        <g>
          {flows.map((f, i) => {
            const from = pos.get(f.from);
            const to = pos.get(f.to);
            if (!from || !to) return null;
            const style = FLOW_STYLE[f.kind];
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={`${f.from}-${f.to}-${i}`}>
                <line
                  x1={from.x}
                  y1={from.y + (to.y > from.y ? 18 : -18)}
                  x2={to.x}
                  y2={to.y + (to.y > from.y ? -22 : 22)}
                  stroke={style.stroke}
                  strokeWidth={1.6}
                  strokeDasharray={style.dashed ? "4 4" : undefined}
                  markerEnd="url(#mission-arrow)"
                  opacity={0.9}
                />
                <text
                  x={midX}
                  y={midY - 3}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="var(--font-hud)"
                  fontWeight={700}
                  letterSpacing="1"
                  fill={style.stroke}
                >
                  {f.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Participants */}
        <g>
          {agents.map((a) => {
            const p = pos.get(a.id);
            if (!p) return null;
            const visual = agentStatusVisual(a.status);
            const isLead = a.id === leadId;
            const task = taskFor(a.id);
            const r = isLead ? 17 : 14;

            return (
              <g
                key={a.id}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={`${a.name}, ${isLead ? "lead" : "support"}, ${visual.label}${task ? `, ${task.title}` : ""}`}
                onClick={onSelect ? () => onSelect(a) : undefined}
                onKeyDown={
                  onSelect
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(a);
                        }
                      }
                    : undefined
                }
                className={cn(
                  onSelect && "cursor-pointer outline-none",
                  onSelect &&
                    "[&:focus-visible>circle:first-of-type]:stroke-hud-cyan [&:focus-visible>circle:first-of-type]:stroke-2",
                )}
              >
                <circle cx={p.x} cy={p.y} r={r + 8} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill="rgba(3,6,13,0.85)"
                  stroke={visual.css}
                  strokeWidth={isLead ? 2 : 1.2}
                />
                {visual.live && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill="none"
                    stroke={visual.css}
                    strokeWidth={1}
                    className="agent-halo"
                    style={{ color: visual.css }}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={3.5} fill={visual.css} />

                <text
                  x={p.x}
                  y={p.y + r + 12}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="var(--font-hud)"
                  fontWeight={700}
                  letterSpacing="1.2"
                  fill="var(--text-mute)"
                >
                  {a.name}
                </text>
                <text
                  x={p.x}
                  y={p.y + r + 22}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="var(--font-hud)"
                  letterSpacing="1"
                  fill={visual.css}
                >
                  {visual.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Written form of the same information, for scanning and for anyone
          who cannot read the diagram. */}
      <ul className="mt-2 space-y-0">
        {agents.map((a) => {
          const visual = agentStatusVisual(a.status);
          const task = taskFor(a.id);
          return (
            <li
              key={a.id}
              className="flex items-baseline gap-2 border-b border-line-soft py-1.5 last:border-b-0"
            >
              <span className="w-[70px] flex-none font-hud text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
                {a.name}
              </span>
              <span
                className={cn(
                  "w-[70px] flex-none font-hud text-[9px] font-semibold uppercase tracking-[0.14em]",
                  visual.text,
                )}
              >
                {visual.label}
              </span>
              <span className="t-meta min-w-0 flex-1 truncate">
                {task?.title ?? a.activity ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
