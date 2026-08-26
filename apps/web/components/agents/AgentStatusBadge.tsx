import { cn } from "@/lib/utils";
import { agentStatusVisual } from "@/lib/agent-status";
import { StatusDot } from "@/components/hud/StatusDot";
import type { AgentStatus } from "@/lib/types";

interface AgentStatusBadgeProps {
  status: AgentStatus;
  /** Hide the text label and show only the dot. */
  compact?: boolean;
  className?: string;
}

/**
 * AgentStatusBadge — the canonical way to render an agent's state as a pill.
 *
 * Colour and "is this live" both come from `agentStatusVisual`, so adding a
 * new status means editing one table rather than every call site.
 */
export function AgentStatusBadge({
  status,
  compact = false,
  className,
}: AgentStatusBadgeProps) {
  const visual = agentStatusVisual(status);

  if (compact) {
    return (
      <StatusDot
        tone={visual.tone}
        live={visual.live}
        size="sm"
        label={visual.label}
        className={className}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex flex-none items-center gap-1.5 border px-1.5 py-0.5",
        visual.bg,
        visual.border,
        className,
      )}
    >
      <StatusDot tone={visual.tone} live={visual.live} size="xs" />
      <span
        className={cn(
          "font-hud text-[9px] font-semibold uppercase leading-none tracking-[0.18em]",
          visual.text,
        )}
      >
        {visual.label}
      </span>
    </span>
  );
}
