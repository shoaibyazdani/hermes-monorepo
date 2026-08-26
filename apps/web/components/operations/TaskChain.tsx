"use client";

import { cn } from "@/lib/utils";
import { taskStatusVisual } from "@/lib/operations/event-visuals";
import type { MissionTask } from "@/lib/types";

interface TaskChainProps {
  tasks: MissionTask[];
  /** Resolves an agent id to a display name. */
  agentName?: (id: string) => string | undefined;
  /** Opens the reassignment surface for a task. */
  onReassign?: (task: MissionTask) => void;
  selectedTaskId?: string | null;
  className?: string;
}

/**
 * TaskChain — a mission's tasks as a dependency chain.
 *
 * Rendered as a vertical sequence with connectors, because mission tasks are
 * almost always a pipeline: showing the order is more useful than showing a
 * checklist. Each task carries its glyph, status word and assignee, so state
 * is readable without relying on colour.
 *
 * A blocked task names what it is waiting for — the dependency plus the agent
 * holding it — which is the question an operator actually has.
 */
export function TaskChain({
  tasks,
  agentName,
  onReassign,
  selectedTaskId,
  className,
}: TaskChainProps) {
  if (tasks.length === 0) {
    return <p className="t-meta py-4">No tasks defined for this mission.</p>;
  }

  const name = (id: string) => agentName?.(id) ?? id.toUpperCase();
  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <ol className={cn("space-y-0", className)}>
      {tasks.map((task, i) => {
        const visual = taskStatusVisual(task.status);
        const last = i === tasks.length - 1;
        const selected = task.id === selectedTaskId;

        // What this task is waiting on, named rather than implied.
        const blockers = task.dependencies
          .map((d) => byId.get(d))
          .filter(
            (d): d is MissionTask => Boolean(d) && d!.status !== "completed",
          );

        return (
          <li key={task.id} className="relative">
            <div className="flex gap-3">
              {/* Chain rail */}
              <div className="flex flex-none flex-col items-center">
                <span
                  aria-hidden
                  className={cn(
                    "grid h-[18px] w-[18px] place-items-center rounded-full border bg-surface-base font-data text-[10px] leading-none",
                    visual.text,
                    task.status === "active"
                      ? "border-hud-green/60"
                      : task.status === "blocked"
                        ? "border-hud-amber/60"
                        : task.status === "completed"
                          ? "border-hud-green/40"
                          : "border-line",
                  )}
                >
                  {visual.glyph}
                </span>
                {!last && (
                  <span
                    aria-hidden
                    className={cn(
                      "w-px flex-1",
                      task.status === "completed"
                        ? "bg-hud-green/30"
                        : "bg-line-soft",
                    )}
                  />
                )}
              </div>

              <div
                className={cn(
                  "min-w-0 flex-1",
                  last ? "pb-1" : "pb-4",
                  selected && "bg-hud-cyan/[0.05]",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "min-w-0 font-hud text-[11px] font-semibold uppercase tracking-[0.12em]",
                      task.status === "completed"
                        ? "text-ink-mute"
                        : task.status === "pending"
                          ? "text-ink-faint"
                          : "text-ink",
                    )}
                  >
                    {task.title}
                  </span>
                  <span
                    className={cn(
                      "flex-none font-hud text-[9px] font-bold uppercase tracking-[0.16em]",
                      visual.text,
                    )}
                  >
                    {visual.label}
                  </span>
                  {task.assignedAgentId && (
                    <span className="flex-none font-hud text-[9px] uppercase tracking-[0.14em] text-hud-cyan/70">
                      {name(task.assignedAgentId)}
                    </span>
                  )}
                </div>

                {task.currentStep && task.status === "active" && (
                  <p className="t-timestamp mt-1">
                    STEP · {task.currentStep}
                  </p>
                )}

                {task.status === "blocked" && (
                  <div className="mt-1.5 border-l-2 border-hud-amber/50 pl-2">
                    <p className="t-meta text-hud-amber">
                      {task.blockedReason ?? "Blocked."}
                    </p>
                    {blockers.length > 0 && (
                      <p className="t-timestamp mt-0.5">
                        WAITING FOR:{" "}
                        {blockers
                          .map(
                            (b) =>
                              `${b.assignedAgentId ? `${name(b.assignedAgentId)} → ` : ""}${b.title}`,
                          )
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}

                {onReassign && task.status !== "completed" && (
                  <button
                    type="button"
                    onClick={() => onReassign(task)}
                    className="clip-hud-sm mt-2 border border-line px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan"
                  >
                    Reassign
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
