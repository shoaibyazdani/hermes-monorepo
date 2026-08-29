/**
 * Runtime configuration.
 *
 * The ONLY module that reads `process.env` for runtime concerns. Everything
 * else imports from here, so provider selection is one decision in one place
 * and secrets never leak into component code.
 *
 * SERVER ONLY. This must never be imported from a client component: it reads
 * API keys, and Next.js would otherwise inline them into the browser bundle.
 */

export type ProviderKind = "minimax" | "cortex" | "none";

export interface RuntimeConfig {
  /** Which provider will actually serve requests. */
  provider: ProviderKind;
  /** True when a provider can genuinely execute — drives the LIVE indicator. */
  live: boolean;
  model: string;
  /** Present only for direct-to-model providers. Never sent to the browser. */
  apiKey?: string;
  baseUrl: string;
  /** Whether the selected provider can stream tokens. */
  supportsStreaming: boolean;
  /** Upper bound on a single response, in tokens. */
  maxTokens: number;
  /** Per-request timeout in ms. */
  timeoutMs: number;
  /**
   * Enable Anthropic-style extended thinking. MiniMax-M3 declares reasoning:
   * true but the provider was sending requests without the thinking block —
   * the model jumps straight to tool calls without a plan. Setting
   * AI_THINKING_ENABLED=true (or `thinking: "enabled"` in the future) opts in.
   * The model returns `thinking` blocks in the SSE stream which the runtime
   * emits as `reasoning` events for the UI to display.
   */
  thinkingEnabled: boolean;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Resolve the active provider.
 *
 * Preference order, and why:
 *   1. MiniMax direct — the only path that can stream tokens, and the only one
 *      where per-agent system prompts arrive unmodified.
 *   2. Cortex proxy — works with no key in this app, but buffers the whole
 *      response and injects its own persona server-side.
 *   3. None — simulation. `pnpm dev` must work with no credentials at all.
 *
 * `AI_PROVIDER` overrides the order when set, so a developer can force Cortex
 * even with a key present.
 */
export function getRuntimeConfig(): RuntimeConfig {
  const model = env("AI_MODEL") ?? env("MINIMAX_MODEL") ?? "MiniMax-M3";
  const maxTokens = Number(env("AI_MAX_TOKENS") ?? "4096");
  const timeoutMs = Number(env("AI_TIMEOUT_MS") ?? "60000");

  const apiKey = env("AI_API_KEY") ?? env("MINIMAX_API_KEY");
  const cortexUrl = env("CORTEX_BASE_URL");
  const forced = env("AI_PROVIDER")?.toLowerCase();

  const minimaxBase =
    env("AI_BASE_URL") ??
    env("MINIMAX_BASE_URL") ??
    env("MINIMAX_BASE") ??
    "https://api.minimax.io/anthropic";

  const canMinimax = Boolean(apiKey);
  const canCortex = Boolean(cortexUrl);

  const pick: ProviderKind =
    forced === "minimax" && canMinimax
      ? "minimax"
      : forced === "cortex" && canCortex
        ? "cortex"
        : forced === "none"
          ? "none"
          : canMinimax
            ? "minimax"
            : canCortex
              ? "cortex"
              : "none";

  if (pick === "minimax") {
    return {
      provider: "minimax",
      live: true,
      model,
      apiKey,
      baseUrl: minimaxBase,
      supportsStreaming: true,
      maxTokens,
      timeoutMs,
      thinkingEnabled: env("AI_THINKING_ENABLED") !== "false",  // on by default
    };
  }

  if (pick === "cortex") {
    return {
      provider: "cortex",
      live: true,
      model,
      // No key: Cortex holds its own credentials and is unauthenticated.
      baseUrl: cortexUrl!,
      // Cortex returns one buffered JSON body — verified, no SSE, no chunking.
      supportsStreaming: false,
      maxTokens,
      timeoutMs,
      // Cortex buffers the response, so reasoning isn't surfaced anyway.
      thinkingEnabled: false,
    };
  }

  return {
    provider: "none",
    live: false,
    model: "simulation",
    baseUrl: "",
    supportsStreaming: false,
    maxTokens,
    timeoutMs,
    thinkingEnabled: false,
  };
}

/**
 * The browser-safe subset.
 *
 * Deliberately narrow: no key, no base URL, nothing that could identify or
 * reach a credentialed endpoint. This is what `/api/runtime/status` returns.
 */
export interface PublicRuntimeStatus {
  live: boolean;
  provider: ProviderKind;
  model: string;
  supportsStreaming: boolean;
}

export function getPublicRuntimeStatus(): PublicRuntimeStatus {
  const c = getRuntimeConfig();
  return {
    live: c.live,
    provider: c.provider,
    model: c.live ? c.model : "simulation",
    supportsStreaming: c.supportsStreaming,
  };
}
