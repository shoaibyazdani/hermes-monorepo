"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Panel } from "@/components/hud/Panel";
import { PageHeader } from "@/components/shell/PageHeader";
import { OperationCard } from "@/components/operations/OperationCard";
import { NewMissionForm } from "@/components/operations/NewMissionForm";
import { SimulationControls } from "@/components/operations/SimulationControls";
import { useOperations, type NewMissionInput } from "@/components/operations/OperationsProvider";
import { useAgents } from "@/hooks/useAgents";
import { isMissionOpen } from "@/lib/operations/event-visuals";
import { missionHref } from "@/lib/navigation";

/**
 * Missions — the mission board.
 *
 * Grouped by whether a mission is still in flight, so the board leads with
 * work that can still change. Creating a mission adds it to local operational
 * state as `queued`; nothing is dispatched.
 */
export default function MissionsClient() {
  const router = useRouter();
  const { agents } = useAgents();
  const { missions, tasksForMission, createMission } = useOperations();
  const [creating, setCreating] = useState(false);

  const { open, closed } = useMemo(() => {
    const o = missions.filter((m) => isMissionOpen(m.status));
    const c = missions.filter((m) => !isMissionOpen(m.status));
    return { open: o, closed: c };
  }, [missions]);

  const agentsFor = useCallback(
    (ids: string[]) =>
      ids
        .map((id) => agents.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [agents],
  );

  const handleCreate = useCallback(
    (input: NewMissionInput) => {
      const mission = createMission(input);
      setCreating(false);
      router.push(missionHref(mission.id) as Route);
    },
    [createMission, router],
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Missions"
        subtitle="Objectives · crews · progress"
        meta={[
          { label: "TOTAL", value: String(missions.length).padStart(2, "0") },
          { label: "OPEN", value: String(open.length).padStart(2, "0") },
          { label: "CLOSED", value: String(closed.length).padStart(2, "0") },
        ]}
        actions={
          <>
            <SimulationControls indicatorOnly />
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="clip-hud-sm flex items-center gap-1.5 border border-hud-cyan/50 bg-hud-cyan/10 px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-hud-cyan transition-colors hover:bg-hud-cyan/20"
            >
              {creating ? (
                <X size={11} strokeWidth={2} aria-hidden />
              ) : (
                <Plus size={11} strokeWidth={2} aria-hidden />
              )}
              {creating ? "Cancel" : "New mission"}
            </button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        {creating && (
          <Panel title="New Mission" eyebrow="DEFINE" status="info" stagger={0}>
            <NewMissionForm
              agents={agents}
              onCreate={handleCreate}
              onCancel={() => setCreating(false)}
              className="max-w-[560px]"
            />
          </Panel>
        )}

        <Panel
          title="Open Missions"
          eyebrow={`${open.length}`}
          status={
            open.some((m) => m.status === "blocked") ? "warn" : "active"
          }
          statusLive={open.length > 0}
          stagger={1}
        >
          {open.length === 0 ? (
            <p className="t-meta py-8">
              No open missions. Create one to begin.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
              {open.map((m, i) => (
                <li key={m.id} className="h-full">
                  <OperationCard
                    mission={m}
                    agents={agentsFor(m.assignedAgentIds)}
                    tasks={tasksForMission(m.id)}
                    stagger={2 + i}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {closed.length > 0 && (
          <Panel
            title="Closed"
            eyebrow={`${closed.length}`}
            stagger={6}
            className="flex-1"
          >
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
              {closed.map((m, i) => (
                <li key={m.id} className="h-full">
                  <OperationCard
                    mission={m}
                    agents={agentsFor(m.assignedAgentIds)}
                    tasks={tasksForMission(m.id)}
                    stagger={7 + i}
                    className="opacity-70"
                  />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
