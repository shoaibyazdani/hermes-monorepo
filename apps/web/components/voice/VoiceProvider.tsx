"use client";

import { createContext, useContext, useState } from "react";
import { useVoice, VoiceEvent, type VoiceState } from "@/hooks/useVoice";

interface VoiceContextValue {
  state: VoiceState;
  errorMessage: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
  log: string[];
  appendLog: (line: string) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [log, setLog] = useState<string[]>([
    "[J.A.R.V.I.S.] Ready for input...",
  ]);

  const appendLog = (line: string) => {
    setLog((prev) => [...prev.slice(-19), line]);
  };

  const handleEvent = (event: VoiceEvent) => {
    if (event.kind === "listening") {
      appendLog("[J.A.R.V.I.S.] Voice channel active.");
    } else if (event.kind === "hearing") {
      appendLog("[J.A.R.V.I.S.] Hearing you...");
    } else if (event.kind === "silent") {
      appendLog("[J.A.R.V.I.S.] Awaiting input...");
    } else if (event.kind === "error") {
      appendLog(`[J.A.R.V.I.S.] ${event.message}`);
    }
  };

  const voice = useVoice({ onEvent: handleEvent });

  return (
    <VoiceContext.Provider
      value={{
        state: voice.state,
        errorMessage: voice.errorMessage,
        start: voice.start,
        stop: voice.stop,
        log,
        appendLog,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceContext must be used within VoiceProvider");
  return ctx;
}
