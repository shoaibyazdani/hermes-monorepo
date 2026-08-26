"use client";

import { useRef, useState } from "react";
import { CornerDownLeft, Mic, Square, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import { useConversations } from "./ConversationProvider";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";
import type { Agent } from "@/lib/types";

interface ChatComposerProps {
  agent: Agent;
  onSend: (body: string) => void;
  /** True when this agent is the current voice target. */
  isVoiceTarget: boolean;
  /** Disables input, e.g. while the store is still hydrating. */
  disabled?: boolean;
  /** True while the agent is generating a reply. */
  streaming?: boolean;
  /** Aborts the in-flight run. */
  onStop?: () => void;
  className?: string;
}

/**
 * ChatComposer — the command entry surface for one agent channel.
 *
 * A multi-line textarea so long commands stay readable: Enter sends,
 * Shift+Enter inserts a newline. The mic drives the existing voice engine
 * unchanged; speech is not yet transcribed into this field.
 */
export function ChatComposer({
  agent,
  onSend,
  isVoiceTarget,
  disabled = false,
  streaming = false,
  onStop,
  className,
}: ChatComposerProps) {
  const { state, level, start, stop } = useVoiceContext();
  const { runtimeStatus } = useConversations();
  const liveRuntime = runtimeStatus.live;
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listening = state === "listening";
  const canSend = text.trim().length > 0 && !disabled;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    // Reset the auto-grown height along with the value.
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  return (
    <div className={cn("flex-none", className)}>
      {/* Channel header line */}
      <div className="mb-2 flex items-center gap-2">
        <StatusDot
          tone={isVoiceTarget ? "info" : "neutral"}
          live={isVoiceTarget}
          size="xs"
        />
        <span className="font-hud text-[10px] font-bold uppercase tracking-[0.18em] text-hud-cyan">
          {agent.name}
        </span>
        <span aria-hidden className="text-[10px] text-ink-ghost">
          //
        </span>
        <span
          className={cn(
            "font-hud text-[10px] font-semibold uppercase tracking-[0.18em]",
            streaming ? "text-hud-green" : "text-ink-mute",
          )}
        >
          {streaming
            ? "Generating"
            : isVoiceTarget
              ? "Channel active"
              : "Channel ready"}
        </span>
        {listening && (
          <VoiceWaveform
            level={level}
            animated
            className="ml-auto text-hud-green"
          />
        )}
      </div>

      <div className="flex items-end gap-2">
        <label htmlFor={`composer-${agent.id}`} className="sr-only">
          Message {agent.name}. Enter to send, Shift plus Enter for a new line.
        </label>
        <textarea
          id={`composer-${agent.id}`}
          ref={inputRef}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            // Grow with content up to a cap, then scroll.
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a command…"
          className={cn(
            "clip-hud-sm t-command min-w-0 flex-1 resize-none border border-line bg-surface-inset px-3 py-2",
            "outline-none transition-colors placeholder:text-ink-ghost",
            "focus:border-hud-cyan/60 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />

        <button
          type="button"
          onClick={() => (listening ? stop() : void start())}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : `Talk to ${agent.name}`}
          className={cn(
            "clip-hud-sm flex flex-none items-center gap-1.5 border px-3 py-2 font-hud text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
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
        </button>

        {streaming && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="clip-hud-sm flex flex-none items-center gap-1.5 border border-hud-red/60 bg-hud-red/10 px-3 py-2 font-hud text-[10px] font-semibold uppercase tracking-[0.18em] text-hud-red transition-colors hover:bg-hud-red/20"
          >
            <StopCircle size={13} strokeWidth={1.9} aria-hidden />
            <span className="hidden sm:inline">Stop</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className={cn(
              "clip-hud-sm flex flex-none items-center gap-1.5 border px-3 py-2 font-hud text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
              canSend
                ? "border-hud-cyan/60 bg-hud-cyan/10 text-hud-cyan hover:bg-hud-cyan/20"
                : "cursor-not-allowed border-line-soft text-ink-ghost",
            )}
          >
            <CornerDownLeft size={13} strokeWidth={1.8} aria-hidden />
            <span className="hidden sm:inline">Send</span>
          </button>
        )}
      </div>

      <p className="t-timestamp mt-2">
        Enter sends · Shift+Enter for a new line.{" "}
        {liveRuntime
          ? `${agent.name} is connected to a live model runtime.`
          : `Messages persist locally; ${agent.name} cannot reply until a runtime is attached.`}
      </p>
    </div>
  );
}
