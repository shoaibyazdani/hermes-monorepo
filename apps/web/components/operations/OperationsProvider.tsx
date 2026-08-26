"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getOperationsRuntime } from "@/lib/operations/mock-operations";
import { isMissionOpen } from "@/lib/operations/event-visuals";
import { useConversations } from "@/components/chat/ConversationProvider";
import type { RuntimeEvent } from "@/lib/runtime/events";
import type {
  AgentStatus,
  AttentionItem,
  Mission,
  MissionPriority,
  MissionTask,
  OperationEvent,
} from "@/lib/types";

/** Local edits layered over the runtime snapshot. */
interface LocalOverlay {
  /** Missions created in this session. */
  createdMissions: Mission[];
  /** Tasks belonging to created missions. */
  createdTasks: MissionTask[];
  /** Task id → agent id, from operator reassignment. */
  reassignments: Record<string, string>;
  /** Events emitted by operator actions. */
  localEvents: OperationEvent[];
  /** Attention items the operator dismissed. */
  dismissedAttention: string[];
  /** Agent status driven by live runtime events, keyed by agent id. */
  liveAgentStatus: Record<string, AgentStatus>;
  /** Events emitted by real runtime activity. */
  runtimeEvents: OperationEvent[];
}

const EMPTY_OVERLAY: LocalOverlay = {
  createdMissions: [],
  createdTasks: [],
  reassignments: {},
  localEvents: [],
  dismissedAttention: [],
  liveAgentStatus: {},
  runtimeEvents: [],
};

export interface NewMissionInput {
  title: string;
  description: string;
  leadAgentId: string;
  supportingAgentIds: string[];
  priority: MissionPriority;
}

interface OperationsContextValue {
  missions: Mission[];
  tasks: MissionTask[];
  events: OperationEvent[];
  attentionItems: AttentionItem[];
  /** False while the data source is simulated. True with a real runtime. */
  live: boolean;
  /** Agent status overrides from live runs. Empty in simulation. */
  liveAgentStatus: Record<string, AgentStatus>;

  /* Lookups */
  getMission: (id: string) => Mission | undefined;
  tasksForMission: (missionId: string) => MissionTask[];
  eventsForMission: (missionId: string) => OperationEvent[];
  eventsForAgent: (agentId: string) => OperationEvent[];
  missionForAgent: (agentId: string) => Mission | undefined;
  taskForAgent: (agentId: string) => MissionTask | undefined;
  openMissions: Mission[];

  /* Simulation control */
  step: number;
  totalSteps: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  stepForward: () => void;

  /* Operator actions — local state only */
  createMission: (input: NewMissionInput) => Mission;
  reassignTask: (taskId: string, agentId: string) => void;
  dismissAttention: (id: string) => void;
}

const OperationsContext = createContext<OperationsContextValue | null>(null);

const PLAY_INTERVAL_MS = 2600;

/**
 * OperationsProvider — the single source of truth for operational state.
 *
 * Reads a snapshot from the `OperationsRuntime` seam and layers local operator
 * edits (created missions, reassignments, dismissals) on top. No component
 * holds its own copy of missions, tasks, events or attention.
 *
 * When a live runtime replaces the mock one, the shape it returns is the same,
 * so the provider and every consumer stay unchanged.
 */
