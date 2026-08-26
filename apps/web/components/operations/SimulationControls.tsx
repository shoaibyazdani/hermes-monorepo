"use client";

import { Pause, Play, RotateCcw, SkipForward, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hud/StatusDot";
import { useOperations } from "./OperationsProvider";

interface SimulationControlsProps {
  className?: string;
  /** Hides the transport buttons, leaving only the source indicator. */
  indicatorOnly?: boolean;
}

/**
 * SimulationControls — the data-source indicator and scenario transport.
 *
 * The indicator is the honest part: while the runtime reports `live: false`
 * this says SIMULATION, so nothing on the operational screens can be mistaken
 * for a real feed. When a live runtime is attached the same control flips to
 * LIVE with no other change.
 *
 * The transport exists because the scenario is deterministic — play, step and
 * reset replay exactly the same sequence, which is what makes it useful for
 * demonstrating the system without pretending it is running.
 */
export function SimulationControls({
  className,
  indicatorOnly = false,
}: SimulationControlsProps) {
  const {
    live,
    playing,
    play,
    pause,
    reset,
    stepForward,
    step,
    totalSteps,
    cancelSimulation,
    simulationCancelled,
  } = useOperations();

  const atEnd = step >= totalSteps;
  // Cancelling only makes sense while a simulated orchestration is running.
  const canCancel = !live && !simulationCancelled && step > 0 && !atEnd;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Source indicator */}
      <span
        className={cn(
          "clip-hud-sm flex flex-none items-center gap-1.5 border px-2 py-0.5",
          live
            ? "border-hud-green/50 bg-hud-green/10"
            : "border-hud-amber/40 bg-hud-amber/[0.07]",
        )}
        title={
          live
            ? "Connected to a live operations feed"
            : "Deterministic simulated scenario — not a live feed"
        }
      >
        <StatusDot
          tone={live ? "active" : "warn"}
          live={live || playing}
          size="xs"
        />
        <span
          className={cn(
            "font-hud text-[9px] font-bold uppercase tracking-[0.18em]",
            live ? "text-hud-green" : "text-hud-amber",
          )}
        >
          {live ? "Live" : "Simulation"}
        </span>
      </span>

      {!indicatorOnly && (
        <>
          <span className="t-timestamp flex-none tabular-nums">
            {step}/{totalSteps}
          </span>

          <div className="flex flex-none gap-1" role="group" aria-label="Scenario playback">
            <TransportButton
              onClick={playing ? pause : play}
              label={playing ? "Pause scenario" : "Play scenario"}
            >
              {playing ? (
                <Pause size={11} strokeWidth={2} aria-hidden />
              ) : (
                <Play size={11} strokeWidth={2} aria-hidden />
              )}
              <span className="hidden sm:inline">
                {playing ? "Pause" : atEnd ? "Replay" : "Play"}
              </span>
            </TransportButton>

            <TransportButton
              onClick={stepForward}
              label="Advance one step"
              disabled={atEnd}
            >
              <SkipForward size={11} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">Step</span>
            </TransportButton>

            {canCancel && (
              <TransportButton
                onClick={cancelSimulation}
                label="Cancel simulated orchestration"
              >
                <Square size={11} strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">Cancel</span>
              </TransportButton>
            )}

            <TransportButton onClick={reset} label="Reset scenario">
              <RotateCcw size={11} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">Reset</span>
            </TransportButton>
          </div>
        </>
      )}
    </div>
  );
}

function TransportButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "clip-hud-sm flex items-center gap-1 border px-2 py-1 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] transition-colors",
        disabled
          ? "cursor-not-allowed border-line-soft text-ink-ghost"
          : "border-line text-ink-mute hover:border-hud-cyan/50 hover:text-hud-cyan",
      )}
    >
      {children}
    </button>
  );
}
