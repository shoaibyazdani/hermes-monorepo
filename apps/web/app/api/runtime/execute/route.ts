import { executeAgent, type AgentRequest } from "@/lib/runtime/agent-runtime";
import { isKnownAgent } from "@/lib/runtime/agents/definitions";
import { encodeEvent } from "@/lib/runtime/events";
import {
  executeOrchestration,
  type OrchestrationRequest,
} from "@/lib/orchestration/orchestrator";
import {
  type ContentBlock,
  type ModelMessage,
} from "@/lib/runtime/providers/types";

export const dynamic = "force-dynamic";
// Node runtime: the providers use fetch streaming and the run manager keeps
// per-process state, neither of which survives edge isolate recycling.
export const runtime = "nodejs";

/** Hard caps on client-supplied context, to bound prompt size and cost. */
const MAX_MESSAGE_CHARS = 8_000;
const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_CHARS = 24_000;
const MAX_MISSION_CONTEXT_CHARS = 2_000;
/** Per-image cap: ~5MB after base64 (≈3.75MB raw). Anthropic's hard limit is 5MB. */
const MAX_IMAGE_BYTES = 5_000_000;
/** Max images per message. Real screenshots / receipts usually need 1-2. */
const MAX_IMAGES_PER_MESSAGE = 4;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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

/**
 * Validate a single attachment from the request body.
 *
 * The browser sends `{ mediaType, data }` per image. We re-check the type
 * whitelist, the byte size, and the data: prefix (strips it). Returns
 * either a `ContentBlock` ready for the runtime or an error string.
 */
function validateAttachment(raw: unknown):
  | { ok: true; block: ContentBlock }
  | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Attachment must be an object." };
  }
  const a = raw as Record<string, unknown>;
  const mediaType = a.mediaType;
  const data = a.data;
  if (typeof mediaType !== "string" || !ALLOWED_IMAGE_TYPES.has(mediaType)) {
    return {
      ok: false,
      error: `Unsupported image type ${String(mediaType)}. Allowed: ${[...ALLOWED_IMAGE_TYPES].join(", ")}.`,
    };
  }
  if (typeof data !== "string") {
    return { ok: false, error: "Attachment data must be a base64 string." };
  }
  // Browser may send "data:image/jpeg;base64,..." — strip the prefix.
  const cleaned = data.replace(/^data:[^;]+;base64,/, "");
  // Approx bytes: 3/4 of base64 length (minus padding)
  const approxBytes = Math.floor((cleaned.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image too large (${Math.round(approxBytes / 1024)}KB > ${MAX_IMAGE_BYTES / 1024}KB limit).`,
    };
  }
  return {
    ok: true,
    block: {
      type: "image",
      mediaType: mediaType as ContentBlock extends { mediaType: infer M } ? M : never,
      data: cleaned,
    },
  };
}
function buildMessageContent(
  text: string,
  attachments: unknown[],
): string | ContentBlock[] {
  // If `attachments` is empty, return a plain string (cheaper to wire, faster
  // to render). Otherwise compose `[text, image, image, ...]` so the model
  // sees the user's text + their screenshots in one turn.
  if (attachments.length === 0) return text.slice(0, MAX_MESSAGE_CHARS);
  const blocks: ContentBlock[] = [
    { type: "text", text: text.slice(0, MAX_MESSAGE_CHARS) },
  ];
  for (const a of attachments) {
    const r = validateAttachment(a);
    if (r.ok) blocks.push(r.block);
    // If invalid, skip with server log — we already validate up front so
    // this branch should be rare.
  }
  return blocks;
}

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

  // Attachments: optional array of { mediaType, data }. Validate up-front so
  // the runtime never sees malformed images.
  let attachments: ContentBlock[] = [];
  if (Array.isArray(b.attachments)) {
    if (b.attachments.length > MAX_IMAGES_PER_MESSAGE) {
      return {
        ok: false,
        error: `Too many attachments (${b.attachments.length} > ${MAX_IMAGES_PER_MESSAGE}).`,
      };
    }
    for (const raw of b.attachments) {
      const r = validateAttachment(raw);
      if (!r.ok) return { ok: false, error: r.error };
      attachments.push(r.block);
    }
  }
  const messageContent = buildMessageContent(
    b.message,
    Array.isArray(b.attachments) ? b.attachments : [],
  );

  // Orchestration is always Hermes; the browser does not choose an
  // orchestrator, so there is nothing to validate beyond the mode itself.
  if (mode === "direct" && (typeof b.agentId !== "string" || !isKnownAgent(b.agentId))) {
    // Rejected server-side: the browser does not get to name arbitrary agents.
    return { ok: false, error: "Unknown agent." };
  }

  // History: keep only the most recent turns, then trim oldest-first until the
  // character budget fits. Recent context matters more than complete context.
  // History is text-only — multimodal attachments only apply to the current turn,
  // not to past turns (which the runtime stores as text).
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
    // Orchestrator wants a plain text message + text-only history. Force
    // history's content to string (we already filtered to string-only above
    // via the type guard).
    const textHistory: Array<{ role: "user" | "assistant"; content: string }> =
      history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content : "",
      }));
    return {
      ok: true,
      mode: "orchestrated",
      value: {
        conversationId: b.conversationId,
        message:
          typeof messageContent === "string"
            ? messageContent
            : // Orchestrator gets the text only; image analysis is delegated
              // to a sub-agent if needed. Keeping the orchestrator text-only
              // avoids 200K of base64 flooding the planner prompt.
              b.message.slice(0, MAX_MESSAGE_CHARS),
        missionId:
          typeof b.missionId === "string" && b.missionId
            ? b.missionId
            : undefined,
        history: textHistory,
      },
    };
  }

  return {
    ok: true,
    mode: "direct",
    value: {
      agentId: b.agentId as string,
      conversationId: b.conversationId,
      // Pass the structured content (text + image blocks) through to the
      // runtime. The runtime prepends the user's text message to the
      // conversation history.
      message: messageContent,
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
