"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PRIORITY_VISUAL } from "@/lib/operations/event-visuals";
import type { Agent, MissionPriority } from "@/lib/types";
import type { NewMissionInput } from "./OperationsProvider";

interface NewMissionFormProps {
  agents: Agent[];
  onCreate: (input: NewMissionInput) => void;
  onCancel?: () => void;
  className?: string;
}

const PRIORITIES: MissionPriority[] = ["low", "normal", "high", "critical"];

/**
 * NewMissionForm — define a mission and its crew.
 *
 * Creates a `queued` mission in local operational state and records a
 * `mission-created` event. Nothing is dispatched: there is no orchestrator to
 * accept it, and the form says so rather than implying work has begun.
 */
export function NewMissionForm({
  agents,
  onCreate,
  onCancel,
  className,
}: NewMissionFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [leadAgentId, setLeadAgentId] = useState(agents[0]?.id ?? "");
  const [support, setSupport] = useState<string[]>([]);
  const [priority, setPriority] = useState<MissionPriority>("normal");

  const canCreate = title.trim().length > 0 && leadAgentId;

  const toggleSupport = (id: string) => {
    setSupport((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      leadAgentId,
      // The lead cannot also be support.
      supportingAgentIds: support.filter((id) => id !== leadAgentId),
      priority,
    });
    setTitle("");
    setDescription("");
    setSupport([]);
    setPriority("normal");
  };

  return (
    <form onSubmit={submit} className={cn("space-y-3", className)}>
      <div>
        <label htmlFor="mission-title" className="t-label">
          MISSION
        </label>
        <input
          id="mission-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Authentication Investigation"
          className="clip-hud-sm mt-1 w-full border border-line bg-surface-inset px-2.5 py-1.5 font-data text-xs text-ink outline-none transition-colors placeholder:text-ink-ghost focus:border-hud-cyan/60"
        />
      </div>

      <div>
        <label htmlFor="mission-desc" className="t-label">
          DESCRIPTION
        </label>
        <textarea
          id="mission-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Investigate authentication failures."
          className="clip-hud-sm mt-1 w-full resize-none border border-line bg-surface-inset px-2.5 py-1.5 font-data text-xs text-ink outline-none transition-colors placeholder:text-ink-ghost focus:border-hud-cyan/60"
        />
      </div>

      <div>
        <label htmlFor="mission-lead" className="t-label">
          LEAD AGENT
        </label>
        <select
          id="mission-lead"
          value={leadAgentId}
          onChange={(e) => setLeadAgentId(e.target.value)}
          className="clip-hud-sm mt-1 w-full border border-line bg-surface-inset px-2.5 py-1.5 font-data text-xs text-ink outline-none transition-colors focus:border-hud-cyan/60"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.role}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="t-label mb-1">SUPPORT</legend>
        <ul className="flex flex-wrap gap-1.5">
          {agents
            .filter((a) => a.id !== leadAgentId)
            .map((a) => {
              const checked = support.includes(a.id);
              return (
                <li key={a.id}>
                  <label
                    className={cn(
                      "clip-hud-sm flex cursor-pointer items-center gap-1.5 border px-2 py-0.5 transition-colors",
                      checked
                        ? "border-hud-cyan/60 bg-hud-cyan/10 text-hud-cyan"
                        : "border-line text-ink-faint hover:border-hud-cyan/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSupport(a.id)}
                      className="sr-only"
                    />
                    <span aria-hidden className="font-data text-[10px]">
                      {checked ? "☑" : "☐"}
                    </span>
                    <span className="font-hud text-[9px] font-semibold uppercase tracking-[0.16em]">
                      {a.name}
                    </span>
                  </label>
                </li>
              );
            })}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="t-label mb-1">PRIORITY</legend>
        <div className="flex gap-1">
          {PRIORITIES.map((p) => {
            const v = PRIORITY_VISUAL[p];
            const checked = priority === p;
            return (
              <label
                key={p}
                className={cn(
                  "clip-hud-sm flex cursor-pointer items-center border px-2 py-0.5 transition-colors",
                  checked
                    ? "border-hud-cyan/60 bg-hud-cyan/10"
                    : "border-line hover:border-hud-cyan/40",
                )}
              >
                <input
                  type="radio"
                  name="mission-priority"
                  value={p}
                  checked={checked}
                  onChange={() => setPriority(p)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "font-hud text-[9px] font-bold uppercase tracking-[0.16em]",
                    checked ? "text-hud-cyan" : v.text,
                  )}
                >
                  {v.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!canCreate}
          className={cn(
            "clip-hud-sm border px-3 py-1.5 font-hud text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
            canCreate
              ? "border-hud-cyan/60 bg-hud-cyan/10 text-hud-cyan hover:bg-hud-cyan/20"
              : "cursor-not-allowed border-line-soft text-ink-ghost",
          )}
        >
          Create mission
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="clip-hud-sm border border-line px-3 py-1.5 font-hud text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink-mute"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="t-timestamp">
        Creates a queued mission in local operational state. No work is
        dispatched — orchestration lands in a later phase.
      </p>
    </form>
  );
}
