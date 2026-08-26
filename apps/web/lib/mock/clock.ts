/**
 * Reference "now" for the mock scenario.
 *
 * Every fixture timestamp in `lib/mock/*` is expressed relative to this
 * instant, so elapsed times and "x ago" labels read correctly instead of
 * showing months of drift against real wall-clock time.
 *
 * When live data replaces the fixtures, callers switch to `Date.now()` and
 * this constant goes away.
 */
export const MOCK_NOW_ISO = "2026-08-26T15:32:10.000Z";

export function mockNow(): number {
  return new Date(MOCK_NOW_ISO).getTime();
}
