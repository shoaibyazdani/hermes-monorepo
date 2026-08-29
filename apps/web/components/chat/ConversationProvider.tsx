"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CONVERSATION_STORAGE_KEY,
  createConversation,
  createMessage,
  loadConversations,
  saveConversations,
} from "@/lib/chat/conversation-store";
import { getAgentRuntime } from "@/lib/chat/agent-runtime";
import { parseCommand, type ParsableAgent } from "@/lib/chat/command-parser";
import {
  executeAgentRun,
  fetchRuntimeStatus,
  type ExecuteHandle,
  type PublicRuntimeStatus,
  type StreamEvent,
} from "@/lib/runtime/runtime-client";
import type { RuntimeEvent } from "@/lib/runtime/events";
import { isOrchestrationEvent } from "@/lib/orchestration/events";
import { simulationTranscriptAt } from "@/lib/orchestration/simulation-view";
import { useVoiceSpeaker } from "@/hooks/useVoiceSpeaker";
import {
  VOICE_TRANSCRIPT_EVENT,
  type VoiceTranscriptDetail,
} from "@/components/voice/VoiceProvider";
import { SIM_CONVERSATION_IDS } from "@/lib/orchestration/simulation";
import { SIMULATION_INITIAL_STEP } from "@/lib/operations/mock-operations";
import type {
  ChatDelegation,
  ChatMessage,
  ChatMessageStatus,
  ChatToolCall,
  Conversation,
} from "@/lib/types";

/** Outcome of routing one command, for the caller to surface in the UI. */
export interface RouteResult {
  agentId: string | null;
  conversationId: string | null;
  message: string;
  /** True when the command switched the active target. */
  switchedTarget: boolean;
  /** Set when an address was attempted but matched no agent. */
  unresolvedMention: string | null;
  /** Reason reported by the runtime adapter, e.g. "LOCAL COMMAND QUEUED". */
  runtimeReason: string | null;
}

interface ConversationContextValue {
  conversations: Conversation[];
  /** True until the store has been read (storage is client-only). */
  hydrated: boolean;
  conversationsFor: (agentId: string) => Conversation[];
  getConversation: (id: string) => Conversation | undefined;
  /** Active conversation per agent, so switching agents restores position. */
  activeConversationId: (agentId: string) => string | null;
  /**
   * Resolve the active conversation AND pin it, so later re-orderings cannot
   * silently change which conversation a screen is showing.
   */
  ensureActive: (agentId: string) => string | null;
  setActiveConversation: (agentId: string, conversationId: string) => void;
  startConversation: (agentId: string, title?: string) => Conversation;
  renameConversation: (conversationId: string, title: string) => void;
  deleteConversation: (conversationId: string) => void;
  /**
   * Append an operator turn to a specific conversation and hand it to the
   * runtime adapter. Never fabricates an agent reply.
   */
  sendMessage: (
    agentId: string,
    conversationId: string,
    body: string,
  ) => Promise<RouteResult>;
  /**
   * The full command pipeline: parse → resolve → target → conversation →
   * message → runtime. Used by the global voice bar for both typed input and
   * (later) voice transcripts.
   */
  routeCommand: (
    input: string,
    agents: ParsableAgent[],
    currentTargetId: string | null,
  ) => Promise<RouteResult>;
  resetStore: () => void;

  /* ── Live runtime ────────────────────────────────────────────────────── */
  /** Provider status. `live: false` means simulation. */
  runtimeStatus: PublicRuntimeStatus;
  /** Conversation ids with a run in flight. */
  streamingConversations: string[];
  /** Stop an in-flight run; its message becomes `cancelled`, never `complete`. */
  cancelRun: (conversationId: string) => void;
  /** Re-run a failed assistant turn without duplicating the user's message. */
  retryMessage: (conversationId: string, messageId: string) => void;
  /** Subscribe to raw runtime events — used by OperationsProvider. */
  subscribeRuntime: (fn: (event: StreamEvent) => void) => () => void;
  /** Simulation playback position, shared with the operational views. */
  simulationStep: number;
  setSimulationStep: React.Dispatch<React.SetStateAction<number>>;
  /**
   * Route a request through Hermes rather than to one agent.
   *
   * Hermes plans, delegates, collects and synthesises; delegated turns land in
   * each agent's OWN conversation, and only the summary appears here.
   */
  orchestrate: (conversationId: string, body: string) => void;

