import { executeAgent, type AgentRequest } from "@/lib/runtime/agent-runtime";
import { isKnownAgent } from "@/lib/runtime/agents/definitions";
import { encodeEvent } from "@/lib/runtime/events";
import {
  executeOrchestration,
  type OrchestrationRequest,
} from "@/lib/orchestration/orchestrator";
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
type ParsedRequest =
  | { ok: true; mode: "direct"; value: AgentRequest }
  | { ok: true; mode: "orchestrated"; value: OrchestrationRequest }
  | { ok: false; error: string };

function parseRequest(body: unknown): ParsedRequest {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request." };
  }
  const b = body as Record<string, unknown>;

  // Mode selects the execution path. Anything unrecognised is a direct run,
  // so an older client that sends no mode keeps working unchanged.
  const mode = b.mode === "orchestrated" ? "orchestrated" : "direct";

  if (typeof b.conversationId !== "string" || !b.conversationId.trim()) {
    return { ok: false, error: "conversationId is required." };
  }
  if (typeof b.message !== "string" || !b.message.trim()) {
    return { ok: false, error: "message is required." };
  }
  // Orchestration is always Hermes; the browser does not choose an
  // orchestrator, so there is nothing to validate beyond the mode itself.
  if (mode === "direct" && (typeof b.agentId !== "string" || !isKnownAgent(b.agentId))) {
    // Rejected server-side: the browser does not get to name arbitrary agents.
    return { ok: false, error: "Unknown agent." };
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

  if (mode === "orchestrated") {
    return {
      ok: true,
      mode: "orchestrated",
      value: {
        conversationId: b.conversationId,
        message: b.message.slice(0, MAX_MESSAGE_CHARS),
        missionId:
          typeof b.missionId === "string" && b.missionId
            ? b.missionId
            : undefined,
        history,
      },
    };
  }

  return {
    ok: true,
    mode: "direct",
    value: {
      agentId: b.agentId as string,
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
        // Both paths emit NDJSON on the same stream; the client branches on
        // `type`, so orchestration events and runtime events interleave
        // without a second transport.
        const source =
          parsed.mode === "orchestrated"
            ? executeOrchestration(parsed.value)
            : executeAgent(parsed.value);

        for await (const event of source) {
          controller.enqueue(encoder.encode(encodeEvent(event as never)));
        }
      } catch (err) {
        // The generator handles its own failures; reaching here means the
        // stream itself broke. Log server-side, close cleanly client-side.
        console.error("[runtime:route] stream failed", {
          mode: parsed.mode,
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
