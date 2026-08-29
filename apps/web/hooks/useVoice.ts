"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  VOICE_TRANSCRIPT_EVENT,
  dispatchTranscript,
  type VoiceTranscriptDetail,
} from "@/components/voice/VoiceProvider";

export type VoiceState = "idle" | "requesting" | "listening" | "error";
export type VoiceEvent =
  | { kind: "listening" }
  | { kind: "hearing"; level: number }
  | { kind: "silent"; level: number }
  | { kind: "error"; message: string };

// Re-export so consumers that already import from "@/hooks/useVoice" don't
// have to also import from VoiceProvider. The single source of truth lives
// in VoiceProvider; this is just a convenience pass-through.
export { VOICE_TRANSCRIPT_EVENT };
export type { VoiceTranscriptDetail };

interface UseVoiceOptions {
  onEvent?: (event: VoiceEvent) => void;
}

interface UseVoiceReturn {
  state: VoiceState;
  errorMessage: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
}

// Voice activity detection + silence auto-flush constants — mirror live-talk.js
const VAD_RMS_THRESHOLD = 0.01; // above this RMS = "hearing"
const SILENCE_MS = 1500; // flush pending transcript after 1.5s of silence
const VAD_POLL_MS = 100; // sample analyser every 100ms

/**
 * Live Talk mic engine — React port of public/live-talk.js.
 * Manages getUserMedia permission, Web Audio analyser (VAD/RMS),
 * MediaRecorder, SpeechRecognition, and silence-driven auto-flush.
 *
 * Phase 1 keeps the engine identical in behavior to the JS version;
 * later phases may refine the VAD thresholds.
 */
