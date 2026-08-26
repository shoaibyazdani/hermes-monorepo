import { decodeChunk, type RuntimeEvent } from "./events";
import type { OrchestrationEvent } from "@/lib/orchestration/events";
import type { ModelMessage } from "./providers/types";

/**
 * Everything the stream can carry.
 *
 * Orchestration events travel the same NDJSON channel as runtime events; a
 * consumer branches on `type`. Direct runs emit only runtime events, so an
 * existing handler keeps working unchanged.
 */
export type StreamEvent =
  | RuntimeEvent
  | OrchestrationEvent
  | (RuntimeEvent & { orchestrationId: string; stepId: string });

/**
 * Browser-side runtime client.
 *
 * The only place that speaks to `/api/runtime/*` and the only place that
 * parses the event stream. Components subscribe to typed events; none of them
 * touch `fetch`, chunk boundaries or JSON framing.
 */

export interface ExecuteInput {
  /** "orchestrated" routes through Hermes; anything else is a direct run. */
  mode?: "direct" | "orchestrated";
  agentId: string;
  conversationId: string;
  message: string;
  missionId?: string;
  history?: ModelMessage[];
  missionContext?: string;
  attempt?: number;
}

export interface ExecuteHandle {
  /**
   * Stops the run: aborts locally and tells the server to drop the upstream
   * call. For an orchestration this cancels every delegated run beneath it.
   */
  cancel: () => void;
  /** Resolves when the stream ends, however it ends. */
  done: Promise<void>;
}

export interface PublicRuntimeStatus {
  live: boolean;
  provider: string;
  model: string;
  supportsStreaming: boolean;
}

/** Read runtime status. Falls back to simulation if the check itself fails. */
export async function fetchRuntimeStatus(): Promise<PublicRuntimeStatus> {
  try {
    const res = await fetch("/api/runtime/status");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as PublicRuntimeStatus;
  } catch {
    // Unreachable status endpoint means we cannot claim to be live.
    return {
      live: false,
      provider: "none",
      model: "simulation",
      supportsStreaming: false,
    };
  }
}

/**
 * Execute an agent turn, delivering events as they arrive.
 *
 * Returns immediately with a handle; `onEvent` fires per event. Errors are
 * delivered as `agent.error` events rather than thrown, so a caller has one
 * path to handle instead of two.
 */
export function executeAgentRun(
  input: ExecuteInput,
  onEvent: (event: StreamEvent) => void,
): ExecuteHandle {
  const controller = new AbortController();
  // Captured from the first event so cancellation can reach the server run.
  let runId: string | null = null;
  // Orchestrations are cancelled by id, which stops every delegation too.
  let orchestrationId: string | null = null;
  let cancelled = false;
  // True once the server has reported a terminal event, so the fallback below
  // does not emit a second one.
  let terminal = false;

  const done = (async () => {
    try {
      const res = await fetch("/api/runtime/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onEvent(
          synthesizeError(
            input,
            res.status === 400
              ? "The request was rejected."
              : "The runtime is unavailable.",
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const { events, carry: rest } = decodeChunk(
          decoder.decode(value, { stream: true }),
          carry,
        );
        carry = rest;

        for (const event of events) {
          const e = event as StreamEvent;
          if ("runId" in e && !runId) runId = e.runId;
          if ("orchestrationId" in e && e.orchestrationId) {
            orchestrationId = e.orchestrationId;
          }
          // Either union has its own terminal event.
          if (
            e.type === "run.completed" ||
            e.type === "orchestration.completed" ||
            e.type === "orchestration.failed" ||
            e.type === "orchestration.cancelled"
          ) {
            terminal = true;
          }
          onEvent(e);
        }
      }
    } catch (err) {
      const aborted =
        cancelled ||
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");

      if (aborted) {
        // Aborting the fetch means the server's `run.completed` can never
        // arrive, so the terminal event is synthesized here. Otherwise the
        // message would sit in "generating" indefinitely — which is worse
        // than falsely completing, because it never settles at all.
        onEvent(synthesizeCancelled(input, runId));
      } else {
        onEvent(synthesizeError(input, "The connection to the runtime failed."));
      }
    } finally {
      // A stream that ends without a terminal event (server restart, proxy
      // drop) must still resolve, so emit one if none was seen.
      if (!terminal) {
        onEvent(
          cancelled
            ? synthesizeCancelled(input, runId)
            : synthesizeError(input, "The runtime stream ended unexpectedly."),
        );
      }
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      controller.abort();
      // Best-effort: tell the server to abort upstream too, so a stopped run
      // stops consuming tokens rather than just being ignored. Cancelling an
      // orchestration takes precedence — it stops every delegation as well.
      const body = orchestrationId ? { orchestrationId } : runId ? { runId } : null;
      if (body) {
        void fetch("/api/runtime/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(() => {
          // The run ends when the response stream closes regardless.
        });
      }
    },
    done,
  };
}

/** Terminal event for a run the operator stopped. */
function synthesizeCancelled(
  input: ExecuteInput,
  runId: string | null,
): RuntimeEvent {
  return {
    id: `evt-local-${Date.now()}`,
    timestamp: new Date().toISOString(),
    runId: runId ?? "local",
    agentId: input.agentId,
    conversationId: input.conversationId,
    missionId: input.missionId,
    type: "run.completed",
    payload: { status: "cancelled", durationMs: 0 },
  };
}

/** Build a client-side error event when the stream never started. */
function synthesizeError(input: ExecuteInput, message: string): RuntimeEvent {
  return {
    id: `evt-local-${Date.now()}`,
    timestamp: new Date().toISOString(),
    runId: "local",
    agentId: input.agentId,
    conversationId: input.conversationId,
    missionId: input.missionId,
    type: "agent.error",
    payload: { code: "provider-unavailable", message },
  };
}
