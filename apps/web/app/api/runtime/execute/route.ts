import { executeAgent, type AgentRequest } from "@/lib/runtime/agent-runtime";
import { isKnownAgent } from "@/lib/runtime/agents/definitions";
import { encodeEvent } from "@/lib/runtime/events";
import type { ModelMessage } from "@/lib/runtime/providers/types";

export const dynamic = "force-dynamic";
// Node runtime: the providers use fetch streaming and the run manager keeps
// per-process state, neither of which survives edge isolate recycling.
export const runtime = "nodejs";

/** Hard caps on client-supplied context, to bound prompt size and cost. */
const MAX_MESSAGE_CHARS = 8_000;
const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_CHARS = 24_000;
const MAX_MISSION_CONTEXT_CHARS = 2_000;

/**
 * Validate and clamp the request body.
 *
 * Everything here arrives from the browser and is treated as untrusted: the
 * agent id is checked against the server-side registry, ids are type-checked,
 * and all free text is length-capped. Nothing is passed through unexamined.
 */
function parseRequest(body: unknown):
  | { ok: true; value: AgentRequest }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.agentId !== "string" || !isKnownAgent(b.agentId)) {
    // Rejected server-side: the browser does not get to name arbitrary agents.
    return { ok: false, error: "Unknown agent." };
  }
  if (typeof b.conversationId !== "string" || !b.conversationId.trim()) {
    return { ok: false, error: "conversationId is required." };
  }
  if (typeof b.message !== "string" || !b.message.trim()) {
    return { ok: false, error: "message is required." };
  }

  // History: keep only the most recent turns, then trim oldest-first until the
  // character budget fits. Recent context matters more than complete context.
  let history: ModelMessage[] = [];
  if (Array.isArray(b.history)) {
    history = b.history
      .filter(
        (m): m is ModelMessage =>
          typeof m === "object" &&
          m !== null &&
          ((m as ModelMessage).role === "user" ||
            (m as ModelMessage).role === "assistant") &&
          typeof (m as ModelMessage).content === "string",
      )
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_CHARS),
      }));

    let total = history.reduce((n, m) => n + m.content.length, 0);
    while (total > MAX_HISTORY_CHARS && history.length > 1) {
      total -= history[0].content.length;
      history.shift();
    }
  }

  return {
    ok: true,
    value: {
      agentId: b.agentId,
      conversationId: b.conversationId,
      message: b.message.slice(0, MAX_MESSAGE_CHARS),
      missionId:
        typeof b.missionId === "string" && b.missionId ? b.missionId : undefined,
      history,
      missionContext:
        typeof b.missionContext === "string"
          ? b.missionContext.slice(0, MAX_MISSION_CONTEXT_CHARS)
          : undefined,
      attempt:
        typeof b.attempt === "number" && b.attempt > 0
          ? Math.min(Math.floor(b.attempt), 10)
          : 1,
    },
  };
}

/**
 * Execute an agent turn and stream runtime events back.
 *
 * Transport is newline-delimited JSON over a `ReadableStream`. Chosen over SSE
 * because this is a POST — `EventSource` cannot send a body — and over
 * WebSockets because the exchange is one request, one response stream, with no
 * need for a persistent bidirectional channel.
 *
 * All model calls happen here, server-side. Credentials never reach the client.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of executeAgent(parsed.value)) {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        }
      } catch (err) {
        // The generator handles its own failures; reaching here means the
        // stream itself broke. Log server-side, close cleanly client-side.
        console.error("[runtime:route] stream failed", {
          agentId: parsed.value.agentId,
          error: err instanceof Error ? err.message : "unknown",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Prevents proxy buffering, which would defeat streaming end to end.
      "X-Accel-Buffering": "no",
    },
  });
}
