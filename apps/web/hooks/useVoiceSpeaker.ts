"use client";

/**
 * useVoiceSpeaker — queue-based TTS playback for live-talk mode.
 *
 * Pattern:
 *   - enqueueSentence(text) → POST /api/tts-stream → MP3 blob → queue for play
 *   - Plays sequentially via HTMLAudioElement (one at a time)
 *   - Pre-loads the next chunk while the current is playing (feels instant)
 *   - User can toggle on/off, stop, or interrupt by clicking mic
 *
 * Why a queue instead of creating new audio elements:
 *   - Browsers cap concurrent audio elements per page (~6-8)
 *   - HTMLAudioElement queue gives us natural play-order without race conditions
 *   - Easier to skip/cancel a specific chunk mid-stream
 *
 * Singleton — only one speaker per page. The hook is a thin wrapper around a
 * module-level queue so multiple components can enqueue without race.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface SentenceChunk {
  /** Stable id so the UI can highlight what's currently playing. */
  id: string;
  /** Original text — for debugging and captioning. */
  text: string;
  /** Cached blob URL — freed when the chunk finishes playing. */
  url: string | null;
  /** Loading / ready / playing / done / failed. */
  status: "pending" | "loading" | "ready" | "playing" | "done" | "failed";
  error?: string;
}

/** Module-level queue. Singleton so multiple components can enqueue safely. */
const queue: SentenceChunk[] = [];
const subscribers = new Set<() => void>();
let activeAudio: HTMLAudioElement | null = null;

function notify() {
  subscribers.forEach((fn) => fn());
}

function setChunk(id: string, patch: Partial<SentenceChunk>) {
  const idx = queue.findIndex((c) => c.id === id);
  if (idx >= 0) queue[idx] = { ...queue[idx], ...patch };
  notify();
}

function chunkById(id: string) {
  return queue.find((c) => c.id === id);
}

async function playNext() {
  // Already playing or queue empty → nothing to do.
  if (activeAudio) return;
  const next = queue.find((c) => c.status === "ready");
  if (!next) return;
  if (!next.url) return;

  setChunk(next.id, { status: "playing" });
  const audio = new Audio(next.url);
  activeAudio = audio;
  audio.onended = () => {
    setChunk(next.id, { status: "done" });
    if (next.url) URL.revokeObjectURL(next.url);
    activeAudio = null;
    notify();
    // Auto-advance.
    playNext();
  };
  audio.onerror = () => {
    setChunk(next.id, { status: "failed", error: "Audio playback error" });
    activeAudio = null;
    notify();
    playNext();
  };
  audio.play().catch((err) => {
    setChunk(next.id, { status: "failed", error: String(err) });
    activeAudio = null;
    notify();
    playNext();
  });
}

export function useVoiceSpeaker() {
  const [enabled, setEnabled] = useState(false);
  const [chunks, setChunks] = useState<SentenceChunk[]>([]);
  const enabledRef = useRef(enabled);
  const seqRef = useRef(0);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      // Stop current playback and clear queue when disabled.
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }
      queue.forEach((c) => {
        if (c.url) URL.revokeObjectURL(c.url);
      });
      queue.length = 0;
      notify();
    }
  }, [enabled]);

  // Subscribe to queue changes for re-render.
  useEffect(() => {
    const sub = () => setChunks([...queue]);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const enqueueSentence = useCallback(async (text: string) => {
    if (!enabledRef.current) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    seqRef.current += 1;
    const id = `tts-${seqRef.current}-${Date.now()}`;
    queue.push({ id, text: trimmed, url: null, status: "loading" });
    notify();

    try {
      const res = await fetch("/api/tts-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        setChunk(id, { status: "failed", error: `HTTP ${res.status}: ${detail.slice(0, 80)}` });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setChunk(id, { status: "ready", url });
      // Kick the queue if nothing is playing.
      playNext();
    } catch (err) {
      setChunk(id, { status: "failed", error: String(err) });
    }
  }, []);

  const stop = useCallback(() => {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    queue.forEach((c) => {
      if (c.url) URL.revokeObjectURL(c.url);
      if (c.status !== "done" && c.status !== "failed") {
        setChunk(c.id, { status: "failed", error: "Interrupted by user" });
      }
    });
    notify();
  }, []);

  const toggle = useCallback(() => {
    setEnabled((v) => !v);
  }, []);

  return {
    enabled,
    toggle,
    enqueueSentence,
    stop,
    chunks,
    /** The currently playing chunk id, or null. */
    nowPlayingId: chunks.find((c) => c.status === "playing")?.id ?? null,
    /** Anything pending in the queue. */
    queueLength: chunks.filter((c) => c.status === "loading" || c.status === "ready" || c.status === "pending").length,
  };
}
