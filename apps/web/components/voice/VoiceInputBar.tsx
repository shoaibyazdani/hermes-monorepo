"use client";

import { useEffect, useMemo, useState } from "react";
import { parseAgentMention, useVoiceContext } from "./VoiceProvider";

export function VoiceInputBar() {
  const {
    start,
    stop,
    state,
    errorMessage,
    appendRoutedLog,
    appendLog,
    agents,
    activeAgentId,
  } = useVoiceContext();

  const [text, setText] = useState("");

  // Live preview of the @-mention match so the user sees who's about to be picked
  const mentionPreview = useMemo(() => {
    const m = text.match(/@(\w+)/);
    if (!m) return null;
    const needle = m[1].toLowerCase();
    return (
      agents.find(
        (a) =>
          a.id.toLowerCase().startsWith(needle) ||
          a.name.toLowerCase().startsWith(needle),
      ) ?? { id: "", name: "no match" }
    );
  }, [text, agents]);

  const handleExecute = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { matched, cleaned, hadMention } = parseAgentMention(trimmed, agents);
    const targetLabel = matched ? matched.name : "ALL";
    const userLine = `[YOU → ${targetLabel}] ${cleaned}`;

    // Echo the user's message, tagged to the target agent (or null = all)
    appendRoutedLog({ agentId: matched?.id ?? null, line: userLine });
    setText("");

    if (hadMention && !matched) {
      appendLog(`[J.A.R.V.I.S.] No agent matches — broadcasting to all.`);
    } else {
      appendLog(`[J.A.R.V.I.S.] Routing to ${targetLabel}.`);
    }

    if (state !== "listening") {
      const ok = await start();
      if (ok) appendLog(`[J.A.R.V.I.S.] Voice channel active.`);
    }
  };

  return (
    <div className="flex flex-col gap-1 max-w-[700px] mx-auto w-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleExecute();
          }}
          placeholder="@joy status  ·  or just type to broadcast"
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
      </div>
      {/* Live @-mention preview */}
      <div className="flex justify-between text-[11px] font-data tracking-[0.15em] uppercase text-ink-mute">
        <span>
          {mentionPreview
            ? `→ @${mentionPreview.name}`
            : activeAgentId
              ? `→ @${activeAgentId}`
              : "→ broadcast"}
        </span>
        {errorMessage && (
          <span className="text-hud-red normal-case">{errorMessage}</span>
        )}
      </div>
    </div>
  );
}