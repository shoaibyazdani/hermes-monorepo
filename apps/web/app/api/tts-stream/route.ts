/**
 * /api/tts-stream — ElevenLabs text-to-speech for live-talk mode.
 *
 * POST { text, voice? } → audio/mpeg binary
 *
 * Used by ConversationProvider + useVoiceSpeaker in the browser:
 *   - Each complete sentence in the streaming agent response is POSTed here
 *   - Returns an MP3 binary blob the browser queues for playback
 *
 * Uses ElevenLabs' batched /v1/text-to-speech endpoint. (Streaming would be
 * nicer but the model-driven sentence boundary detection makes batched
 * simple sentences close to instant — typical 200-400ms per call.)
 *
 * Server-only — holds the API key. Keys never reach the browser.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TEXT_CHARS = 2_000; // ElevenLabs' hard cap is 5000, 2K is safer for sentence-sized calls
const REQUEST_TIMEOUT_MS = 8_000;

/** Default voice — same one Telegram voice messages use, for consistency. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text) {
    return Response.json({ error: "text is required." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return Response.json(
      { error: `text too long (${text.length} > ${MAX_TEXT_CHARS}).` },
      { status: 400 },
    );
  }

  const apiKey = env("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return Response.json(
      { error: "elevenlabs_disabled", detail: "ELEVENLABS_API_KEY not set." },
      { status: 503 },
    );
  }

  const voice = typeof b.voice === "string" && b.voice.trim()
    ? b.voice.trim()
    : env("ELEVENLABS_VOICE_ID") ?? DEFAULT_VOICE_ID;

  // Strip whitespace that ElevenLabs would pronounce as "new paragraph"
  // (multi-line text in ElevenLabs often adds weird audio cues).
  const cleanedText = text.replace(/\s+/g, " ").trim();

  // AbortController enforces the timeout independently of the caller's signal.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleanedText,
          model_id: "eleven_turbo_v2_5",
          // Tune for live-talk: low latency + natural prosody. Reduce stability
          // a touch so the voice doesn't sound robotic reading a single sentence.
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
        signal: ctrl.signal,
      },
    );

    if (!ttsRes.ok) {
      const detail = await ttsRes.text().catch(() => "");
      console.error("[tts] ElevenLabs upstream error", {
        status: ttsRes.status,
        detail: detail.slice(0, 200),
      });
      return Response.json(
        { error: "elevenlabs_upstream_error", status: ttsRes.status, detail },
        { status: ttsRes.status },
      );
    }

    // Stream the MP3 binary back to the browser. Casting to a fresh
    // Response with a fixed Content-Length would shave a few ms but isn't
    // worth the complexity for ~10 KB audio chunks.
    return new Response(ttsRes.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-TTS-Voice": voice,
        "X-TTS-Chars": String(cleanedText.length),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    const code = msg.includes("abort") ? "timeout" : "unavailable";
    console.error("[tts] stream failed", { code, msg });
    return Response.json(
      { error: code, message: msg },
      { status: code === "timeout" ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Reject other methods explicitly.
export async function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
