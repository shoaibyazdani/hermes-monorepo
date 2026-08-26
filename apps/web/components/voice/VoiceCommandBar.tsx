"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import type { StatusTone, VoicePhase } from "@/lib/types";
import { useVoiceContext, type Agent } from "./VoiceProvider";
import { useConversations } from "@/components/chat/ConversationProvider";
import { VoiceWaveform } from "./VoiceWaveform";

/**
 * Presentation for each voice phase.
 *
 * `processing` and `speaking` are reachable through `setPhase` but nothing
 * drives them yet — the transcription pipeline in a later phase will. They are
 * defined now so the bar needs no changes when that lands.
 */
const PHASE_UI: Record<
  VoicePhase,
  { label: string; hint: string; tone: StatusTone; live: boolean }
> = {
  idle: {
    label: "SAY SOMETHING…",
    hint: 'Say "Apex…" to command an agent',
    tone: "neutral",
    live: false,
  },
  requesting: {
    label: "OPENING CHANNEL",
    hint: "Requesting microphone…",
    tone: "info",
    live: true,
  },
  listening: {
    label: "LISTENING",
    hint: "Listening for command…",
    tone: "active",
    live: true,
  },
  processing: {
    label: "PROCESSING",
    hint: "Interpreting command…",
    tone: "info",
    live: true,
  },
  speaking: {
    label: "RESPONSE",
    hint: "Hermes is responding…",
    tone: "info",
    live: true,
  },
  error: {
    label: "CHANNEL ERROR",
    hint: "Voice channel unavailable",
    tone: "critical",
    live: false,
  },
};

/**
 * Suggested commands shown while the channel is idle.
 *
 * Selecting one populates the command line rather than dispatching it: there
 * is no agent runtime to receive a command yet, and silently "running" one
 * would imply behaviour that does not exist.
 */
const QUICK_COMMANDS = [
  "Ask Apex",
  "Check missions",
  "System status",
  "What's everyone doing?",
  "Show active tasks",
];

/**
 * VoiceCommandBar — the persistent command interface at the base of the shell.
 *
 * Carries the mic control, the state readout, the target indicator and the
 * text command line with @-mention routing. The mic is deliberately separate
 * from the text send: typing a command never opens the microphone.
 *
 * Routing today is display-only — the resolved target is shown and logged, but
 * commands are not dispatched to an agent runtime. That is a later phase; the
 * target is already threaded through context so it will not need re-plumbing.
 */
