"use client";

/**
 * Always-on CRT scan-line — drifts top→bottom over 8s.
 * pointer-events: none so it never blocks clicks.
 */
export function ScanLine() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[5] h-[60px] bg-scan-line animate-scan-line"
    />
  );
}
