import { cn } from "@/lib/utils";

const BAR_COUNT = 5;
/** Per-bar animation offsets so the wave reads as travelling, not blinking. */
const BAR_DELAYS = [0, 120, 240, 160, 60];

interface VoiceWaveformProps {
  /** Mic level, 0-1. Scales bar height when `animated` is false. */
  level?: number;
  /** Runs the idle wave animation (used while listening). */
  animated?: boolean;
  className?: string;
}

/**
 * VoiceWaveform — five bars indicating mic activity.
 *
 * While listening, bars animate and their max height tracks the live RMS
 * level. Under `prefers-reduced-motion` the animation is disabled globally,
 * and the level-driven heights still convey that audio is coming in.
 */
export function VoiceWaveform({
  level = 0,
  animated = false,
  className,
}: VoiceWaveformProps) {
  // Floor of 0.22 so the bars never fully collapse and disappear.
  const scale = 0.22 + Math.min(1, Math.max(0, level)) * 0.78;

  return (
    <span
      aria-hidden
      className={cn("flex h-4 items-center gap-[3px]", className)}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-full bg-current",
            animated && "hud-wave-bar",
          )}
          style={{
            height: `${Math.round(6 + scale * 10)}px`,
            animationDelay: animated ? `${BAR_DELAYS[i]}ms` : undefined,
          }}
        />
      ))}
    </span>
  );
}
