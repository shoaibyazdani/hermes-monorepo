import {
  classifyError,
  classifyStatus,
  type ModelEvent,
  type ModelProvider,
  type ModelRequest,
} from "./types";

/**
 * Cortex provider — the existing Express service on port 7833.
 *
 * Useful because it already holds working credentials, so this app can talk to
 * a real model with nothing in its own environment. Two limitations are
 * inherent to what Cortex is, and are surfaced honestly rather than papered
 * over:
 *
 *   1. No streaming. `/api/chat` returns one buffered JSON body, so the whole
 *      reply arrives at once. It is emitted as a single text event; the UI
 *      still renders it through the streaming path, but the first token waits
 *      for the last.
 *   2. A fixed system prompt. Cortex injects its own "You are Cortex…" persona
 *      server-side and ignores any system field. The agent's identity is
 *      therefore folded into the message body — a compromise, not a fix. Use
 *      the MiniMax provider when per-agent identity matters.
 *
 * Tools are not offered: Cortex never forwards a `tools` field upstream, so
 * advertising them would invite calls that cannot be made.
 */
export function createCortexProvider(opts: {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}): ModelProvider {
  return {
    id: "cortex",
    model: opts.model,
    supportsStreaming: false,

    async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
      const timer = new AbortController();
      const onAbort = () => timer.abort();
      request.signal?.addEventListener("abort", onAbort, { once: true });
      const timeout = setTimeout(() => timer.abort(), opts.timeoutMs);

      try {
        // Cortex takes a single `message` string and discards `system`, so the
        // agent identity and prior turns are flattened into that one field.
        const history = request.messages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n\n");

        const composed = [
          `[Agent identity]\n${request.system}`,
          `[Conversation]\n${history}`,
        ].join("\n\n");

        const res = await fetch(`${opts.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: composed }),
          signal: timer.signal,
        });

        if (!res.ok) {
          const { code, message } = classifyStatus(res.status);
          console.error("[runtime:cortex] upstream error", {
            status: res.status,
          });
          yield { kind: "error", code, message };
          return;
        }

        const data = (await res.json()) as { reply?: unknown; mode?: unknown };

        if (typeof data.reply !== "string" || !data.reply.trim()) {
          console.error("[runtime:cortex] malformed response shape");
          yield {
            kind: "error",
            code: "malformed",
            message: "The model returned an unreadable response.",
          };
          return;
        }

        // Cortex answers `mode: "fallback"` when its own key is missing and it
        // is echoing input back. That is not a real completion, so it is
        // reported as unavailable rather than presented as an agent reply.
        if (data.mode === "fallback") {
          console.warn("[runtime:cortex] upstream reported fallback mode");
          yield {
            kind: "error",
            code: "unavailable",
            message: "The upstream model is not configured.",
          };
          return;
        }

        yield { kind: "text", text: data.reply };
        yield { kind: "done" };
      } catch (err) {
        const { code, message } = classifyError(err);
        if (code !== "cancelled") {
          console.error("[runtime:cortex] request failed", { code });
        }
        yield { kind: "error", code, message };
      } finally {
        clearTimeout(timeout);
        request.signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