  /* ── Live-talk speaker ───────────────────────────────────────────────── */
  /** When enabled, the agent's text is spoken aloud as it streams. */
  speakerEnabled: boolean;
  /** Toggle the speaker on/off. Disabled = silent typing only. */
  toggleSpeaker: () => void;
  /** Stop the currently-playing sentence (does not pause text streaming). */
  stopSpeaker: () => void;
  /** Id of the chunk currently being played, for UI indicators. */
  speakerNowPlayingId: string | null;
  /** How many sentences are queued or loading. */
  speakerQueueLength: number;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

/**
 * ConversationProvider — one conversation store for the whole application.
 *
 * Mounted above the router so every route (Command Center, agent workspaces,
 * Chats) reads and writes the same records. There is deliberately no per-page
 * chat state.
 *
 * Hydration: the store lives in localStorage, which the server cannot read, so
 * the first render is empty and the real set loads in an effect. Consumers use
 * `hydrated` to avoid rendering an "empty" state before that lands.
 */
export function ConversationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeByAgent, setActiveByAgent] = useState<Record<string, string>>({});

  /**
   * Playback position of the deterministic simulation.
   *
   * Owned here rather than in OperationsProvider because this provider is the
   * parent: the simulated conversation and the simulated operational state
   * must be projections of one step, not two counters that can drift.
   */
  const [simulationStep, setSimulationStep] = useState(SIMULATION_INITIAL_STEP);

  /**
   * Live-talk speaker. When enabled, every complete sentence in the streaming
   * agent response is POSTed to /api/tts-stream and queued for browser
   * playback. Disabled by default — the user flips it on via the chat header
   * toggle.
   *
   * Speaker module is a singleton (the queue lives at module scope inside
   * useVoiceSpeaker) so multiple components can enqueue safely and the queue
   * survives React re-renders.
   */
  const speaker = useVoiceSpeaker();
  // Track which conversationId each sentence belongs to so we can clear the
  // queue when the user starts a new turn / interrupts with mic.
  const speakerConvoRef = useRef<string | null>(null);

  // Guards the persist effect so hydration itself does not trigger a write.
  const skipPersist = useRef(true);

  const [runtimeStatus, setRuntimeStatus] = useState<PublicRuntimeStatus>({
    live: false,
    provider: "none",
    model: "simulation",
    supportsStreaming: false,
  });
  // Conversation id → in-flight run, so STOP can reach the right one and two
  // agents can stream at once without interfering.
  const activeRuns = useRef(new Map<string, ExecuteHandle>());
  const [streamingConversations, setStreamingConversations] = useState<string[]>([]);
  // Raw runtime events, republished for OperationsProvider.
  const runtimeSubscribers = useRef(new Set<(e: StreamEvent) => void>());

  useEffect(() => {
    setConversations(loadConversations());
    setHydrated(true);
  }, []);

  // Ask the server which provider is configured. This is what flips the UI
  // between SIMULATION and LIVE — derived, never hand-set.
  useEffect(() => {
    void fetchRuntimeStatus().then(setRuntimeStatus);
  }, []);

  // Abort any in-flight run when the provider unmounts, so a navigation away
  // does not leave the server generating into nothing.
  useEffect(() => {
    const runs = activeRuns.current;
    return () => {
      runs.forEach((h) => h.cancel());
      runs.clear();
    };
  }, []);

  useEffect(() => {
    if (skipPersist.current) {
      // Skip only the initial hydration commit.
      if (hydrated) skipPersist.current = false;
      return;
    }
    saveConversations(conversations);
  }, [conversations, hydrated]);

  /**
   * Multi-tab sync: adopt another tab's write.
   *
   * Deliberately a straight reload of the store rather than a merge — last
   * write wins, which is correct for a single operator on one machine and
   * avoids inventing conflict resolution the data does not need.
   */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CONVERSATION_STORAGE_KEY) return;
      skipPersist.current = true;
      setConversations(loadConversations());
      // Re-arm persistence after the adopted state settles.
      queueMicrotask(() => {
        skipPersist.current = false;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /**
   * The simulated orchestration conversation, merged in read-only.
   *
   * Derived from the simulation step rather than persisted: nothing is written
   * to storage, so a reset genuinely returns to the initial state and no stale
   * transcript can survive a replay. Only present when no provider is
   * configured — with a live runtime this is null, so a simulated answer can
   * never appear alongside real ones.
   */
  const simulationConversation = useMemo<Conversation | null>(() => {
    if (runtimeStatus.live) return null;
    const messages = simulationTranscriptAt(simulationStep);
    if (!messages.length) return null;
    return {
      id: SIM_CONVERSATION_IDS.hermes,
      agentId: "hermes",
      title: "Authentication Investigation (simulated)",
      createdAt: messages[0].createdAt,
      updatedAt: messages[messages.length - 1].createdAt,
      messages,
    };
  }, [runtimeStatus.live, simulationStep]);

  const allConversations = useMemo(
    () =>
      simulationConversation
        ? [simulationConversation, ...conversations]
        : conversations,
    [simulationConversation, conversations],
  );

  const conversationsFor = useCallback(
    (agentId: string) =>
      allConversations
        .filter((c) => c.agentId === agentId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [allConversations],
  );

  const getConversation = useCallback(
    (id: string) => allConversations.find((c) => c.id === id),
    [allConversations],
  );

  const activeConversationId = useCallback(
    (agentId: string) => {
      const explicit = activeByAgent[agentId];
      if (explicit && allConversations.some((c) => c.id === explicit)) {
        return explicit;
      }
      // Fall back to the agent's most recent conversation.
      return conversationsFor(agentId)[0]?.id ?? null;
    },
    [activeByAgent, allConversations, conversationsFor],
  );

  /**
   * Pin the resolved conversation the first time an agent is viewed.
   *
   * Without this the selection is implicit — recomputed from "most recently
   * updated" on every render — so a send that moves a conversation in that
   * ordering silently switches which conversation is displayed. Recording the
   * choice makes the active conversation stable for the session.
   */
  const ensureActive = useCallback(
    (agentId: string): string | null => {
      const resolved = activeConversationId(agentId);
      if (resolved && activeByAgent[agentId] !== resolved) {
        setActiveByAgent((prev) =>
          prev[agentId] === resolved ? prev : { ...prev, [agentId]: resolved },
        );
      }
      return resolved;
    },
    [activeByAgent, activeConversationId],
  );

  const setActiveConversation = useCallback(
    (agentId: string, conversationId: string) => {
      setActiveByAgent((prev) => ({ ...prev, [agentId]: conversationId }));
    },
    [],
  );

  const startConversation = useCallback(
    (agentId: string, title = "New conversation") => {
      const conv = createConversation(agentId, title);
      setConversations((prev) => [conv, ...prev]);
      setActiveByAgent((prev) => ({ ...prev, [agentId]: conv.id }));
      return conv;
    },
    [],
  );

  const renameConversation = useCallback(
    (conversationId: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, title: clean, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
    },
    [],
  );

  const deleteConversation = useCallback((conversationId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
  }, []);

  /** Apply a status change to one message once the runtime has responded. */
  const markMessage = useCallback(
    (conversationId: string, messageId: string, status: ChatMessageStatus) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, status } : m,
                ),
              }
            : c,
        ),
      );
    },
    [],
  );

  /**
   * Patch one message in place.
   *
   * Also advances the conversation's `updatedAt`: an assistant turn is real
   * activity, and without this a conversation whose newest message is a reply
   * would sort as stale and lose its place in the recency ordering.
   */
  const patchMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      patch: Partial<ChatMessage>,
    ) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, ...patch } : m,
                ),
              }
            : c,
        ),
      );
    },
    [],
  );

  /**
   * Fold an orchestration event into the Hermes message's delegation cards.
   *
   * The cards are the operator's view of what was delegated and how it went;
   * each links to the agent's own conversation rather than duplicating its
   * transcript here.
   */
  const applyOrchestrationEvent = useCallback(
    (
      conversationId: string,
      messageId: string,
      event: { type: string; payload: unknown; orchestrationId?: string },
      cards: Map<string, ChatDelegation>,
    ) => {
      const p = event.payload as Record<string, never>;
      const stepId = (p as { stepId?: string }).stepId;

      switch (event.type) {
        case "plan.created": {
          const plan = (p as unknown as { plan: { steps: Array<{ id: string; agentId: string; task: string }> } }).plan;
          for (const step of plan.steps) {
            cards.set(step.id, {
              stepId: step.id,
              agentId: step.agentId,
              task: step.task,
              status: "queued",
            });
          }
          break;
        }
        case "delegation.created": {
          const d = p as unknown as {
            stepId: string;
            agentId: string;
            task: string;
            delegatedConversationId: string;
          };
          cards.set(d.stepId, {
            ...(cards.get(d.stepId) ?? {
              stepId: d.stepId,
              agentId: d.agentId,
              task: d.task,
            }),
            stepId: d.stepId,
            agentId: d.agentId,
            task: d.task,
            status: "running",
            conversationId: d.delegatedConversationId,
          });
          break;
        }
        case "step.started": {
          if (stepId && cards.has(stepId)) {
            cards.set(stepId, { ...cards.get(stepId)!, status: "running" });
          }
          break;
        }
        case "step.completed": {
          const d = p as unknown as {
            stepId: string;
            result: { summary: string; durationMs?: number };
          };
          const existing = cards.get(d.stepId);
          if (existing) {
            cards.set(d.stepId, {
              ...existing,
              status: "completed",
              summary: d.result.summary,
              durationMs: d.result.durationMs,
            });
          }
          break;
        }
        case "step.failed": {
          const d = p as unknown as { stepId: string; reason: string };
          const existing = cards.get(d.stepId);
          if (existing) {
            cards.set(d.stepId, {
              ...existing,
              status: "failed",
              failureReason: d.reason,
            });
          }
          break;
        }
        case "step.cancelled": {
          if (stepId && cards.has(stepId)) {
            cards.set(stepId, { ...cards.get(stepId)!, status: "cancelled" });
          }
          break;
        }
        default:
          return;
      }

      patchMessage(conversationId, messageId, {
        orchestrationId: event.orchestrationId,
        delegations: [...cards.values()],
      });
    },
    [patchMessage],
  );

  const setStreaming = useCallback((conversationId: string, on: boolean) => {
    setStreamingConversations((prev) =>
      on
        ? prev.includes(conversationId)
          ? prev
          : [...prev, conversationId]
        : prev.filter((id) => id !== conversationId),
    );
  }, []);

  /**
   * Drive one agent run and fold its events into the conversation.
   *
   * Creates exactly ONE assistant message and mutates it as deltas arrive —
   * never appends per token. Text accumulates in a local buffer flushed on an
   * animation frame, so a fast stream costs ~60 renders/sec rather than one
   * render per token.
   */
  const runAgent = useCallback(
    (
      agentId: string,
      conversationId: string,
      message: string,
      opts: {
        assistantId?: string;
        attempt?: number;
        mode?: "direct" | "orchestrated";
      } = {},
    ) => {
      // One run per conversation; starting another supersedes the first.
      activeRuns.current.get(conversationId)?.cancel();

      const conversation = conversations.find((c) => c.id === conversationId);
      // Only this conversation is sent as context — never another agent's.
      const history = (conversation?.messages ?? [])
        .filter((m) => m.status === "complete" && m.body.trim())
        .map((m) => ({
          role:
            m.role === "operator" ? ("user" as const) : ("assistant" as const),
          content: m.body,
        }));

      const assistantId = opts.assistantId ?? `asst-${Date.now().toString(36)}`;

      if (!opts.assistantId) {
        // The single message every delta accumulates into.
        const placeholder: ChatMessage = {
          id: assistantId,
          conversationId,
          agentId,
          role: "agent",
          body: "",
          createdAt: new Date().toISOString(),
          status: "pending",
          kind: "text",
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: placeholder.createdAt,
                  messages: [...c.messages, placeholder],
                }
              : c,
          ),
        );
      } else {
        // Retry reuses the existing message rather than appending another.
        patchMessage(conversationId, assistantId, {
          status: "pending",
          body: "",
          errorMessage: undefined,
          toolCalls: undefined,
        });
      }

      setStreaming(conversationId, true);

      let buffer = "";
      let frame: number | null = null;

      const flush = () => {
        frame = null;
        if (!buffer) return;
        const chunk = buffer;
        buffer = "";
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: new Date().toISOString(),
                  messages: c.messages.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          body: m.body + chunk,
                          status: "streaming" as const,
                        }
                      : m,
                  ),
                }
              : c,
          ),
        );
      };
      const schedule = () => {
        if (frame === null) frame = requestAnimationFrame(flush);
      };

      const toolCalls = new Map<string, ChatToolCall>();
      const delegations = new Map<string, ChatDelegation>();
      let lastRunId: string | null = null;
      let failed = false;
      // Set when the operator stops the run, so the settled state is
      // `cancelled` rather than `complete`.
      let stopped = false;

      const handle = executeAgentRun(
        {
          mode: opts.mode ?? "direct",
          agentId,
          conversationId,
          message,
          history,
          attempt: opts.attempt ?? 1,
        },
        (event: StreamEvent) => {
          // Orchestration events describe delegation, not this message's text.
          // They update the delegation cards and are republished for
          // Operations; the runtime switch below handles only the rest.
          if (isOrchestrationEvent(event)) {
            runtimeSubscribers.current.forEach((fn) => fn(event));
            applyOrchestrationEvent(conversationId, assistantId, event, delegations);
            return;
          }

          // A delegated agent's runtime events carry a stepId. They belong to
          // that agent's own conversation, so they must not append text here.
          if ("stepId" in event && event.stepId !== "synthesis") {
            runtimeSubscribers.current.forEach((fn) => fn(event));
            return;
          }

          lastRunId = (event as RuntimeEvent).runId;
          // Republish before local handling so operational state tracks the run
          // even when the chat is not on screen.
          runtimeSubscribers.current.forEach((fn) => fn(event));

          switch (event.type) {
            case "message.delta":
              buffer += event.payload.text;
              schedule();
              // Live-talk: split the buffer at sentence boundaries and feed
              // each complete sentence to the speaker. Disabled if the user
              // hasn't enabled the speaker or the queue is full.
              if (speaker.enabled) {
                speakerConvoRef.current = conversationId;
                const split = splitSentences(buffer);
                if (split.complete.length > 0 && split.remainder !== buffer) {
                  for (const s of split.complete) {
                    void speaker.enqueueSentence(s);
                  }
                  buffer = split.remainder;
                }
              }
              break;

            case "message.completed":
              if (frame !== null) cancelAnimationFrame(frame);
              frame = null;
              // Flush any remaining sentence fragments to the speaker so the
              // user hears the final words of the response (e.g. trailing
              // "Thanks!" or short acknowledgements that don't end in punctuation).
              if (speaker.enabled && buffer.trim()) {
                void speaker.enqueueSentence(buffer);
              }
              buffer = "";
              patchMessage(conversationId, assistantId, {
                body: event.payload.text,
                status: "complete",
                runId: event.runId,
              });
              break;

            case "tool.started":
              toolCalls.set(event.payload.toolCallId, {
                id: event.payload.toolCallId,
                toolId: event.payload.toolId,
                toolName: event.payload.toolName,
                status: "running",
              });
              patchMessage(conversationId, assistantId, {
                toolCalls: [...toolCalls.values()],
              });
              break;

            case "tool.completed": {
              const existing = toolCalls.get(event.payload.toolCallId);
              toolCalls.set(event.payload.toolCallId, {
                id: event.payload.toolCallId,
                toolId: event.payload.toolId,
                toolName: existing?.toolName ?? event.payload.toolId,
                status: event.payload.ok ? "completed" : "failed",
                durationMs: event.payload.durationMs,
                summary: event.payload.summary,
              });
              patchMessage(conversationId, assistantId, {
                toolCalls: [...toolCalls.values()],
              });
              break;
            }

            case "agent.error":
              failed = true;
              if (frame !== null) cancelAnimationFrame(frame);
              frame = null;
              patchMessage(conversationId, assistantId, {
                status: "error",
                errorMessage: event.payload.message,
                runId: event.runId,
              });
              break;

            case "run.completed":
              if (frame !== null) cancelAnimationFrame(frame);
              frame = null;
              flush();
              setStreaming(conversationId, false);
              activeRuns.current.delete(conversationId);
              if (event.payload.status === "cancelled") {
                // Cancelled is terminal and distinct: never reported complete.
                stopped = true;
                patchMessage(conversationId, assistantId, {
                  status: "cancelled",
                  runId: event.runId,
                });
              }
              break;

            default:
              break;
          }
        },
      );

      activeRuns.current.set(conversationId, handle);

      void handle.done.then(() => {
        setStreaming(conversationId, false);
        activeRuns.current.delete(conversationId);
        // Safety net for a stream that ends without a terminal event, so a
        // message cannot be left spinning forever.
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId &&
                    (m.status === "pending" || m.status === "streaming")
                      ? {
                          ...m,
                          // A stopped run is `cancelled` even with partial
                          // text: reporting it complete would claim the agent
                          // finished when the operator cut it short.
                          status: stopped
                            ? ("cancelled" as const)
                            : failed
                              ? ("error" as const)
                              : m.body
                                ? ("complete" as const)
                                : ("cancelled" as const),
                          runId: lastRunId ?? m.runId,
                        }
                      : m,
                  ),
                }
              : c,
          ),
        );
      });
    },
    [conversations, patchMessage, setStreaming, applyOrchestrationEvent],
  );

  const sendMessage = useCallback(
    async (
      agentId: string,
      conversationId: string,
      body: string,
    ): Promise<RouteResult> => {
      const trimmed = body.trim();
      // The simulated conversation is a read-only projection, not stored
      // state: a turn written into it would be discarded on the next render.
      // Redirect to a real conversation instead of silently losing the text.
      if (conversationId === SIM_CONVERSATION_IDS.hermes) {
        const real = conversations.find((c) => c.agentId === agentId);
        conversationId = real?.id ?? startConversation(agentId).id;
      }
      if (!trimmed) {
        return {
          agentId,
          conversationId,
          message: "",
          switchedTarget: false,
          unresolvedMention: null,
          runtimeReason: null,
        };
      }

      // The message carries the agent id explicitly so a turn can never be
      // re-attributed by whichever conversation it happens to sit in.
      const message = createMessage(
        conversationId,
        agentId,
        "operator",
        trimmed,
        "pending",
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, message],
                updatedAt: message.createdAt,
              }
            : c,
        ),
      );

      // Live provider: the turn is delivered and the agent actually replies.
      if (runtimeStatus.live) {
        markMessage(conversationId, message.id, "complete");
        runAgent(agentId, conversationId, trimmed);
        return {
          agentId,
          conversationId,
          message: trimmed,
          switchedTarget: false,
          unresolvedMention: null,
          runtimeReason: "LIVE RUNTIME",
        };
      }

      // No provider configured: the local queue adapter reports
      // `awaiting-runtime` rather than inventing a reply.
      const runtime = getAgentRuntime();
      const result = await runtime.sendMessage({
        agentId,
        conversationId,
        message: trimmed,
      });
      markMessage(conversationId, message.id, result.status);

      return {
        agentId,
        conversationId,
        message: trimmed,
        switchedTarget: false,
        unresolvedMention: null,
        runtimeReason: result.reason,
      };
    },
    [markMessage, runAgent, runtimeStatus.live, conversations, startConversation],
  );

  /**
   * Send a message to Hermes for orchestration.
   *
   * Records the operator turn in the Hermes conversation, then runs the
   * orchestrator. Delegated work lands in each agent's own conversation; only
   * the delegation cards and the synthesised answer appear here.
   */
  const orchestrate = useCallback(
    (conversationId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;

      const message = createMessage(
        conversationId,
        "hermes",
        "operator",
        trimmed,
        runtimeStatus.live ? "complete" : "awaiting-runtime",
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, message],
                updatedAt: message.createdAt,
              }
            : c,
        ),
      );

      // Without a provider there is nothing to orchestrate; the operator turn
      // is stored as awaiting-runtime rather than a plan being invented.
      if (!runtimeStatus.live) return;

      runAgent("hermes", conversationId, trimmed, { mode: "orchestrated" });
    },
    [runAgent, runtimeStatus.live],
  );

  /** Stop an in-flight run for one conversation. */
  const cancelRun = useCallback((conversationId: string) => {
    activeRuns.current.get(conversationId)?.cancel();
  }, []);

  /**
   * Re-run a failed assistant turn.
   *
   * Reuses the same assistant message and resends the preceding operator turn,
   * so retrying never duplicates the user's message in the transcript.
   */
  const retryMessage = useCallback(
    (conversationId: string, messageId: string) => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) return;
      const index = conversation.messages.findIndex((m) => m.id === messageId);
      if (index < 1) return;

      const prompt = [...conversation.messages.slice(0, index)]
        .reverse()
        .find((m) => m.role === "operator");
      if (!prompt) return;

      runAgent(conversation.agentId, conversationId, prompt.body, {
        assistantId: messageId,
        attempt: 2,
      });
    },
    [conversations, runAgent],
  );

  const subscribeRuntime = useCallback((fn: (event: StreamEvent) => void) => {
    runtimeSubscribers.current.add(fn);
    return () => {
      runtimeSubscribers.current.delete(fn);
    };
  }, []);

  const routeCommand = useCallback(
    async (
      input: string,
      agents: ParsableAgent[],
      currentTargetId: string | null,
    ): Promise<RouteResult> => {
      const parsed = parseCommand(input, agents);

      // Target resolution: an explicit address wins; otherwise keep the
      // current target. Never pick an agent at random.
      const targetId = parsed.targetAgentId ?? currentTargetId;
      const switchedTarget =
        parsed.targetAgentId !== null && parsed.targetAgentId !== currentTargetId;

      // No target and no address: a global Hermes command. Nothing is written
      // to an agent conversation, because it was not addressed to one.
      if (!targetId) {
        return {
          agentId: null,
          conversationId: null,
          message: parsed.message,
          switchedTarget: false,
          unresolvedMention: parsed.unresolvedMention,
          runtimeReason: null,
        };
      }

      // Addressing an agent with no message body only switches the target.
      if (!parsed.message) {
        return {
          agentId: targetId,
          conversationId: activeConversationId(targetId),
          message: "",
          switchedTarget,
          unresolvedMention: parsed.unresolvedMention,
          runtimeReason: null,
        };
      }

      // Resolve the destination conversation, creating one if the agent has
      // none yet, so a command is never dropped for lack of a container.
      let conversationId = ensureActive(targetId);
      if (!conversationId) {
        conversationId = startConversation(targetId).id;
      }

      const sent = await sendMessage(targetId, conversationId, parsed.message);
      return {
        ...sent,
        switchedTarget,
        unresolvedMention: parsed.unresolvedMention,
      };
    },
    [activeConversationId, ensureActive, sendMessage, startConversation],
      );

      /**
       * Listen for finalized voice transcripts and route them through the same
       * pipeline as typed text. Wired via a CustomEvent (declared in
       * VoiceProvider.tsx) so the two providers — Voice (outer) ↔ Conversation
       * (inner) — don't have to be re-architected to share state.
       *
       * Why only `isFinal`:
       *   - SpeechRecognition emits interim results every ~50ms while the user is
       *     still talking. Routing on every interim would send half-spoken text
       *     to the agent, who'd respond before the user finishes.
       *   - The browser sets `isFinal: true` only when the user pauses
       *     (default silence ≈1s) or when we explicitly stop the mic. That's the
       *     right moment to ship the command.
       *
       * Why a `lastFinalRef`:
       *   - Silence auto-flush calls `rec.stop()` then `rec.start()` to re-arm.
       *     On some engines the final transcript fires TWICE (once for the stopped
       *     session, once for the new one with the same text). The ref dedupes
       *     against the most recent final so we route at most once per utterance.
       *
       * The `agents` argument is intentionally empty: parseCommand with [] falls
       * back to `currentTargetId` (which VoiceProvider tracks via setActiveAgentId),
       * so a transcript that names an agent with `@apex` still parses correctly
       * (parseCommand normalizes against the input only for that match), and one
       * that doesn't will route to whichever agent the user has currently targeted.
       */
      const lastFinalRef = useRef<{ text: string; at: number } | null>(null);
      /**
       * VoiceProvider lives above us and exposes `activeAgentId` via its own
       * context. We mirror it here via a window-level storage key so this listener
       * can read it without a context refactor — the command bar sets it on every
       * `setActiveAgentId` call.
       */
      const activeAgentIdRef = useRef<string | null>(null);
      useEffect(() => {
        function readActive() {
          try {
            const v = window.localStorage.getItem("hermes:activeTarget");
            activeAgentIdRef.current = v ?? null;
          } catch {
            // ignore — SSR, private mode, etc.
          }
        }
        readActive();
        window.addEventListener("storage", readActive);
        return () => window.removeEventListener("storage", readActive);
      }, []);
      useEffect(() => {
        function onTranscript(event: Event) {
          const e = event as CustomEvent<VoiceTranscriptDetail>;
          const detail = e.detail;
          if (!detail?.text) return;
          // Only route on finalized transcripts — interim results are still
          // changing and will fire `isFinal` once the user pauses.
          if (!detail.isFinal) return;

          const text = detail.text.trim();
          if (!text) return;

          // Dedup within ~3s — SpeechRecognition can re-emit the same final
          // transcript when SR is auto-restarted by the silence timer.
          const now = Date.now();
          const last = lastFinalRef.current;
          if (last && last.text === text && now - last.at < 3000) return;
          lastFinalRef.current = { text, at: now };

          // Fire-and-forget: the routeCommand result is logged to the
          // command-bar UI by VoiceCommandBar, not by ConversationProvider.
          // Errors here would be silent (no consumer) — at minimum log so the
          // user can see something in DevTools.
          void routeCommand(text, [], activeAgentIdRef.current).catch((err) => {
            console.error("[voice-transcript] routeCommand failed", { text, err });
          });
        }
        window.addEventListener(VOICE_TRANSCRIPT_EVENT, onTranscript);
        return () => {
          window.removeEventListener(VOICE_TRANSCRIPT_EVENT, onTranscript);
        };
      }, [routeCommand]);

  const resetStore = useCallback(() => {
    skipPersist.current = true;
    setConversations(loadConversations());
    queueMicrotask(() => {
      skipPersist.current = false;
    });
  }, []);

  const value = useMemo<ConversationContextValue>(
    () => ({
      conversations: allConversations,
      hydrated,
      conversationsFor,
      getConversation,
      activeConversationId,
      ensureActive,
      setActiveConversation,
      startConversation,
      renameConversation,
      deleteConversation,
      sendMessage,
      routeCommand,
      resetStore,
      runtimeStatus,
      streamingConversations,
      cancelRun,
      retryMessage,
      subscribeRuntime,
      orchestrate,
      simulationStep,
      setSimulationStep,
      speakerEnabled: speaker.enabled,
      toggleSpeaker: speaker.toggle,
      stopSpeaker: speaker.stop,
      speakerNowPlayingId: speaker.nowPlayingId,
      speakerQueueLength: speaker.queueLength,
    }),
    [
      allConversations,
      hydrated,
      conversationsFor,
      getConversation,
      activeConversationId,
      ensureActive,
      setActiveConversation,
      startConversation,
      renameConversation,
      deleteConversation,
      sendMessage,
      routeCommand,
      resetStore,
      runtimeStatus,
      streamingConversations,
      cancelRun,
      retryMessage,
      subscribeRuntime,
      orchestrate,
      simulationStep,
    ],
  );

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