export function useVoice({ onEvent }: UseVoiceOptions = {}): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronous re-entrancy guard: state only updates after a render,
  // so two rapid clicks could otherwise fire two getUserMedia calls.
  const startInFlightRef = useRef(false);

  // Audio resources — refs so the analyser loop can read them without re-renders.
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // VAD/auto-flush runtime state.
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpokeAtRef = useRef<number>(0);

  const emit = useCallback(
    (event: VoiceEvent) => onEvent?.(event),
    [onEvent]
  );

  const clearVadTimers = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    clearVadTimers();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // already stopped — ignore
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setState("idle");
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    // Re-entrancy guard — checked synchronously before any await.
    if (startInFlightRef.current) return true;
    if (state === "listening") return true;
    startInFlightRef.current = true;
    setState("requesting");
    setErrorMessage(null);

    try {
      // 1. Mic permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      // 2. AudioContext + analyser (VAD/RMS sampling for live-level + auto-flush).
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 3. MediaRecorder — captures the mic stream for downstream pipeline.
      //    Kept silent (no ondataavailable handler) for Phase 1; Phase 2 will
      //    pipe chunks to the STT service. Constructing it now keeps the hook
      //    faithful to the spec ("true live call feel") and reserves the slot.
      const MR = window.MediaRecorder;
      if (MR && typeof MR.isTypeSupported === "function") {
        const mime = MR.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "";
        const recorder = mime ? new MR(stream, { mimeType: mime }) : new MR(stream);
        recorderRef.current = recorder;
        try {
          recorder.start();
        } catch {
          // Some browsers throw if already started — ignore, MediaRecorder is non-fatal.
        }
      }

      // 4. VAD loop: sample RMS from analyser, emit hearing/silent events,
      //    and arm the silence auto-flush timer.
      const buf = new Float32Array(analyser.fftSize);
      lastSpokeAtRef.current = Date.now();
      vadIntervalRef.current = setInterval(() => {
        const a = analyserRef.current;
        if (!a) return;
        a.getFloatTimeDomainData(buf);
        let sumSquares = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = buf[i];
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / buf.length);
        if (rms >= VAD_RMS_THRESHOLD) {
          lastSpokeAtRef.current = Date.now();
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          emit({ kind: "hearing", level: rms });
        } else {
          emit({ kind: "silent", level: rms });
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              // Auto-flush: stop recognition (forces final result emit) and
              // restart it so subsequent speech is captured cleanly.
              const rec = recognitionRef.current;
              if (rec) {
                try {
                  rec.stop();
                } catch {
                  // ignore — stop may throw if not started
                }
                // SpeechRecognition auto-restarts on stop when continuous=true
                // on most engines; explicitly re-start to be safe.
                try {
                  rec.start();
                } catch {
                  // Some browsers refuse immediate restart; ignore.
                }
              }
            }, SILENCE_MS);
          }
        }
      }, VAD_POLL_MS);

      // 5. SpeechRecognition (interim + final transcript) — the engine
            //    fires a `hermes:voice-transcript` CustomEvent on `window` for
            //    each result. ConversationProvider subscribes and routes the
            //    final transcript through `routeCommand` so the agent actually
            //    receives the spoken text.
            const SR =
              (window as any).SpeechRecognition ||
              (window as any).webkitSpeechRecognition;
            if (SR) {
              const rec = new SR();
              rec.continuous = true;
              rec.interimResults = true;
              rec.lang = "en-US";
              /**
               * Accumulated text for the current utterance. Browser SpeechRecognition
               * can emit multiple `result` events per utterance (one per pause /
               * finality boundary). We rebuild the full transcript by concatenating
               * the latest (final OR interim) transcript of every SpeechRecognitionResult
               * in the event.results array — exactly how the Web Speech API spec
               * documents building stable text.
               */
              rec.onresult = (event: any) => {
                let assembled = "";
                let lastIsFinal = false;
                for (let i = 0; i < event.results.length; i++) {
                  const r = event.results[i];
                  // r[0] = best alternative; transcript text comes from .transcript
                  const candidate = r[0]?.transcript ?? "";
                  assembled += candidate;
                  if (r.isFinal) lastIsFinal = true;
                }
                const text = assembled.trim();
                if (!text) return;
                dispatchTranscript({ text, isFinal: lastIsFinal });
              };
              rec.onerror = (e: any) => {
                // Most common: 'no-speech' (silence longer than the SR threshold),
                // 'aborted' (we called abort()), 'audio-capture' (mic issue).
                // 'no-speech' is benign — the silence timer will re-arm.
                if (e?.error === "no-speech" || e?.error === "aborted") return;
                // Real errors surface as state.error + a VoiceEvent so the UI can show it.
                const msg = `Speech recognition error: ${e?.error ?? "unknown"}`;
                setErrorMessage(msg);
                emit({ kind: "error", message: msg });
              };
              rec.onend = () => {
                // Some browsers (Safari) fire onend when continuous SR stops after
                // a long pause. We don't change state here — useVoice.start/stop
                // owns the lifecycle; the listener is just here for completeness.
              };
              try {
                rec.start();
              } catch {
                // Synchronous throw — release resources to avoid a leak.
                stop();
                startInFlightRef.current = false;
                const msg = "Speech recognition failed to start. Reload and retry.";
                setErrorMessage(msg);
                setState("error");
                emit({ kind: "error", message: msg });
                return false;
              }
              recognitionRef.current = rec;
            } else {
              // No SpeechRecognition API in this browser (Firefox / iOS WebView < 14.1).
              // Surface as a state-level error so the UI can prompt the user to type
              // instead of waiting for a transcript that will never come.
              const msg =
                "Speech recognition not supported in this browser. Use the text command line instead.";
              setErrorMessage(msg);
              setState("error");
              emit({ kind: "error", message: msg });
              // Don't return false — the mic / VAD / waveform still works for level
              // indication, the user can keep speaking for show even if SR isn't
              // available. They just need to repeat themselves as text.
            }

            setState("listening");
            emit({ kind: "listening" });
            return true;
    } catch (e: any) {
      const name = e?.name || "";
      let msg = "Microphone blocked";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        msg = "Mic permission denied. Allow in browser settings, then reload.";
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        msg = "No microphone found on this device.";
      } else if (name === "SecurityError" || !window.isSecureContext) {
        msg = "Mic requires HTTPS. Use the secure URL.";
      } else {
        msg = `Mic error: ${e?.message ?? e}`;
      }
      setErrorMessage(msg);
      setState("error");
      emit({ kind: "error", message: msg });
      return false;
    } finally {
      startInFlightRef.current = false;
    }
  }, [state, emit, stop]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount — tear down everything the engine acquired.
      clearVadTimers();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.abort();
      analyserRef.current = null;
      audioCtxRef.current?.close();
    };
  }, []);

  return { state, errorMessage, start, stop };
}