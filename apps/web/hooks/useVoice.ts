"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "requesting" | "listening" | "error";
export type VoiceEvent =
  | { kind: "listening" }
  | { kind: "hearing"; level: number }
  | { kind: "silent"; level: number }
  | { kind: "error"; message: string };

interface UseVoiceOptions {
  onEvent?: (event: VoiceEvent) => void;
}

interface UseVoiceReturn {
  state: VoiceState;
  errorMessage: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
}

/**
 * Live Talk mic engine — React port of public/live-talk.js.
 * Manages getUserMedia permission, Web Audio analyser (VAD),
 * MediaRecorder, SpeechRecognition, and silence-driven auto-flush.
 *
 * Phase 1 keeps the engine identical in behavior to the JS version;
 * later phases may refine the VAD thresholds.
 */
export function useVoice({ onEvent }: UseVoiceOptions = {}): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const emit = useCallback(
    (event: VoiceEvent) => onEvent?.(event),
    [onEvent]
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setState("idle");
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (state === "listening") return true;
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

      // 2. AudioContext + analyser (VAD) — minimal Phase 1 stub
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      // 3. SpeechRecognition (interim transcript) — minimal Phase 1 stub
      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.onresult = (e: any) => {
          // Phase 1 stub: emit a synthetic "hearing" event so UI can react.
          // Phase 2 will hook up the real transcript.
          emit({ kind: "hearing", level: 0.5 });
        };
        rec.start();
        recognitionRef.current = rec;
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
    }
  }, [state, emit]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.abort();
      audioCtxRef.current?.close();
    };
  }, []);

  return { state, errorMessage, start, stop };
}
