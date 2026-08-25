"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseAgentMention, useVoiceContext, type Agent } from "./VoiceProvider";

export function VoiceInputBar() {
  const {
    start,
    stop,
    state,
    errorMessage,
    appendRoutedLog,
    appendLog,
    agents,
  } = useVoiceContext();

  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect if the user is currently typing an @-mention (cursor inside the @token)
  const [mention, setMention] = useState<{
    /** Where in `text` the @ starts (index). */
    startIdx: number;
    /** Where in `text` the cursor is (after the @partial). */
    endIdx: number;
    /** The partial text after the @ (e.g. "jo" → JOY). */
    partial: string;
  } | null>(null);

  // Filtered agents based on the partial typed after @
  const mentionMatches = useMemo(() => {
    if (!mention) return [] as Agent[];
    const needle = mention.partial.toLowerCase();
    if (!needle) return agents;
    return agents.filter(
      (a) =>
        a.id.toLowerCase().startsWith(needle) ||
        a.name.toLowerCase().startsWith(needle),
    );
  }, [mention, agents]);

  // Track cursor position to know if we're "inside" the @-mention
  const updateMention = (newText: string, caret: number) => {
    // Walk backwards from caret to find an unmatched @
    let i = caret - 1;
    while (i >= 0) {
      const ch = newText[i];
      if (ch === "@") {
        // Check this @ is at start-of-string or preceded by whitespace
        const prev = i > 0 ? newText[i - 1] : " ";
        if (/\s|^/.test(prev)) {
          setMention({
            startIdx: i,
            endIdx: caret,
            partial: newText.slice(i + 1, caret),
          });
          return;
        }
        setMention(null);
        return;
      }
      // If we hit a space before finding @, no active mention
      if (/\s/.test(ch)) {
        setMention(null);
        return;
      }
      i--;
    }
    setMention(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    const caret = e.target.selectionStart ?? newText.length;
    setText(newText);
    updateMention(newText, caret);
  };

  const selectMention = (agent: Agent) => {
    if (!mention) return;
    const before = text.slice(0, mention.startIdx);
    const after = text.slice(mention.endIdx);
    const insertion = `@${agent.name} `;
    const newText = before + insertion + after;
    setText(newText);
    setMention(null);
    // Refocus input + put cursor after the inserted mention
    requestAnimationFrame(() => {
      const caret = (before + insertion).length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  // Handle keyboard navigation when mention dropdown is open
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mention && mentionMatches.length > 0) {
      if (e.key === "Tab" || (e.key === "Enter" && mention.partial !== "")) {
        e.preventDefault();
        selectMention(mentionMatches[0]);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void handleExecute(/* openMicAfter= */ false);
    }
  };

  // Send text WITHOUT auto-starting the mic. Mic stays separate.
  const handleExecute = async (openMicAfter = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { matched, cleaned, hadMention } = parseAgentMention(trimmed, agents);
    const targetLabel = matched ? matched.name : "ALL";
    const userLine = `[YOU → ${targetLabel}] ${cleaned}`;

    appendRoutedLog({ agentId: matched?.id ?? null, line: userLine });
    setText("");
    setMention(null);

    if (hadMention && !matched) {
      appendLog(`[J.A.R.V.I.S.] No agent matches — broadcasting to all.`);
    } else {
      appendLog(`[J.A.R.V.I.S.] Routing to ${targetLabel}.`);
    }

    // Mic stays off unless caller explicitly opts in.
    if (openMicAfter && state !== "listening") {
      const ok = await start();
      if (ok) appendLog(`[J.A.R.V.I.S.] Voice channel active.`);
    }
  };

  // Mic buttons live in the footer
  return (
    <div className="flex flex-col gap-1 max-w-[700px] mx-auto w-full relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="@joy status  ·  or just type to broadcast"
            className="w-full px-4 py-3 bg-black/50 border border-hudcss-cyan-dim text-ink font-data text-sm outline-none focus:border-hud-cyan focus:[box-shadow:0_0_16px_var(--cyan-glow)] transition-all"
          />
          {/* Mention dropdown */}
          {mention && mentionMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-panel border border-hudcss-cyan-dim backdrop-blur-xl ar-corners shadow-[0_0_20px_rgba(0,212,255,0.25)]">
              <div className="px-3 py-1 text-[10px] tracking-[0.25em] uppercase text-ink-mute font-data border-b border-hudcss-cyan-faint">
                Mention an agent ({mentionMatches.length})
              </div>
              {mentionMatches.map((a, idx) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={(e) => {
                    // mousedown (not click) so the input doesn't blur first
                    e.preventDefault();
                    selectMention(a);
                  }}
                  className={
                    "w-full text-left px-4 py-2 font-data text-sm flex items-center justify-between hover:bg-hud-cyan/10 transition-colors " +
                    (idx === 0 ? "bg-hud-cyan/5 border-l-2 border-hud-cyan" : "")
                  }
                >
                  <span className="flex items-center gap-2">
                    <span className="text-hud-cyan font-hud tracking-wider text-xs uppercase">
                      {a.name}
                    </span>
                    <span className="text-ink-mute text-[11px]">({a.id})</span>
                  </span>
                  <span className="text-ink-mute text-[11px] uppercase tracking-[0.2em]">
                    →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleExecute(false)}
          className="px-5 py-3 bg-gradient-to-br from-hud-cyan to-[#6366f1] text-white border-0 font-hud font-bold tracking-wider cursor-pointer [box-shadow:0_0_12px_var(--cyan-glow)] hover:translate-y-[-1px] transition-transform"
        >
          SEND
        </button>
        {/* Mic controls — separate from text send */}
        {state !== "listening" ? (
          <button
            type="button"
            onClick={() => void start()}
            className="px-4 py-3 bg-hud-cyan/15 border border-hud-cyan text-hud-cyan font-hud text-xs tracking-wider hover:bg-hud-cyan/25 transition-colors"
            title="Start voice (separate from text)"
          >
            🎙 START
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="px-4 py-3 bg-hud-red/20 border border-hud-red text-hud-red font-hud text-xs tracking-wider animate-pulse-dot"
            title="Stop voice"
          >
            ■ STOP
          </button>
        )}
      </div>
      <div className="flex justify-between text-[11px] font-data tracking-[0.15em] uppercase text-ink-mute">
        <span>
          {state === "listening"
            ? `● LISTENING — ${state}`
            : text.startsWith("@")
              ? "→ @ mention active"
              : "→ broadcast"}
        </span>
        <span className="flex gap-3">
          {errorMessage && (
            <span className="text-hud-red normal-case">{errorMessage}</span>
          )}
          <span className="text-ink-mute">
            Tab / Enter to pick agent
          </span>
        </span>
      </div>
    </div>
  );
}