export function VoiceCommandBar() {
  const {
    start,
    stop,
    state,
    phase,
    level,
    errorMessage,
    appendRoutedLog,
    appendLog,
    agents,
    activeAgentId,
    setActiveAgentId,
    target,
  } = useVoiceContext();
  const { routeCommand } = useConversations();

  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  /** Caret position to restore once React commits a programmatic text change. */
  const pendingCaretRef = useRef<number | null>(null);
  const listboxId = "voice-mention-options";

  // Active @-mention being typed (cursor inside the @token).
  const [mention, setMention] = useState<{
    startIdx: number;
    endIdx: number;
    partial: string;
  } | null>(null);
  const [highlight, setHighlight] = useState(0);

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

  // Keep the highlighted option in range as the filter narrows.
  useEffect(() => setHighlight(0), [mention?.partial]);

  // Restore the caret after a mention completion rewrites the input value.
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [text]);

  const ui = PHASE_UI[phase];
  const listening = state === "listening";

  /** Walk back from the caret to find an unmatched, whitespace-preceded "@". */
  const updateMention = (newText: string, caret: number) => {
    let i = caret - 1;
    while (i >= 0) {
      const ch = newText[i];
      if (ch === "@") {
        const prev = i > 0 ? newText[i - 1] : " ";
        if (/\s/.test(prev) || i === 0) {
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
    setText(before + insertion + after);
    setMention(null);
    setActiveAgentId(agent.id);
    // Defer the caret move to the layout effect below: React has not committed
    // the new value yet, so setting selection here would be overwritten and
    // the caret would snap back to the start of the input.
    pendingCaretRef.current = (before + insertion).length;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight(
          (h) => (h - 1 + mentionMatches.length) % mentionMatches.length,
        );
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        selectMention(mentionMatches[highlight] ?? mentionMatches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  /**
   * Load a suggestion into the command line and focus it.
   *
   * Deliberately does not send: no agent runtime exists to receive a command,
   * and auto-sending would fake a response the system cannot produce. The
   * operator reviews and presses Enter.
   */
  const applyQuickCommand = (command: string) => {
    const prefix = activeAgentId ? `@${target.label} ` : "";
    const next = `${prefix}${command}`;
    setText(next);
    setMention(null);
    pendingCaretRef.current = next.length;
  };

  /**
   * Send the text command through the shared command pipeline.
   *
   * Parsing, agent resolution, target selection, conversation resolution,
   * message creation and the runtime hand-off all live in `routeCommand`, so
   * this component only collects input and reports the outcome. A voice
   * transcript will call the same function with the same string.
   *
   * Never opens the mic — that control is deliberately separate.
   */
  const handleExecute = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setText("");
    setMention(null);

    void (async () => {
      const result = await routeCommand(trimmed, agents, activeAgentId);

      if (result.agentId) {
        setActiveAgentId(result.agentId);
      }

      const label = result.agentId
        ? (agents.find((a) => a.id === result.agentId)?.name ??
          result.agentId.toUpperCase())
        : "HERMES";

      if (result.unresolvedMention) {
        appendLog(
          `[HERMES] No agent matches "${result.unresolvedMention}" — routing to ${label}.`,
        );
      }

      if (result.switchedTarget) {
        appendLog(`[HERMES] Voice target switched to ${label}.`);
      }

      if (!result.message) {
        // An address with no body only re-targets; nothing was sent.
        appendLog(`[HERMES] Target set to ${label}.`);
        return;
      }

      appendRoutedLog({
        agentId: result.agentId,
        line: `[YOU → ${label}] ${result.message}`,
      });

      if (!result.agentId) {
        // No target and no address: a global command, not an agent message.
        appendLog("[HERMES] Global command — no agent targeted.");
        return;
      }

      appendLog(
        result.runtimeReason
          ? `[HERMES] ${label} channel — ${result.runtimeReason}.`
          : `[HERMES] Routing to ${label}.`,
      );
    })();
  };

  return (
    <div className="relative z-20 flex-none border-t border-line bg-surface-deep/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:px-4 md:flex-row md:items-center md:gap-3">
        {/* State readout — the primary status of the voice channel. */}
        <div className="flex min-w-0 flex-none items-center gap-2.5 md:w-[220px]">
          <StatusDot tone={ui.tone} live={ui.live} size="sm" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              {/* Target prefix, e.g. "APEX // LISTENING" */}
              {activeAgentId && (
                <>
                  <span className="font-hud text-[11px] font-bold uppercase tracking-[0.18em] text-hud-cyan">
                    {target.label}
                  </span>
                  <span aria-hidden className="text-[11px] text-ink-ghost">
                    //
                  </span>
                </>
              )}
              <span
                className={cn(
                  "truncate font-hud text-[11px] font-semibold uppercase tracking-[0.18em]",
                  phase === "error" ? "text-hud-red" : "text-ink-mute",
                )}
                role="status"
              >
                {ui.label}
              </span>
            </div>
            <p className="t-timestamp mt-0.5 truncate">
              {activeAgentId
                ? listening
                  ? "Voice channel active"
                  : `Targeting ${target.label}`
                : ui.hint}
            </p>
          </div>
          {listening && (
            <VoiceWaveform
              level={level}
              animated
              className="ml-auto flex-none text-hud-green md:ml-0"
            />
          )}
        </div>

        {/* Command line */}
        <div className="relative min-w-0 flex-1">
          <label htmlFor="hermes-command" className="sr-only">
            Command input — prefix with @ to target an agent
          </label>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                id="hermes-command"
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => setMention(null)}
                placeholder="@apex investigate the login failure"
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={Boolean(mention && mentionMatches.length > 0)}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  mention && mentionMatches[highlight]
                    ? `mention-${mentionMatches[highlight].id}`
                    : undefined
                }
                className={cn(
                  "clip-hud-sm w-full border border-line bg-surface-inset px-3 py-2",
                  "t-command placeholder:text-ink-ghost",
                  "outline-none transition-colors duration-[var(--dur-fast)]",
                  "focus:border-hud-cyan/60",
                )}
              />

              {mention && mentionMatches.length > 0 && (
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label="Agents"
                  className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-56 overflow-y-auto border border-line bg-surface-raised shadow-raised backdrop-blur-xl"
                >
                  <li
                    className="t-label border-b border-line-soft px-3 py-1.5"
                    aria-hidden
                  >
                    Target agent ({mentionMatches.length})
                  </li>
                  {mentionMatches.map((a, idx) => (
                    <li key={a.id} role="none">
                      <button
                        id={`mention-${a.id}`}
                        role="option"
                        aria-selected={idx === highlight}
                        type="button"
                        // mousedown, not click — the input must not blur first.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectMention(a);
                        }}
                        onMouseEnter={() => setHighlight(idx)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors",
                          idx === highlight
                            ? "border-l-2 border-l-hud-cyan bg-hud-cyan/10"
                            : "border-l-2 border-l-transparent",
                        )}
                      >
                        <span className="font-hud text-[11px] font-semibold uppercase tracking-[0.16em] text-hud-cyan">
                          {a.name}
                        </span>
                        <span className="t-timestamp">{a.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={handleExecute}
              disabled={!text.trim()}
              className={cn(
                "clip-hud-sm flex flex-none items-center gap-1.5 border px-3 py-2 transition-colors",
                "font-hud text-[10px] font-semibold uppercase tracking-[0.18em]",
                text.trim()
                  ? "border-hud-cyan/60 bg-hud-cyan/10 text-hud-cyan hover:bg-hud-cyan/20"
                  : "cursor-not-allowed border-line-soft text-ink-ghost",
              )}
            >
              <CornerDownLeft size={13} strokeWidth={1.8} aria-hidden />
              <span className="hidden sm:inline">Send</span>
            </button>

            {/* Mic — independent of the text channel */}
            <button
              type="button"
              onClick={() => (listening ? stop() : void start())}
              aria-pressed={listening}
              className={cn(
                "clip-hud-sm flex flex-none items-center gap-1.5 border px-3 py-2 transition-colors",
                "font-hud text-[10px] font-semibold uppercase tracking-[0.18em]",
                listening
                  ? "border-hud-red/60 bg-hud-red/10 text-hud-red hover:bg-hud-red/20"
                  : "border-line text-ink-mute hover:border-hud-cyan/60 hover:text-hud-cyan",
              )}
            >
              {listening ? (
                <Square size={12} strokeWidth={2} aria-hidden />
              ) : (
                <Mic size={13} strokeWidth={1.8} aria-hidden />
              )}
              <span className="hidden sm:inline">
                {listening ? "Stop" : "Talk"}
              </span>
            </button>
          </div>

          {/* Quick commands — only while the line is empty, so they never
              compete with something the operator is mid-way through typing. */}
          {!text && !listening && (
            <ul className="mt-2 hidden flex-wrap gap-1.5 lg:flex">
              {QUICK_COMMANDS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => applyQuickCommand(q)}
                    className="clip-hud-sm border border-line-soft px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-faint transition-colors hover:border-hud-cyan/40 hover:text-hud-cyan"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="border-t border-hud-red/30 bg-hud-red/[0.06] px-4 py-1.5 font-data text-[11px] text-hud-red"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
