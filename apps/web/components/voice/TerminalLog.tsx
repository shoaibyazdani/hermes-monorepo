"use client";

import { useVoiceContext } from "./VoiceProvider";

export function TerminalLog() {
  const { log } = useVoiceContext();

  return (
    <div className="font-data text-hud-cyan text-[13px] p-2 px-3 bg-black/30 border-l-2 border-hud-cyan [box-shadow:inset_0_0_12px_rgba(0,217,255,0.05)] min-h-[60px]">
      {log.map((line, i) => (
        <div key={i} className="leading-relaxed">
          {line}
        </div>
      ))}
      {log.length === 0 && (
        <div className="text-ink-mute">[Awaiting output...]</div>
      )}
    </div>
  );
}
