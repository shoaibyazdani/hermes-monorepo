"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { agentStatusVisual, RELATION_VISUALS } from "@/lib/agent-status";
import type { Agent, AgentRelation } from "@/lib/types";

/** Layout: HERMES at the centre, specialists on a ring around it. */
const CENTER = { x: 200, y: 150 };
const RADIUS_X = 150;
const RADIUS_Y = 96;

interface NodePos {
  agent: Agent;
  x: number;
  y: number;
}

interface AgentNetworkProps {
  agents: Agent[];
  relations: AgentRelation[];
  /** Currently selected agent — its subgraph is emphasised. */
  selectedAgentId?: string | null;
  onSelect?: (agent: Agent) => void;
  /** Opens an agent's workspace (double-purpose: click vs. open). */
  onOpen?: (agent: Agent) => void;
  className?: string;
}

/**
 * AgentNetwork — the relationship graph.
 *
 * Hand-drawn SVG rather than a graph library: the layout is a fixed hub and
 * spoke, so a force simulation would add a dependency and per-frame work for
 * a shape we already know. Nodes are ~7 circles and edges ~12 paths, which
 * stays cheap to render and re-render on hover.
 *
 * Selecting or hovering a node dims everything outside its subgraph. Edges
 * carry both colour and dash pattern so relationship kind never depends on
 * colour alone.
 *
 * Relationships are mock. No agent-to-agent channel exists.
 */
export function AgentNetwork({
  agents,
  relations,
  selectedAgentId,
  onSelect,
  onOpen,
  className,
}: AgentNetworkProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Hover takes precedence so the graph responds before a click commits.
  const focusId = hoveredId ?? selectedAgentId ?? null;

  const nodes = useMemo<NodePos[]>(() => {
    const hub = agents.find((a) => a.discipline === "core");
    const spokes = agents.filter((a) => a !== hub);

    const positioned: NodePos[] = spokes.map((agent, i) => {
      const angle = (i / spokes.length) * Math.PI * 2 - Math.PI / 2;
      return {
        agent,
        x: CENTER.x + Math.cos(angle) * RADIUS_X,
        y: CENTER.y + Math.sin(angle) * RADIUS_Y,
      };
    });

    if (hub) positioned.push({ agent: hub, x: CENTER.x, y: CENTER.y });
    return positioned;
  }, [agents]);

  const posById = useMemo(
    () => new Map(nodes.map((n) => [n.agent.id, n])),
    [nodes],
  );

  /** Agents inside the focused subgraph (the node plus everything it links to). */
  const focusSet = useMemo(() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const r of relations) {
      if (r.fromAgentId === focusId) set.add(r.toAgentId);
      if (r.toAgentId === focusId) set.add(r.fromAgentId);
    }
    return set;
  }, [focusId, relations]);

  const isDimmed = (id: string) => Boolean(focusSet && !focusSet.has(id));

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox="0 0 400 300"
        className="h-auto w-full"
        role="img"
        aria-label={`Agent relationship network — ${agents.length} agents, ${relations.length} links`}
      >
        {/* Edges first so nodes paint over them. */}
        <g>
          {relations.map((rel, i) => {
            const from = posById.get(rel.fromAgentId);
            const to = posById.get(rel.toAgentId);
            if (!from || !to) return null;

            const visual = RELATION_VISUALS[rel.kind];
            const inFocus =
              !focusSet ||
              (focusSet.has(rel.fromAgentId) && focusSet.has(rel.toAgentId));

            return (
              <line
                key={`${rel.fromAgentId}-${rel.toAgentId}-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={visual.stroke}
                strokeWidth={rel.active && inFocus ? 1.4 : 1}
                strokeDasharray={visual.dashed ? "4 4" : undefined}
                opacity={inFocus ? (rel.active ? 0.85 : 0.4) : 0.08}
                className="transition-opacity duration-[var(--dur-base)]"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node) => {
            const visual = agentStatusVisual(node.agent.status);
            const dim = isDimmed(node.agent.id);
            const selected = node.agent.id === selectedAgentId;
            const isHub = node.agent.discipline === "core";
            const r = isHub ? 15 : 11;

            return (
              <g
                key={node.agent.id}
                role="button"
                tabIndex={0}
                aria-label={`${node.agent.name}, ${node.agent.role}, ${visual.label}`}
                aria-pressed={selected}
                onMouseEnter={() => setHoveredId(node.agent.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(node.agent.id)}
                onBlur={() => setHoveredId(null)}
                onClick={() => onSelect?.(node.agent)}
                onDoubleClick={() => onOpen?.(node.agent)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onOpen?.(node.agent);
                  }
                  if (e.key === " ") {
                    e.preventDefault();
                    onSelect?.(node.agent);
                  }
                }}
                className="cursor-pointer outline-none transition-opacity duration-[var(--dur-base)] [&:focus-visible>circle:first-of-type]:stroke-hud-cyan"
                opacity={dim ? 0.25 : 1}
              >
                {/* Hit target + focus ring */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 9}
                  fill="transparent"
                  stroke="none"
                  strokeWidth={1.5}
                />
                {/* Body */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill="rgba(3,6,13,0.85)"
                  stroke={visual.css}
                  strokeWidth={selected ? 2 : 1.2}
                />
                {/* Live pulse */}
                {visual.live && !dim && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill="none"
                    stroke={visual.css}
                    strokeWidth={1}
                    className="agent-halo"
                    style={{ color: visual.css }}
                  />
                )}
                {/* Status core */}
                <circle cx={node.x} cy={node.y} r={3} fill={visual.css} />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + r + 12}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="var(--font-hud)"
                  fontWeight={700}
                  letterSpacing="1.2"
                  fill={selected ? "var(--accent)" : "var(--text-mute)"}
                >
                  {node.agent.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend — relationship kinds, so the graph is readable without hovering. */}
      <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {Object.entries(RELATION_VISUALS).map(([kind, v]) => (
          <li key={kind} className="flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden className="flex-none">
              <line
                x1="0"
                y1="2"
                x2="14"
                y2="2"
                stroke={v.stroke}
                strokeWidth={1.5}
                strokeDasharray={v.dashed ? "3 3" : undefined}
              />
            </svg>
            <span className="font-hud text-[8px] uppercase tracking-[0.16em] text-ink-faint">
              {v.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
