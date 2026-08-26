import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import type { AgentCapability, AgentTool } from "@/lib/types";

interface AgentCapabilitiesProps {
  capabilities?: AgentCapability[];
  className?: string;
}

/**
 * AgentCapabilities — what the agent is able to do, as compact HUD chips.
 *
 * Distinct from tools: a capability is a competence, a tool is something it
 * can reach for. Chips are deliberately small — this is reference material,
 * not a call to action.
 */
export function AgentCapabilities({
  capabilities,
  className,
}: AgentCapabilitiesProps) {
  if (!capabilities || capabilities.length === 0) {
    return <p className="t-meta py-2">No capabilities declared.</p>;
  }

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {capabilities.map((c) => (
        <li
          key={c.id}
          className="clip-hud-sm border border-line-soft bg-surface-inset px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-mute"
        >
          {c.label}
        </li>
      ))}
    </ul>
  );
}

interface AgentToolsProps {
  tools?: AgentTool[];
  className?: string;
}

/**
 * AgentTools — the agent's permitted toolset.
 *
 * `ENABLED` describes what the agent is allowed to reach for, not what is
 * running right now. Nothing here executes: the tool runtime is a later phase.
 * State is carried by both a dot and a word so it never depends on colour.
 */
export function AgentTools({ tools, className }: AgentToolsProps) {
  if (!tools || tools.length === 0) {
    return <p className="t-meta py-2">No tools registered.</p>;
  }

  return (
    <ul className={cn("space-y-0", className)}>
      {tools.map((t) => (
        <li
          key={t.id}
          className="flex items-baseline gap-3 border-b border-line-soft py-1.5 last:border-b-0"
        >
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "font-hud text-[10px] font-semibold uppercase tracking-[0.16em]",
                t.enabled ? "text-ink" : "text-ink-ghost",
              )}
            >
              {t.label}
            </span>
            {t.description && (
              <span className="t-timestamp ml-2">{t.description}</span>
            )}
          </span>

          <span className="flex flex-none items-center gap-1.5">
            <StatusDot
              tone={t.enabled ? "active" : "neutral"}
              size="xs"
              className={t.enabled ? undefined : "opacity-50"}
            />
            <span
              className={cn(
                "font-hud text-[9px] font-semibold uppercase tracking-[0.16em]",
                t.enabled ? "text-hud-green" : "text-ink-ghost",
              )}
            >
              {t.enabled ? "Enabled" : "Disabled"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
