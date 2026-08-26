/**
 * Runtime event protocol.
 *
 * The wire contract between the server-side agent runtime and the browser.
 * A discriminated union rather than `{ type: string }` so exhaustive handling
 * is checked at compile time and a new event type cannot be silently ignored.
 *
 * Deliberately shaped to survive multi-agent orchestration: every event
 * carries `runId`, `agentId` and `conversationId`, so interleaved streams from
 * concurrent runs can be demultiplexed by the client without extra framing.
 */

export type RuntimeEventType =
  | "run.started"
  | "agent.thinking"
  | "message.started"
  | "message.delta"
  | "message.completed"
  | "tool.started"
  | "tool.input"
  | "tool.output"
  | "tool.completed"
  | "agent.waiting"
  | "agent.completed"
  | "agent.error"
  | "run.completed";

/** Fields every runtime event carries. */
interface RuntimeEventBase {
  id: string;
  timestamp: string;
  runId: string;
  agentId: string;
  conversationId: string;
  missionId?: string;
}

export type RunStatus =
  | "queued"
  | "running"
  | "waiting-tool"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Error categories.
 *
 * Deliberately coarse: these reach the browser, so they must not leak provider
 * internals, keys or stack traces. The detailed cause is logged server-side
 * against the `runId`.
 */
export type RuntimeErrorCode =
  | "provider-unavailable"
  | "provider-auth"
  | "provider-rate-limit"
  | "provider-timeout"
  | "provider-malformed"
  | "tool-not-authorized"
  | "tool-failed"
  | "cancelled"
  | "internal";

export type RuntimeEvent =
  | (RuntimeEventBase & {
      type: "run.started";
      payload: { provider: string; model: string };
    })
  | (RuntimeEventBase & {
      type: "agent.thinking";
      payload: { note?: string };
    })
  | (RuntimeEventBase & {
      type: "message.started";
      /** The assistant message the deltas will accumulate into. */
      payload: { messageId: string };
    })
  | (RuntimeEventBase & {
      type: "message.delta";
      /** A text fragment appended to `messageId`. Never a whole message. */
      payload: { messageId: string; text: string };
    })
  | (RuntimeEventBase & {
      type: "message.completed";
      payload: { messageId: string; text: string };
    })
  | (RuntimeEventBase & {
      type: "tool.started";
      payload: { toolCallId: string; toolId: string; toolName: string };
    })
  | (RuntimeEventBase & {
      type: "tool.input";
      payload: { toolCallId: string; toolId: string; input: unknown };
    })
  | (RuntimeEventBase & {
      type: "tool.output";
      payload: { toolCallId: string; toolId: string; output: unknown };
    })
  | (RuntimeEventBase & {
      type: "tool.completed";
      payload: {
        toolCallId: string;
        toolId: string;
        ok: boolean;
        durationMs: number;
        /** Safe summary for display. Never raw internals. */
        summary?: string;
      };
    })
  | (RuntimeEventBase & {
      type: "agent.waiting";
      payload: { reason: string };
    })
  | (RuntimeEventBase & {
      type: "agent.completed";
      payload: Record<string, never>;
    })
  | (RuntimeEventBase & {
      type: "agent.error";
      payload: { code: RuntimeErrorCode; message: string };
    })
  | (RuntimeEventBase & {
      type: "run.completed";
      payload: { status: RunStatus; durationMs: number };
    });

/** Narrow a runtime event to one variant. */
export function isEvent<T extends RuntimeEventType>(
  event: RuntimeEvent,
  type: T,
): event is Extract<RuntimeEvent, { type: T }> {
  return event.type === type;
}

/* ── Wire encoding ───────────────────────────────────────────────────────── */

/**
 * Newline-delimited JSON.
 *
 * Chosen over SSE because the transport is a plain `fetch` POST returning a
 * `ReadableStream`: SSE's `EventSource` cannot POST, and its framing would add
 * nothing here. One JSON object per line is trivially parseable and survives
 * chunk boundaries when the reader buffers partial lines.
 */
export function encodeEvent(event: RuntimeEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Decode a chunk into whole events, returning any trailing partial line.
 *
 * Chunk boundaries do not respect line boundaries, so the caller must carry
 * the remainder into the next call.
 */
export function decodeChunk(
  chunk: string,
  carry: string,
): { events: RuntimeEvent[]; carry: string } {
  const buffer = carry + chunk;
  const lines = buffer.split("\n");
  // The last element is either "" (clean break) or a partial line.
  const rest = lines.pop() ?? "";
  const events: RuntimeEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as RuntimeEvent);
    } catch {
      // A malformed line is dropped rather than aborting the stream: one bad
      // frame should not lose the events that follow it.
    }
  }

  return { events, carry: rest };
}
