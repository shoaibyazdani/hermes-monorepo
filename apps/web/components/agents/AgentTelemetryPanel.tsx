import { cn } from "@/lib/utils";
import { DataRow } from "@/components/hud/DataRow";
import type { AgentConfig, AgentTelemetry } from "@/lib/types";

interface AgentTelemetryPanelProps {
  telemetry?: AgentTelemetry;
  className?: string;
}

/**
 * AgentTelemetryPanel — per-agent counters.
 *
 * Simulated, and labelled as such by the caller. Failures take on colour only
 * when non-zero, so a clean agent reads as quiet rather than green-flooded.
 */
export function AgentTelemetryPanel({
  telemetry,
  className,
}: AgentTelemetryPanelProps) {
  if (!telemetry) {
    return <p className="t-meta py-2">No telemetry reported.</p>;
  }

  return (
    <div className={cn("space-y-0", className)}>
      <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
        <Stat label="TASKS TODAY" value={telemetry.tasksToday} />
        <Stat label="COMPLETED" value={telemetry.completed} />
        <Stat
          label="FAILED"
          value={telemetry.failed}
          alert={telemetry.failed > 0}
        />
        <Stat label="RUNNING" value={telemetry.running} />
      </div>

      <div className="hud-rule my-3" />

      <DataRow
        label="Avg response"
        value={`${telemetry.avgResponseSeconds.toFixed(1)}s`}
        divider
      />
      <DataRow label="Tools used" value={`${telemetry.toolsUsed}`} divider />
      <DataRow label="Missions" value={`${telemetry.missions}`} />
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="t-label leading-tight">{label}</div>
      <div
        className={cn(
          "mt-1 font-data text-base font-bold tabular-nums",
          alert ? "text-hud-red" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

interface AgentConfigPanelProps {
  config?: AgentConfig;
  className?: string;
}

const AUTONOMY_LABEL: Record<AgentConfig["autonomy"], string> = {
  supervised: "SUPERVISED",
  "semi-autonomous": "SEMI-AUTONOMOUS",
  autonomous: "AUTONOMOUS",
};

/**
 * AgentConfigPanel — model and runtime settings, read-only.
 *
 * Editing lands with the agent runtime; showing values that cannot be changed
 * is honest, offering controls that do nothing would not be.
 */
export function AgentConfigPanel({ config, className }: AgentConfigPanelProps) {
  if (!config) {
    return <p className="t-meta py-2">No configuration available.</p>;
  }

  return (
    <div className={cn("space-y-0", className)}>
      <DataRow label="Model" value={config.model} tone="accent" divider />
      <DataRow
        label="Temperature"
        value={config.temperature.toFixed(1)}
        divider
      />
      <DataRow label="Max context" value={config.maxContext} divider />
      <DataRow
        label="Autonomy"
        value={AUTONOMY_LABEL[config.autonomy]}
        tone={config.autonomy === "supervised" ? "muted" : "warn"}
      />
    </div>
  );
}

interface AgentMemoryPreviewProps {
  memory?: string[];
  onViewMemory?: () => void;
  className?: string;
}

/**
 * AgentMemoryPreview — a glimpse of the context the agent is holding.
 *
 * Static lines from the fixture set; there is no memory store behind this.
 * "View memory" is intentionally inert until the Memory route exists.
 */
export function AgentMemoryPreview({
  memory,
  onViewMemory,
  className,
}: AgentMemoryPreviewProps) {
  if (!memory || memory.length === 0) {
    return <p className="t-meta py-2">No retained context.</p>;
  }

  return (
    <div className={className}>
      <p className="t-label mb-2">RECENT CONTEXT</p>
      <ul className="space-y-1.5">
        {memory.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="mt-[3px] flex-none text-hud-cyan/60">
              •
            </span>
            <span className="t-meta text-ink-mute">{line}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onViewMemory}
        disabled={!onViewMemory}
        className="clip-hud-sm mt-3 border border-line px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint transition-colors enabled:hover:border-hud-cyan/40 enabled:hover:text-hud-cyan disabled:cursor-not-allowed"
        title={
          onViewMemory
            ? "Open the memory store"
            : "The Memory route lands in a later phase"
        }
      >
        View memory →
      </button>
    </div>
  );
}
