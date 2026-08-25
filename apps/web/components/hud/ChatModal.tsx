"use client";

import { useEffect, useState } from "react";
import { useVoiceContext } from "../voice/VoiceProvider";

interface ChatModalProps {
  open: boolean;
  agentId: string;
  agentName: string;
  onClose: () => void;
}

export function ChatModal({ open, agentId, agentName, onClose }: ChatModalProps) {
  const { start, stop, state, errorMessage, appendLog, log } = useVoiceContext();
  const [text, setText] = useState("");

  if (!open) return null;

  const handleExecute = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    appendLog(`[YOU> ${agentName.toUpperCase()}] ${trimmed}`);
    setText("");
    if (state !== "listening") {
      const ok = await start();
      if (ok) appendLog(`[J.A.R.V.I.S.] Voice channel active.`);
    }
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="chatModalTitle">HERMES · {agentName.toUpperCase()}</h3>
          <div className="modal-header-actions">
            <button
              className={`modal-mic-btn ${state === "listening" ? "active" : ""}`}
              onClick={() => (state === "listening" ? stop() : void start())}
              title="Start voice with this agent"
              aria-label="Start voice chat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>{state === "listening" ? "Listening" : "Talk"}</span>
            </button>
            <button className="close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>
        <div className="modal-messages" id="chatMessages">
          <div className="message agent">
            Standing by. Use voice or type. The mission is yours.
          </div>
          {log.slice(-10).map((line, i) => (
            <div key={i} className="message agent">
              {line}
            </div>
          ))}
          {errorMessage && (
            <div className="message agent" style={{ color: "var(--red)" }}>
              ⚠ {errorMessage}
            </div>
          )}
        </div>
        <div className="modal-input">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleExecute();
            }}
            placeholder={`Send command to ${agentName}...`}
          />
          <button onClick={() => void handleExecute()}>→</button>
        </div>
      </div>
    </div>
  );
}
