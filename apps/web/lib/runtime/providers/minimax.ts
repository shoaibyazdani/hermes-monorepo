import {
  classifyError,
  classifyStatus,
  type ModelEvent,
  type ModelProvider,
  type ModelRequest,
} from "./types";

/**
 * MiniMax provider, over the Anthropic Messages protocol.
 *
 * MiniMax exposes an Anthropic-compatible surface at `/v1/messages` — the same
 * shape Cortex hand-rolls. Going direct is what makes real token streaming
 * possible, and it lets each agent's own system prompt reach the model
 * unmodified rather than stacking under Cortex's fixed persona.
 *
 * SERVER ONLY — holds the API key.
 */
export function createMiniMaxProvider(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}): ModelProvider {
  return {
    id: "minimax",
    model: opts.model,
    supportsStreaming: true,

    async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
      // Own timeout, linked to the caller's signal so STOP still wins.
      const timer = new AbortController();
      const onAbort = () => timer.abort();
      request.signal?.addEventListener("abort", onAbort, { once: true });
      const timeout = setTimeout(() => timer.abort(), opts.timeoutMs);

      try {
        const res = await fetch(`${opts.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": opts.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: opts.model,
            max_tokens: request.maxTokens,
            system: request.system,
            messages: request.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stream: true,
            ...(request.tools?.length
              ? {
                  tools: request.tools.map((t) => ({
                    name: t.id,
                    description: t.description,
                    input_schema: t.inputSchema,
                  })),
                }
              : {}),
          }),
          signal: timer.signal,
        });

        if (!res.ok || !res.body) {
          const { code, message } = classifyStatus(res.status);
          // The body may carry provider detail; it is logged, never forwarded.
          console.error("[runtime:minimax] upstream error", {
            status: res.status,
            model: opts.model,
          });
          yield { kind: "error", code, message };
          return;
        }

        yield* readAnthropicStream(res.body);
        yield { kind: "done" };
      } catch (err) {
        const { code, message } = classifyError(err);
        if (code !== "cancelled") {
          console.error("[runtime:minimax] stream failed", {
            model: opts.model,
            code,
          });
        }
        yield { kind: "error", code, message };
      } finally {
        clearTimeout(timeout);
        request.signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}

/**
 * Parse an Anthropic-style SSE stream into normalised events.
 *
 * Only the frames that carry meaning here are handled: text deltas, tool-use
 * blocks and their input deltas. Everything else (ping, message_start,
 * usage) is ignored rather than erroring, so a provider adding new frame
 * types cannot break the stream.
 */
async function* readAnthropicStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<ModelEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let carry = "";

  // Tool-use blocks arrive as a header then incremental JSON fragments.
  const toolBlocks = new Map<
    number,
    { toolCallId: string; toolId: string; json: string }
  >();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      carry += decoder.decode(value, { stream: true });
      const lines = carry.split("\n");
      carry = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        let frame: any;
        try {
          frame = JSON.parse(data);
        } catch {
          continue; // Skip a malformed frame rather than aborting.
        }

        if (frame.type === "content_block_start") {
          const block = frame.content_block;
          if (block?.type === "tool_use") {
            toolBlocks.set(frame.index, {
              toolCallId: block.id ?? `tool-${frame.index}`,
              toolId: block.name ?? "",
              json: "",
            });
          }
          continue;
        }

        if (frame.type === "content_block_delta") {
          const delta = frame.delta;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            yield { kind: "text", text: delta.text };
          } else if (delta?.type === "input_json_delta") {
            const block = toolBlocks.get(frame.index);
            if (block) block.json += delta.partial_json ?? "";
          }
          continue;
        }

        if (frame.type === "content_block_stop") {
          const block = toolBlocks.get(frame.index);
          if (block) {
            toolBlocks.delete(frame.index);
            let input: unknown = {};
            try {
              input = block.json ? JSON.parse(block.json) : {};
            } catch {
              // Malformed tool input: surface it as a call with empty input so
              // the runtime rejects it, rather than guessing at the arguments.
            }
            yield {
              kind: "tool-call",
              toolCallId: block.toolCallId,
              toolId: block.toolId,
              input,
            };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
