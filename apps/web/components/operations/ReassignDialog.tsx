"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import { agentStatusVisual } from "@/lib/agent-status";
import type { Agent, MissionTask } from "@/lib/types";

interface ReassignDialogProps {
  task: MissionTask;
  agents: Agent[];
  onConfirm: (agentId: string) => void;
  onCancel: () => void;
}

/**
 * ReassignDialog — move a task to a different agent.
 *
 * Local only: confirming updates the operational overlay and records an event.
 * No agent is notified and no orchestration runs, because neither exists yet —
 * the dialog says so rather than implying the work moved.
 */
export function ReassignDialog({
  task,
  agents,
  onConfirm,
  onCancel,
}: ReassignDialogProps) {
  const [selected, setSelected] = useState<string | null>(
    task.assignedAgentId,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const candidates = agents.filter((a) => a.id !== task.assignedAgentId);
  const currentName =
    agents.find((a) => a.id === task.assignedAgentId)?.name ?? "UNASSIGNED";

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reassign-title"
        onClick={(e) => e.stopPropagation()}
        className="clip-hud w-full max-w-[420px] border border-hud-cyan/40 bg-surface-raised p-4 shadow-raised"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2
              id="reassign-title"
              className="t-panel-title"
            >
              Reassign Task
            </h2>
            <p className="t-meta mt-1.5 text-ink">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex-none border border-line p-1 text-ink-faint transition-colors hover:text-hud-red"
          >
            <X size={13} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="hud-rule my-3" />

        <div className="mb-3">
          <span className="t-label">CURRENT</span>
          <p className="mt-0.5 font-hud text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            {currentName}
          </p>
        </div>

        <fieldset>
          <legend className="t-label mb-1.5">SELECT AGENT</legend>
          <ul className="max-h-[240px] space-y-0 overflow-y-auto">
            {candidates.map((a) => {
              const visual = agentStatusVisual(a.status);
              const checked = selected === a.id;
              return (
                <li key={a.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 border-l-2 px-2 py-1.5 transition-colors",
                      checked
                        ? "border-l-hud-cyan bg-hud-cyan/[0.07]"
                        : "border-l-transparent hover:bg-hud-cyan/[0.03]",
                    )}
                  >
                    <input
                      type="radio"
                      name="reassign-agent"
                      value={a.id}
                      checked={checked}
                      onChange={() => setSelected(a.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-3 w-3 flex-none place-items-center rounded-full border",
                        checked ? "border-hud-cyan" : "border-line",
                      )}
                    >
                      {checked && (
                        <span className="h-1.5 w-1.5 rounded-full bg-hud-cyan" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "w-[70px] flex-none font-hud text-[11px] font-bold uppercase tracking-[0.14em]",
                        checked ? "text-hud-cyan" : "text-ink",
                      )}
                    >
                      {a.name}
                    </span>
                    <span className="t-label flex-none">{a.role}</span>
                    <span className="ml-auto flex flex-none items-center gap-1.5">
                      <StatusDot tone={visual.tone} live={visual.live} size="xs" />
                      <span
                        className={cn(
                          "font-hud text-[9px] uppercase tracking-[0.14em]",
                          visual.text,
                        )}
                      >
                        {visual.label}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="hud-rule my-3" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || selected === task.assignedAgentId}
            className={cn(
              "clip-hud-sm flex-none border px-3 py-1.5 font-hud text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
              selected && selected !== task.assignedAgentId
                ? "border-hud-cyan/60 bg-hud-cyan/10 text-hud-cyan hover:bg-hud-cyan/20"
                : "cursor-not-allowed border-line-soft text-ink-ghost",
            )}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="clip-hud-sm flex-none border border-line px-3 py-1.5 font-hud text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink-mute"
          >
            Cancel
          </button>
        </div>

        <p className="t-timestamp mt-2.5">
          Updates local operational state and records an event. No agent is
          notified — orchestration lands in a later phase.
        </p>
      </div>
    </div>
  );
}
