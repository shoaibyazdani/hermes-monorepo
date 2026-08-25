"use client";

import { createContext, useContext, useState } from "react";
import { useVoice, VoiceEvent, type VoiceState } from "@/hooks/useVoice";

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
  state: VoiceState;
  errorMessage: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
  log: string[];
  appendLog: (line: string) => void;
  /** Currently active agent id (set by @-mention). null = broadcast to all. */
  activeAgentId: string | null;
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
  { id: "joy", name: "JOY" },
  { id: "sentinel", name: "SENTINEL" },
  { id: "quant", name: "QUANT" },
  { id: "scout", name: "SCOUT" },
  { id: "fixer", name: "FIXER" },
];

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  // Per-agent log: each entry tagged with the agent it belongs to.
  const [routedLog, setRoutedLog] = useState<RoutedLogEntry[]>([
    { agentId: null, line: "[J.A.R.V.I.S.] Ready for input..." },
  ]);
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  const appendRoutedLog = (entry: RoutedLogEntry) => {
    setRoutedLog((prev) => [...prev.slice(-49), entry]);
  };

  const appendLog = (line: string) => {
    // Treat bare appendLog as system-level (tagged null)
    appendRoutedLog({ agentId: null, line });
  };

  const handleVoiceEvent = (event: VoiceEvent) => {
    if (event.kind === "listening") {
      appendRoutedLog({ agentId: null, line: "[J.A.R.V.I.S.] Voice channel active." });
    } else if (event.kind === "hearing") {
      appendRoutedLog({ agentId: null, line: "[J.A.R.V.I.S.] Hearing you..." });
    } else if (event.kind === "silent") {
      appendRoutedLog({ agentId: null, line: "[J.A.R.V.I.S.] Awaiting input..." });
    } else if (event.kind === "error") {
      appendRoutedLog({ agentId: null, line: `[J.A.R.V.I.S.] ${event.message}` });
    }
  };

  const voice = useVoice({ onEvent: handleVoiceEvent });

  return (
    <VoiceContext.Provider
      value={{
        state: voice.state,
        errorMessage: voice.errorMessage,
        start: voice.start,
        stop: voice.stop,
        log: routedLog.map((e) => e.line),
        appendLog,
        activeAgentId,
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

/**
 * parseAgentMention — extract the first @-mention from a message.
 *
 * Rules (per Shoaib, Aug 25):
 * - Single @-prefix matches the FIRST agent whose id or name starts with the
 *   mention (case-insensitive). E.g. `@joy` → JOY, `@s` → SENTINEL.
 * - Returns null if no @-prefix is found (meaning "broadcast to all").
 *
 * If the mention doesn't match any agent, returns the literal `{ matched: null }`
 * so the caller can decide what to do (we choose: broadcast as fallback).
 */
export interface MentionResult {
  /** Matched agent, or null if @-prefix didn't match. */
  matched: Agent | null;
  /** The cleaned message with the @-prefix removed. */
  cleaned: string;
  /** True if the input had an @-prefix at all (even if no match). */
  hadMention: boolean;
}

export function parseAgentMention(
  input: string,
  agents: Agent[],
): MentionResult {
  const match = input.match(/@(\w+)/);
  if (!match) {
    return { matched: null, cleaned: input, hadMention: false };
  }
  const needle = match[1].toLowerCase();
  // First agent whose id or name (lowercased) starts with needle
  const found = agents.find(
    (a) =>
      a.id.toLowerCase().startsWith(needle) ||
      a.name.toLowerCase().startsWith(needle),
  );
  // Strip the @-mention from the message
  const cleaned = input.replace(/@\w+/, "").trim();
  return {
    matched: found ?? null,
    cleaned,
    hadMention: true,
  };
}