import type { ChatMessage, Conversation } from "../types";

/**
 * Seed conversations, written once into the store on first run.
 *
 * These are historical fixtures: every turn is `complete`, including the agent
 * replies, because they represent a transcript from before this build rather
 * than anything the current system produced. Nothing here is generated at
 * runtime — see `conversation-store` for how seeding is made idempotent.
 */

let seq = 0;

/** Deterministic ids so re-seeding produces identical records. */
function msg(
  conversationId: string,
  agentId: string,
  role: ChatMessage["role"],
  body: string,
  createdAt: string,
): ChatMessage {
  seq += 1;
  return {
    id: `seed-${conversationId}-${seq}`,
    conversationId,
    agentId,
    role,
    body,
    createdAt,
    status: "complete",
    kind: "text",
  };
}

function conversation(
  id: string,
  agentId: string,
  title: string,
  createdAt: string,
  updatedAt: string,
  turns: Array<[ChatMessage["role"], string, string]>,
): Conversation {
  return {
    id,
    agentId,
    title,
    createdAt,
    updatedAt,
    messages: turns.map(([role, body, at]) =>
      msg(id, agentId, role, body, at),
    ),
  };
}

export const SEED_CONVERSATIONS: Conversation[] = [
  /* ── APEX ─────────────────────────────────────────────────────────────── */
  conversation(
    "conv-apex-auth",
    "apex",
    "Authentication Investigation",
    "2026-08-26T15:22:00.000Z",
    "2026-08-26T15:29:10.000Z",
    [
      ["operator", "Check the authentication regression.", "2026-08-26T15:22:31.000Z"],
      [
        "agent",
        "Running the regression suite now. Six specs failed on the session refresh path — isolating the branch.",
        "2026-08-26T15:22:48.000Z",
      ],
      ["operator", "Do you need the staging fixtures?", "2026-08-26T15:28:02.000Z"],
      [
        "agent",
        "Not yet. I have a fix candidate but it needs approval before it reaches staging.",
        "2026-08-26T15:29:10.000Z",
      ],
    ],
  ),
  conversation(
    "conv-apex-regression",
    "apex",
    "Regression Test Review",
    "2026-08-26T14:31:00.000Z",
    "2026-08-26T14:38:20.000Z",
    [
      ["operator", "Let's review the failing tests from last night.", "2026-08-26T14:31:12.000Z"],
      [
        "agent",
        "Eleven failures, nine of them share a fixture that expires the session early. The other two are genuinely flaky.",
        "2026-08-26T14:33:05.000Z",
      ],
      ["operator", "Split them into two tickets.", "2026-08-26T14:37:40.000Z"],
      ["agent", "Done — one for the fixture, one for the flakes.", "2026-08-26T14:38:20.000Z"],
    ],
  ),
  conversation(
    "conv-apex-login",
    "apex",
    "API Login Debugging",
    "2026-08-25T16:04:00.000Z",
    "2026-08-25T16:12:44.000Z",
    [
      ["operator", "Investigate session expiration on the login endpoint.", "2026-08-25T16:04:18.000Z"],
      [
        "agent",
        "The refresh token TTL is shorter than the access token TTL, so a refresh mid-request invalidates the session.",
        "2026-08-25T16:12:44.000Z",
      ],
    ],
  ),

  /* ── NOVA ─────────────────────────────────────────────────────────────── */
  conversation(
    "conv-nova-playwright",
    "nova",
    "Playwright Research",
    "2026-08-26T15:26:00.000Z",
    "2026-08-26T15:27:44.000Z",
    [
      ["operator", "What do the sources say about Playwright auth?", "2026-08-26T15:27:05.000Z"],
      [
        "agent",
        "Four viable patterns. Three of four sources favour a stored session fixture over per-test login.",
        "2026-08-26T15:27:44.000Z",
      ],
    ],
  ),
  conversation(
    "conv-nova-patterns",
    "nova",
    "Authentication Patterns",
    "2026-08-26T13:50:00.000Z",
    "2026-08-26T13:58:31.000Z",
    [
      ["operator", "Compare MFA handling across the candidate patterns.", "2026-08-26T13:50:22.000Z"],
      [
        "agent",
        "Only the storage-state approach survives MFA cleanly; the others re-trigger the challenge on every spec.",
        "2026-08-26T13:58:31.000Z",
      ],
    ],
  ),
  conversation(
    "conv-nova-frameworks",
    "nova",
    "Testing Framework Comparison",
    "2026-08-25T11:02:00.000Z",
    "2026-08-25T11:19:07.000Z",
    [
      ["operator", "Playwright versus Cypress for this suite.", "2026-08-25T11:02:40.000Z"],
      [
        "agent",
        "Playwright, on parallelism and multi-context support. Cypress wins on debugging ergonomics only.",
        "2026-08-25T11:19:07.000Z",
      ],
    ],
  ),

  /* ── ATLAS ────────────────────────────────────────────────────────────── */
  conversation(
    "conv-atlas-strategy",
    "atlas",
    "Regression Strategy",
    "2026-08-26T15:18:00.000Z",
    "2026-08-26T15:29:55.000Z",
    [
      ["operator", "How do you want to sequence the sweep?", "2026-08-26T15:18:30.000Z"],
      [
        "agent",
        "Regression sweep is ready but blocked on APEX results. Standing by.",
        "2026-08-26T15:29:55.000Z",
      ],
    ],
  ),
  conversation(
    "conv-atlas-coverage",
    "atlas",
    "Login Test Coverage",
    "2026-08-25T09:41:00.000Z",
    "2026-08-25T09:52:13.000Z",
    [
      ["operator", "Where are the gaps in login coverage?", "2026-08-25T09:41:55.000Z"],
      [
        "agent",
        "Password reset and MFA fallback are untested. Happy path and lockout are covered.",
        "2026-08-25T09:52:13.000Z",
      ],
    ],
  ),

  /* ── Others ───────────────────────────────────────────────────────────── */
  conversation(
    "conv-sentinel-audit",
    "sentinel",
    "Permission Audit",
    "2026-08-26T15:20:00.000Z",
    "2026-08-26T15:22:10.000Z",
    [
      [
        "agent",
        "Egress scan is clean. Permission audit is running across the edge fleet.",
        "2026-08-26T15:22:10.000Z",
      ],
    ],
  ),
  conversation(
    "conv-cipher-vault",
    "cipher",
    "Vault Lease Expiry",
    "2026-08-26T15:30:00.000Z",
    "2026-08-26T15:30:44.000Z",
    [
      [
        "agent",
        "Vault lease expired mid-rotation. 42 edge nodes are still on the previous credentials — I need the lease renewed to continue.",
        "2026-08-26T15:30:44.000Z",
      ],
    ],
  ),
  conversation(
    "conv-hermes-network",
    "hermes",
    "Network Status",
    "2026-08-26T15:16:00.000Z",
    "2026-08-26T15:16:32.000Z",
    [
      [
        "agent",
        "Command network ready. Four agents active on the authentication investigation.",
        "2026-08-26T15:16:32.000Z",
      ],
    ],
  ),
];