export function OperationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtime = useMemo(() => getOperationsRuntime(), []);
  // The conversation layer owns the runtime connection; operations subscribes
  // to its events rather than opening a second one.
  const { runtimeStatus, subscribeRuntime } = useConversations();
  const [step, setStep] = useState(runtime.initialStep);
  const [playing, setPlaying] = useState(false);
  const [overlay, setOverlay] = useState<LocalOverlay>(EMPTY_OVERLAY);

  // Advance the scripted scenario while playing; stop at the end rather than
  // looping, so "completed" is a state the operator can actually observe.
  useEffect(() => {
    if (!playing) return;
    if (step >= runtime.totalSteps) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => s + 1), PLAY_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [playing, step, runtime.totalSteps]);

  /**
   * Fold live runtime events into operational state.
   *
   * Agent status is DERIVED from run events rather than stored separately:
   * thinking → THINKING, tool running → WORKING, run over → back to its
   * baseline. A second status source would drift from the runs producing it.
   */
  useEffect(() => {
    return subscribeRuntime((event: RuntimeEvent) => {
      setOverlay((prev) => {
        const status = { ...prev.liveAgentStatus };
        let opEvent: OperationEvent | null = null;

        const base = {
          id: event.id,
          timestamp: event.timestamp,
          agentId: event.agentId,
          missionId: event.missionId,
        };

        switch (event.type) {
          case "run.started":
            status[event.agentId] = "thinking";
            opEvent = {
              ...base,
              type: "system",
              severity: "info",
              message: `Run started · ${event.payload.provider}/${event.payload.model}`,
            };
            break;
          case "agent.thinking":
            status[event.agentId] = "thinking";
            break;
          case "message.started":
            status[event.agentId] = "working";
            break;
          case "tool.started":
            status[event.agentId] = "working";
            opEvent = {
              ...base,
              type: "tool-started",
              severity: "info",
              subject: event.payload.toolName,
              message: `Started ${event.payload.toolName}`,
            };
            break;
          case "tool.completed":
            opEvent = {
              ...base,
              type: "tool-completed",
              severity: event.payload.ok ? "success" : "warn",
              subject: event.payload.toolId,
              message: event.payload.ok
                ? `Tool completed${event.payload.summary ? ` · ${event.payload.summary}` : ""}`
                : `Tool failed${event.payload.summary ? ` · ${event.payload.summary}` : ""}`,
            };
            break;
          case "agent.error":
            status[event.agentId] = "error";
            opEvent = {
              ...base,
              type: "agent-error",
              severity: "error",
              message: event.payload.message,
            };
            break;
          case "run.completed":
            // Clear the override so the agent returns to its roster state
            // rather than being pinned to a finished run.
            delete status[event.agentId];
            opEvent = {
              ...base,
              type:
                event.payload.status === "completed"
                  ? "agent-completed"
                  : "system",
              severity:
                event.payload.status === "completed"
                  ? "success"
                  : event.payload.status === "failed"
                    ? "error"
                    : "info",
              message: `Run ${event.payload.status} · ${(event.payload.durationMs / 1000).toFixed(1)}s`,
            };
            break;
          default:
            break;
        }

        return {
          ...prev,
          liveAgentStatus: status,
          runtimeEvents: opEvent
            ? [opEvent, ...prev.runtimeEvents].slice(0, 200)
            : prev.runtimeEvents,
        };
      });
    });
  }, [subscribeRuntime]);

  const snapshot = useMemo(() => runtime.snapshotAt(step), [runtime, step]);

  const missions = useMemo(
    () => [...overlay.createdMissions, ...snapshot.missions],
    [overlay.createdMissions, snapshot.missions],
  );

  const tasks = useMemo(() => {
    const all = [...snapshot.tasks, ...overlay.createdTasks];
    // Apply operator reassignments over whatever the runtime reported.
    return all.map((t) =>
      overlay.reassignments[t.id]
        ? { ...t, assignedAgentId: overlay.reassignments[t.id] }
        : t,
    );
  }, [snapshot.tasks, overlay.createdTasks, overlay.reassignments]);

  const events = useMemo(
    () =>
      [
        ...snapshot.events,
        ...overlay.localEvents,
        ...overlay.runtimeEvents,
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [snapshot.events, overlay.localEvents, overlay.runtimeEvents],
  );

  /**
   * Attention items, derived from operational state rather than stored.
   *
   * Deriving means the list cannot drift from the missions and tasks it
   * describes — there is one source of truth, not two.
   */
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    for (const m of missions) {
      if (m.status === "blocked") {
        items.push({
          id: `att-mission-${m.id}`,
          agentId: m.leadAgentId ?? null,
          severity: m.priority === "critical" ? "critical" : "warn",
          title: `${m.title} is blocked`,
          action: m.blockedReason ?? "Mission cannot continue.",
          detail: `${m.code} · ${m.progress}% complete`,
          missionId: m.id,
          raisedAt: m.lastActivityAt ?? m.startedAt,
        });
      }
    }

    for (const t of tasks) {
      if (t.status !== "blocked") continue;
      const mission = missions.find((m) => m.id === t.missionId);
      items.push({
        id: `att-task-${t.id}`,
        agentId: t.assignedAgentId,
        severity: "warn",
        title: `${t.assignedAgentId?.toUpperCase() ?? "TASK"} is waiting`,
        action: t.blockedReason ?? `"${t.title}" cannot start.`,
        detail: mission ? `${mission.code} · ${mission.title}` : undefined,
        missionId: t.missionId,
        raisedAt: mission?.lastActivityAt ?? mission?.startedAt ?? "",
      });
    }

    return items.filter((i) => !overlay.dismissedAttention.includes(i.id));
  }, [missions, tasks, overlay.dismissedAttention]);

  /* ── Lookups ───────────────────────────────────────────────────────────── */

  const getMission = useCallback(
    (id: string) => missions.find((m) => m.id === id),
    [missions],
  );

  const tasksForMission = useCallback(
    (missionId: string) => tasks.filter((t) => t.missionId === missionId),
    [tasks],
  );

  const eventsForMission = useCallback(
    (missionId: string) => events.filter((e) => e.missionId === missionId),
    [events],
  );

  const eventsForAgent = useCallback(
    (agentId: string) =>
      events.filter(
        (e) => e.agentId === agentId || e.targetAgentId === agentId,
      ),
    [events],
  );

  const openMissions = useMemo(
    () => missions.filter((m) => isMissionOpen(m.status)),
    [missions],
  );

  /** The open mission an agent is currently assigned to. */
  const missionForAgent = useCallback(
    (agentId: string) =>
      openMissions.find(
        (m) =>
          m.assignedAgentIds.includes(agentId) || m.leadAgentId === agentId,
      ),
    [openMissions],
  );

  /** The agent's in-flight task; falls back to the most recent blocked one. */
  const taskForAgent = useCallback(
    (agentId: string) =>
      tasks.find((t) => t.assignedAgentId === agentId && t.status === "active") ??
      tasks.find(
        (t) => t.assignedAgentId === agentId && t.status === "blocked",
      ),
    [tasks],
  );

  /* ── Simulation control ────────────────────────────────────────────────── */

  const play = useCallback(() => {
    // Restarting from the end replays rather than sitting on a finished run.
    setStep((s) => (s >= runtime.totalSteps ? 0 : s));
    setPlaying(true);
  }, [runtime.totalSteps]);

  const pause = useCallback(() => setPlaying(false), []);

  const reset = useCallback(() => {
    setPlaying(false);
    setStep(runtime.initialStep);
    setOverlay(EMPTY_OVERLAY);
  }, [runtime.initialStep]);

  const stepForward = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.min(s + 1, runtime.totalSteps));
  }, [runtime.totalSteps]);

  /* ── Operator actions ──────────────────────────────────────────────────── */

  /**
   * Create a mission locally.
   *
   * Nothing is dispatched: no orchestrator exists to accept it. The mission is
   * added as `queued` and an event is recorded so the timeline reflects the
   * operator's action honestly.
   */
  const createMission = useCallback(
    (input: NewMissionInput): Mission => {
      const now = new Date().toISOString();
      const seq = overlay.createdMissions.length + 1;
      const id = `m-local-${seq}`;
      const mission: Mission = {
        id,
        code: `OPS-${9000 + seq}`,
        title: input.title,
        description: input.description || undefined,
        status: "queued",
        priority: input.priority,
        assignedAgentIds: [input.leadAgentId, ...input.supportingAgentIds],
        leadAgentId: input.leadAgentId,
        supportingAgentIds: input.supportingAgentIds,
        progress: 0,
        phase: "QUEUED",
        createdAt: now,
        startedAt: now,
        lastActivityAt: now,
      };

      setOverlay((prev) => ({
        ...prev,
        createdMissions: [mission, ...prev.createdMissions],
        localEvents: [
          {
            id: `ev-local-${seq}`,
            timestamp: now,
            type: "mission-created",
            severity: "info",
            agentId: "hermes",
            targetAgentId: input.leadAgentId,
            missionId: id,
            message: `${input.title} created and queued`,
          },
          ...prev.localEvents,
        ],
      }));

      return mission;
    },
    [overlay.createdMissions.length],
  );

  /**
   * Reassign a task to another agent.
   *
   * Local state plus an event. No orchestration is triggered — the agent is
   * not told, because there is nothing to tell.
   */
  const reassignTask = useCallback(
    (taskId: string, agentId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const now = new Date().toISOString();
      setOverlay((prev) => ({
        ...prev,
        reassignments: { ...prev.reassignments, [taskId]: agentId },
        localEvents: [
          {
            id: `ev-reassign-${taskId}-${Object.keys(prev.reassignments).length}`,
            timestamp: now,
            type: "task-assigned",
            severity: "info",
            agentId: "hermes",
            targetAgentId: agentId,
            missionId: task?.missionId,
            taskId,
            message: `Reassigned "${task?.title ?? taskId}" to ${agentId.toUpperCase()}`,
          },
          ...prev.localEvents,
        ],
      }));
    },
    [tasks],
  );

  const dismissAttention = useCallback((id: string) => {
    setOverlay((prev) =>
      prev.dismissedAttention.includes(id)
        ? prev
        : { ...prev, dismissedAttention: [...prev.dismissedAttention, id] },
    );
  }, []);

  const value = useMemo<OperationsContextValue>(
    () => ({
      missions,
      tasks,
      events,
      attentionItems,
      // A configured provider makes the system genuinely live; otherwise the
      // mock runtime decides, which today means simulation.
      live: runtimeStatus.live || runtime.live,
      liveAgentStatus: overlay.liveAgentStatus,
      getMission,
      tasksForMission,
      eventsForMission,
      eventsForAgent,
      missionForAgent,
      taskForAgent,
      openMissions,
      step,
      totalSteps: runtime.totalSteps,
      playing,
      play,
      pause,
      reset,
      stepForward,
      createMission,
      reassignTask,
      dismissAttention,
    }),
    [
      missions,
      tasks,
      events,
      attentionItems,
      runtimeStatus.live,
      runtime.live,
      runtime.totalSteps,
      overlay.liveAgentStatus,
      getMission,
      tasksForMission,
      eventsForMission,
      eventsForAgent,
      missionForAgent,
      taskForAgent,
      openMissions,
      step,
      playing,
      play,
      pause,
      reset,
      stepForward,
      createMission,
      reassignTask,
      dismissAttention,
    ],
  );

  return (
    <OperationsContext.Provider value={value}>
      {children}
    </OperationsContext.Provider>
  );
}

export function useOperations(): OperationsContextValue {
  const ctx = useContext(OperationsContext);
  if (!ctx) {
    throw new Error("useOperations must be used within OperationsProvider");
  }
  return ctx;
}
