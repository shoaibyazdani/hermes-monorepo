/**
 * Provider abstraction.
 *
 * Deliberately vendor-neutral: nothing above this layer knows whether the
 * bytes came from MiniMax, Cortex or anything else. Adding a provider means
 * implementing this interface and registering it — no changes upstream.
 */

export interface ModelMessage {
  role: "user" | "assistant";
  content: string;
}

/** A tool offered to the model, in provider-neutral form. */
export interface ModelToolSpec {
  id: string;
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  inputSchema: Record<string, unknown>;
}

export interface ModelRequest {
  system: string;
  messages: ModelMessage[];
  tools?: ModelToolSpec[];
  maxTokens: number;
  /** Aborts the upstream call — wired to the client's STOP control. */
  signal?: AbortSignal;
}

/**
 * Normalised provider output.
 *
 * A provider that cannot stream emits a single `text` event; one that can
 * emits many. Consumers handle both identically, so streaming capability
 * never leaks into the runtime.
 */
export type ModelEvent =
  | { kind: "text"; text: string }
  | { kind: "tool-call"; toolCallId: string; toolId: string; input: unknown }
  | { kind: "done" }
  | { kind: "error"; code: ModelErrorCode; message: string };

export type ModelErrorCode =
  | "unavailable"
  | "auth"
  | "rate-limit"
  | "timeout"
  | "malformed"
  | "cancelled";

export interface ModelProvider {
  readonly id: string;
  readonly model: string;
  /** True when this provider emits incremental text. */
  readonly supportsStreaming: boolean;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}

/**
 * Map an unknown thrown value to a safe error code.
 *
 * Providers throw wildly different shapes; this collapses them so nothing
 * vendor-specific — and nothing containing a key — reaches the browser.
 */
export function classifyError(err: unknown): {
  code: ModelErrorCode;
  message: string;
} {
  if (err instanceof DOMException && err.name === "AbortError") {
    return { code: "cancelled", message: "Request cancelled." };
  }
  if (err instanceof Error) {
    if (err.name === "AbortError" || /abort/i.test(err.message)) {
      return { code: "cancelled", message: "Request cancelled." };
    }
    if (/timeout|etimedout/i.test(err.message)) {
      return { code: "timeout", message: "The model did not respond in time." };
    }
    if (/econnrefused|enotfound|network|fetch failed/i.test(err.message)) {
      return { code: "unavailable", message: "The model service is unreachable." };
    }
  }
  return { code: "unavailable", message: "The model service is unavailable." };
}

/** HTTP status → safe error code. */
export function classifyStatus(status: number): {
  code: ModelErrorCode;
  message: string;
} {
  if (status === 401 || status === 403) {
    return { code: "auth", message: "The model service rejected the credentials." };
  }
  if (status === 429) {
    return { code: "rate-limit", message: "Rate limited by the model service." };
  }
  if (status === 408 || status === 504) {
    return { code: "timeout", message: "The model did not respond in time." };
  }
  return { code: "unavailable", message: "The model service returned an error." };
}
