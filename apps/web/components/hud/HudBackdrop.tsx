/**
 * HudBackdrop — the shared Hermes background treatment.
 *
 * Five stacked layers, all decorative and non-interactive:
 *   1. atmospheric radial lighting
 *   2. coarse technical grid (radially masked so it fades at the edges)
 *   3. fine drifting grid
 *   4. faint dot-matrix grain
 *   5. vignette
 * plus a single slow sweep band.
 *
 * The animated layers are removed entirely under `prefers-reduced-motion`
 * (see globals.css) rather than merely frozen.
 *
 * Rendered once by the shell — never per-page.
 */
export function HudBackdrop() {
  return (
    <div aria-hidden className="hud-backdrop">
      <div className="hud-backdrop__glow" />
      <div className="hud-backdrop__grid" />
      <div className="hud-backdrop__grid hud-backdrop__grid--fine" />
      <div className="hud-backdrop__noise" />
      <div className="hud-backdrop__sweep" />
      <div className="hud-backdrop__vignette" />
    </div>
  );
}
