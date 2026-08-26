import { cn } from "@/lib/utils";
import { agentStatusVisual } from "@/lib/agent-status";
import { StatusDot } from "@/components/hud/StatusDot";
import type { Agent } from "@/lib/types";

interface AgentIndicatorProps {
  agent: Pick<Agent, "name" | "status">;
  /** Also render the status word after the name. */
  showStatus?: boolean;
  className?: string;
}

/**
 * AgentIndicator — the smallest agent representation: dot + name.
 *
 * For inline contexts where a full card would be too heavy: nav counters,
 * mission assignee lists, activity attribution.
 */
export function AgentIndicator({
  agent,
  showStatus = false,
  className,
}: AgentIndicatorProps) {
  const visual = agentStatusVisual(agent.status);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StatusDot tone={visual.tone} live={visual.live} size="xs" />
      <span className="font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
        {agent.name}
      </span>
      {showStatus && (
        <span
          className={cn(
            "font-hud text-[9px] uppercase tracking-[0.16em]",
            visual.text,
          )}
        >
          {visual.label}
        </span>
      )}
    </span>
  );
}
