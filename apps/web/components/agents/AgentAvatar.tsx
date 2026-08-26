import {
  Activity,
  Binary,
  BrainCircuit,
  Cpu,
  Radar,
  ShieldHalf,
  TestTube2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agentStatusVisual } from "@/lib/agent-status";
import type { Agent, AgentDiscipline } from "@/lib/types";

/** Each discipline gets one glyph so agents stay recognisable at a glance. */
const DISCIPLINE_ICON: Record<AgentDiscipline, LucideIcon> = {
  core: Radar,
  engineering: Cpu,
  research: BrainCircuit,
  qa: TestTube2,
  analytics: Activity,
  security: ShieldHalf,
  operations: Binary,
};

const SIZE: Record<"sm" | "md" | "lg", { box: number; icon: number }> = {
  sm: { box: 28, icon: 13 },
  md: { box: 36, icon: 16 },
  lg: { box: 48, icon: 21 },
};

interface AgentAvatarProps {
  agent: Pick<Agent, "name" | "discipline" | "status">;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * AgentAvatar — a clipped hexagonal-cut badge carrying the agent's discipline
 * glyph, framed by a border tinted to its current status.
 */
export function AgentAvatar({ agent, size = "md", className }: AgentAvatarProps) {
  const Icon = DISCIPLINE_ICON[agent.discipline] ?? Radar;
  const visual = agentStatusVisual(agent.status);
  const { box, icon } = SIZE[size];

  return (
    <span
      className={cn(
        "clip-hud-sm relative grid flex-none place-items-center border bg-surface-inset",
        visual.border,
        className,
      )}
      style={{ width: box, height: box }}
      aria-hidden
    >
      <Icon
        size={icon}
        strokeWidth={1.6}
        className={cn(visual.text, "opacity-90")}
      />
    </span>
  );
}
