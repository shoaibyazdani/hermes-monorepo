"use client";

import { useState } from "react";
import { useVoiceContext } from "./VoiceProvider";

export function VoiceInputBar() {
  const { start, stop, state, errorMessage, appendLog } = useVoiceContext();
  const [text, setText] = useState("");

  const handleExecute = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    appendLog(`[YOU]> ${trimmed}`);
    setText("");
    if (state !== "listening") {
      const ok = await start();
      if (ok) appendLog("[J.A.R.V.I.S.] Voice channel opened for you.");
    }
  };

  return (
    <div className="flex gap-2 max-w-[700px] mx-auto">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleExecute();
        }}
        placeholder="Speak or type a command..."
        className="flex-1 px-4 py-3 bg-black/50 border border-hudcss-cyan-dim text-ink font-data text-sm outline-none focus:border-hud-cyan focus:[box-shadow:0_0_16px_var(--cyan-glow)] transition-all"
      />
      <button
        type="button"
        onClick={() => void handleExecute()}
        className="px-5 py-3 bg-gradient-to-br from-hud-cyan to-[#6366f1] text-white border-0 font-hud font-bold tracking-wider cursor-pointer [box-shadow:0_0_12px_var(--cyan-glow)] hover:translate-y-[-1px] transition-transform"
      >
        EXECUTE
      </button>
      {state === "listening" && (
        <button
          type="button"
          onClick={stop}
          className="px-4 py-3 bg-hud-red/20 border border-hud-red text-hud-red font-hud text-xs tracking-wider"
        >
          STOP MIC
        </button>
      )}
      {errorMessage && (
        <div className="text-hud-red text-xs mt-1">{errorMessage}</div>
      )}
    </div>
  );
}
