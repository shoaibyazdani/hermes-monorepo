/**
 * Formatting helpers.
 *
 * Every function here must be deterministic given its input — these run during
 * server render and again on hydration, and a locale- or timezone-dependent
 * result would produce a React hydration mismatch. So: UTC, fixed padding, no
 * `toLocaleString`.
 */

/** ISO-8601 → "HH:MM:SS" in UTC. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/** ISO-8601 → "HH:MM" in UTC. */
export function formatClockShort(iso: string): string {
  return formatClock(iso).slice(0, 5);
}

/** Seconds → "HH:MM:SS", hours uncapped. */
export function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Thousands separators without locale lookup. */
export function formatCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Fixed-decimal number, trimmed of a trailing ".0". */
export function formatMetric(value: number, decimals = 0): string {
  return value.toFixed(decimals);
}

/**
 * Seconds → "MM:SS", or "HH:MM:SS" once past an hour.
 *
 * Used for elapsed-time counters, where minutes are the useful unit and a
 * leading "00:" hour would just be noise.
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh > 0 ? `${String(hh).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Compact "time ago" against a reference instant, e.g. "4m ago".
 *
 * Takes the reference explicitly rather than calling `Date.now()` so it stays
 * deterministic and safe to call during server render.
 */
export function formatAgo(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((nowMs - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
