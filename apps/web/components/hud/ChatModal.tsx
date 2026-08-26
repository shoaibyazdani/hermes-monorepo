"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { useVoiceContext } from "../voice/VoiceProvider";

interface ChatModalProps {
  open: boolean;
  agentId: string;
  agentName: string;
  onClose: () => void;
}

/**
 * ChatModal — a focused command channel with a single agent.
 *
 * Shows only that agent's routed log plus system-level lines, so opening a
 * second agent does not mix their histories. Persistent conversations land in
 * a later phase; this is the transitional surface.
 */
export function ChatModal({
  open,
  agentId,
  agentName,
  onClose,
}: ChatModalProps) {
  const { start, stop, state, errorMessage, appendLog, appendRoutedLog, routedLog } =
    useVoiceContext();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listening = state === "listening";

  // Close on Escape and focus the input on open.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // This agent's traffic plus system-level lines.
  const messages = routedLog.filter(
    (e) => e.agentId === agentId || e.agentId === null,
  );

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    appendRoutedLog({ agentId, line: `[YOU → ${agentName}] ${trimmed}` });
    appendLog(`[HERMES] Queued for ${agentName}.`);
    setText("");
  };

  return (
    <div
      className="modal-backdrop open"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="chat-modal-title">HERMES · {agentName.toUpperCase()}</h3>
          <div className="modal-header-actions">
            <button
              type="button"
              className={`modal-mic-btn ${listening ? "active" : ""}`}
              onClick={() => (listening ? stop() : void start())}
              aria-pressed={listening}
            >
              {listening ? (
                <Square size={12} strokeWidth={2} aria-hidden />
              ) : (
                <Mic size={14} strokeWidth={1.8} aria-hidden />
              )}
              <span>{listening ? "Stop" : "Talk"}</span>
            </button>
            <button
              type="button"
              className="close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.8} aria-hidden />
            </button>
          </div>
        </div>

        <div className="modal-messages">
          <div className="message agent">
            Standing by. Use voice or type — the mission is yours.
          </div>
          {messages.map((entry, i) => (
            <div
              key={`${entry.agentId ?? "sys"}-${i}`}
              className={
                entry.line.startsWith("[YOU") ? "message user" : "message agent"
              }
            >
              {entry.line}
            </div>
          ))}
          {errorMessage && (
            <div className="message agent" style={{ color: "var(--status-critical)" }}>
              {errorMessage}
            </div>
          )}
        </div>

        <div className="modal-input">
          <label htmlFor="chat-modal-input" className="sr-only">
            Message {agentName}
          </label>
          <input
            id="chat-modal-input"
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Send command to ${agentName}…`}
            autoComplete="off"
          />
          <button type="button" onClick={handleSend} disabled={!text.trim()}>
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