/**
 * Split a streaming text buffer at sentence boundaries.
 *
 * Returns the sentences that are complete (end in `.` `!` or `?` followed
 * by whitespace or end-of-string) plus the trailing remainder that hasn't
 * finished yet. We never split mid-word, never split inside a list bullet,
 * and never emit a fragment shorter than the trailing remainder itself
 * (no point committing "H" if more text is coming).
 *
 * Conservative by design: we prefer fewer, longer sentences over many short
 * fragments — ElevenLabs handles long sentences well, and skipping a
 * mid-sentence fragment prevents glitchy cutoffs.
 *
 * Short trailing fragments ("Yes.", "Done.") DO get committed when the
 * remainder is empty, so the final words of an answer aren't dropped.
 */
// Avoid splitting on periods inside common abbreviations so we don't
// mistake "Dr." or "e.g." for sentence ends.
const ABBREVIATIONS = /\b(?:Dr|Mr|Mrs|Ms|St|vs|etc|e\.g|i\.e)\.$/;

function splitSentences(buffer: string): { complete: string[]; remainder: string } {
  if (!buffer) return { complete: [], remainder: "" };
  const complete: string[] = [];
  let remainder = buffer;

  // Walk through the buffer and look for terminal punctuation followed by a
  // word boundary (space or EOL). The loop stops at the first such match.
  let idx = -1;
  for (let i = 0; i < remainder.length; i++) {
    const ch = remainder[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    // Skip abbreviations like "Dr." or "e.g." so we don't mis-split.
    const tail = remainder.slice(Math.max(0, i - 4), i + 1);
    if (ABBREVIATIONS.test(tail)) continue;
    // Require a word boundary after the punctuation so "10.5" doesn't
    // trigger a split. Sentence ending at end-of-buffer also counts.
    const next = remainder[i + 1];
    if (next !== undefined && next !== " " && next !== "\n") continue;
    idx = i;
    break;
  }
  if (idx === -1) return { complete: [], remainder };

  // Slice off the sentence up to and including the terminal punctuation.
  // Always push it — even short fragments like "Yes." or "OK." are valid
  // sentences when followed by a sentence boundary. (If the buffer is
  // mid-stream we *don't* want to push partial words, but by this point
  // we've already confirmed there's a terminal punctuation followed by a
  // word boundary, so this IS a real sentence.)
  const sentence = remainder.slice(0, idx + 1).trim();
  remainder = remainder.slice(idx + 1).replace(/^\s+/, "");

  complete.push(sentence);

  // Recurse on the remainder — the buffer may contain multiple completed
  // sentences (e.g. "Hello. World!"). Keep splitting until none remain.
  if (remainder.length > 0) {
    const tail = splitSentences(remainder);
    complete.push(...tail.complete);
    remainder = tail.remainder;
  }
  return { complete, remainder };
}

export function useConversations(): ConversationContextValue {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    throw new Error("useConversations must be used within ConversationProvider");
  }
  return ctx;
}
