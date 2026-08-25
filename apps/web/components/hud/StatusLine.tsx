"use client";

interface StatusLineProps {
  items: Array<{ label: string; value: string; pulse?: boolean }>;
}

/**
 * Horizontal status strip with optional pulse dot per item.
 */
export function StatusLine({ items }: StatusLineProps) {
  return (
    <div className="flex justify-between font-data text-[11px] text-ink-mute tracking-[0.2em] mt-5 uppercase">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {item.pulse && (
            <span className="w-1.5 h-1.5 rounded-full bg-hud-green [box-shadow:0_0_6px_var(--green)] animate-pulse-dot" />
          )}
          {item.label} {item.value}
        </span>
      ))}
    </div>
  );
}
