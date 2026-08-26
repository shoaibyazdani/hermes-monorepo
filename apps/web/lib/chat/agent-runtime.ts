import type { ChatMessageStatus } from "../types";

/**
 * The seam between the UI and agent execution.
 *
 * Everything upstream — voice, parsing, target resolution, conversation
 * selection, message creation — is already real. This is the single point that
 * is not, and it is deliberately narrow so replacing it is a contained change.
 */

export interface RuntimeRequest {
  agentId: string;
  conversationId: string;
  message: string;
}

export interface RuntimeResult {
  /** Status to apply to the operator's message once the runtime has seen it. */
  status: ChatMessageStatus;
  /**
   * Whether a reply should be expected. False today: no runtime exists, so no
   * reply is coming and the UI must not leave a spinner running forever.
   */
  expectReply: boolean;
  /** Short machine-readable reason, surfaced in the UI as a system note. */
  reason: string;
}

export interface AgentRuntime {
  readonly id: string;
  /** True once the runtime can actually execute a message. */
  readonly available: boolean;
  sendMessage(input: RuntimeRequest): Promise<RuntimeResult>;
}

/**
 * The no-op runtime used in this phase.
 *
 * It accepts the message, confirms it was stored and addressed, and reports
 * `awaiting-runtime`. It does NOT claim delivery, does not claim execution,
 * and never produces an agent reply — there is nothing behind it that could.
 *
 * A real implementation replaces this object wholesale: same interface, same
 * call site, `available: true`, and a `status` of `pending` while a response
 * streams in.
 */
export const localQueueRuntime: AgentRuntime = {
  id: "local-queue",
  available: false,

  async sendMessage(_input: RuntimeRequest): Promise<RuntimeResult> {
    return {
      status: "awaiting-runtime",
      expectReply: false,
      reason: "LOCAL COMMAND QUEUED",
    };
  },
};

/**
 * Active runtime for the application.
 *
 * One import site for every caller, so swapping implementations is a one-line
 * change here rather than a search across components.
 */
export function getAgentRuntime(): AgentRuntime {
  return localQueueRuntime;
}
