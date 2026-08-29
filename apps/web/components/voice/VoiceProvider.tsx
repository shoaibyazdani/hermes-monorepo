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
import { useVoice, VoiceEvent, type VoiceState } from "@/hooks/useVoice";
import type { VoicePhase, VoiceTarget } from "@/lib/types";

/**
 * Global event the voice engine fires when a transcript segment settles.
 *
 * ConversationProvider listens for this and pipes the text through
 * `routeCommand`. Kept as a window event so the two providers don't have to
 * be re-architected (VoiceProvider is the outer provider; ConversationProvider
 * is inner and owns routeCommand).
 *
 * Detail:
 *   - `text`:  the finalized transcript for this segment
 *   - `isFinal`: true if SpeechRecognition marked this as the final result; false
 *     if it's an interim update (used to suppress routing while still talking).
 */
export interface VoiceTranscriptDetail {
  text: string;
  isFinal: boolean;
}

export const VOICE_TRANSCRIPT_EVENT = "hermes:voice-transcript";

/**
 * Dispatch a transcript segment to anyone listening on `window`. ConversationProvider
 * subscribes via `useEffect` and pipes the text through `routeCommand`.
 */
export function dispatchTranscript(detail: VoiceTranscriptDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<VoiceTranscriptDetail>(VOICE_TRANSCRIPT_EVENT, { detail }),
  );
}

export interface Agent {
  id: string;
  name: string;
}

interface RoutedLogEntry {
  /** Agent ID this entry belongs to. `null` = broadcast / system. */
  agentId: string | null;
  line: string;
}

interface VoiceContextValue {
  /** Engine-level mic state. */
  state: VoiceState;
  /**
   * Presentation-level phase, which is what the command bar renders.
   *
   * Derived from the engine state today. Once transcription lands, the
   * `processing` and `speaking` phases will be driven by the pipeline rather
   * than set manually — the UI already handles them.
   */
  phase: VoicePhase;
  /** Manually set the phase. Reserved for the future transcription pipeline. */
  setPhase: (phase: VoicePhase | null) => void;
  /** Latest mic RMS level, 0-1. Drives the waveform. 0 when not listening. */
  level: number;
  errorMessage: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
  log: string[];
  appendLog: (line: string) => void;
  /** Currently targeted agent (set by @-mention). null = broadcast to all. */
  activeAgentId: string | null;
  setActiveAgentId: (id: string | null) => void;
  /** Resolved target for display: agent name, or "ALL". */
  target: VoiceTarget;
  /** All agents known to the system (set by the page; used for @-mention parsing). */
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  /** Per-agent log entries (preserved across agent switches). */
  routedLog: RoutedLogEntry[];
  /** Append a log entry tagged to a specific agent (or null for system). */
  appendRoutedLog: (entry: RoutedLogEntry) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

const DEFAULT_AGENTS: Agent[] = [
  { id: "hermes", name: "HERMES" },
  { id: "apex", name: "APEX" },
  { id: "nova", name: "NOVA" },
  { id: "atlas", name: "ATLAS" },
  { id: "orion", name: "ORION" },
  { id: "sentinel", name: "SENTINEL" },
  { id: "cipher", name: "CIPHER" },
];

/** Engine state → presentation phase. */
const STATE_TO_PHASE: Record<VoiceState, VoicePhase> = {
  idle: "idle",
  requesting: "requesting",
  listening: "listening",
  error: "error",
};

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  // Per-agent log: each entry tagged with the agent it belongs to.
  const [routedLog, setRoutedLog] = useState<RoutedLogEntry[]>([
    { agentId: null, line: "[HERMES] Command network ready." },
  ]);
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  // When set, overrides the engine-derived phase. The transcription pipeline
  // will drive this in a later phase; nothing sets it today.
  const [phaseOverride, setPhaseOverride] = useState<VoicePhase | null>(null);
  // Mic level, throttled: the VAD loop emits at 10Hz but re-rendering the whole
  // tree that often is wasteful, so only meaningful changes are committed.
  const [level, setLevel] = useState(0);
  const lastLevelRef = useRef(0);

  const appendRoutedLog = useCallback((entry: RoutedLogEntry) => {
    setRoutedLog((prev) => [...prev.slice(-49), entry]);
  }, []);

  const appendLog = useCallback(
    (line: string) => {
      // Treat bare appendLog as system-level (tagged null)
      appendRoutedLog({ agentId: null, line });
    },
    [appendRoutedLog],
  );

  const handleVoiceEvent = useCallback(
    (event: VoiceEvent) => {
      if (event.kind === "listening") {
        appendRoutedLog({ agentId: null, line: "[HERMES] Voice channel active." });
      } else if (event.kind === "error") {
        appendRoutedLog({ agentId: null, line: `[HERMES] ${event.message}` });
        setLevel(0);
      } else {
        // `hearing` / `silent` fire every 100ms — they drive the waveform, not
        // the log. Writing them to the feed would flood it.
        const next = Math.min(1, event.level * 12);
        if (Math.abs(next - lastLevelRef.current) > 0.04) {
          lastLevelRef.current = next;
          setLevel(next);
        }
      }
    },
    [appendRoutedLog],
  );

  const voice = useVoice({ onEvent: handleVoiceEvent });

  const engineStop = voice.stop;
  const stopVoice = useCallback(() => {
    engineStop();
    lastLevelRef.current = 0;
    setLevel(0);
  }, [engineStop]);

  const phase: VoicePhase = phaseOverride ?? STATE_TO_PHASE[voice.state];

  const target: VoiceTarget = useMemo(() => {
    const agent = activeAgentId
      ? agents.find((a) => a.id === activeAgentId)
      : undefined;
    return { agentId: agent?.id ?? null, label: agent?.name ?? "ALL" };
  }, [activeAgentId, agents]);

  return (
    <VoiceContext.Provider
      value={{
        state: voice.state,
        phase,
        level: voice.state === "listening" ? level : 0,
        setPhase: setPhaseOverride,
        errorMessage: voice.errorMessage,
        start: voice.start,
        stop: stopVoice,
        log: routedLog.map((e) => e.line),
        appendLog,
        activeAgentId,
        setActiveAgentId,
        target,
        agents,
        setAgents,
        routedLog,
        appendRoutedLog,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceContext must be within VoiceProvider");
  return ctx;
}

/*
 * Command parsing lives in `lib/chat/command-parser`.
 *
 * It was moved out of this provider so one parser serves both typed input and
 * (later) voice transcripts, and so it stays free of React and microphone
 * concerns. Two competing mention parsers would have drifted.
 */
