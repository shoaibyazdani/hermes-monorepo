/**
 * 4 L-shaped corner brackets for HUD panel targeting-reticle aesthetic.
 * Uses ::before / ::after + two spans (TR + BL).
 */
export function CornerBrackets() {
  return (
    <>
      {/* TR via span */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1.5 right-1.5 w-[22px] h-[22px] border-t-2 border-r-2 border-hud-cyan [box-shadow:0_0_6px_var(--cyan-glow)]"
      />
      {/* BL via span */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-1.5 left-1.5 w-[22px] h-[22px] border-b-2 border-l-2 border-hud-cyan [box-shadow:0_0_6px_var(--cyan-glow)]"
      />
      {/* TL + BR via CSS pseudo-elements (defined in globals.css) */}
    </>
  );
}
