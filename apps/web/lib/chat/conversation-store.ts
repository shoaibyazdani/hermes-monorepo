import type { ChatMessage, ChatMessageStatus, Conversation } from "../types";
import { SEED_CONVERSATIONS } from "./seed-conversations";

/**
 * Conversation persistence.
 *
 * The ONLY module that touches storage. Everything else goes through these
 * functions, so replacing localStorage with a server API later is a change to
 * this file rather than a sweep through the UI.
 *
 * Design notes:
 * - Every read is defensive. Malformed JSON, a schema change, a hostile value
 *   or a browser with storage disabled must all degrade to seed data rather
 *   than throw: a broken cache should never take the app down.
 * - Writes are best-effort. A quota error or a private-window rejection is
 *   swallowed; the in-memory copy stays correct for the session.
 */

const STORAGE_KEY = "hermes.conversations.v1";
/** Bump when the persisted shape changes incompatibly. */
const SCHEMA_VERSION = 1;

interface StoredEnvelope {
  version: number;
  conversations: Conversation[];
}

/* ── Storage access ──────────────────────────────────────────────────────── */

/**
 * localStorage, or null when it cannot be used.
 *
 * Access itself can throw (Safari private mode, blocked site data), so the
 * probe is inside try/catch rather than a bare `typeof` check.
 */
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    // Probe: some browsers expose the object but reject every write.
    const probe = "__hermes_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/* ── Validation ──────────────────────────────────────────────────────────── */

const ROLES = new Set(["operator", "agent", "system"]);
const STATUSES = new Set([
  "complete",
  "pending",
  "streaming",
  "awaiting-runtime",
  "error",
  "cancelled",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function validMessage(v: unknown, conversationId: string): ChatMessage | null {
  if (!isRecord(v)) return null;
  const { id, agentId, role, body, createdAt, status } = v;
  if (typeof id !== "string" || !id) return null;
  if (typeof agentId !== "string" || !agentId) return null;
  if (typeof role !== "string" || !ROLES.has(role)) return null;
  if (typeof body !== "string") return null;
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
    return null;
  }
  return {
    id,
    conversationId,
    agentId,
    role: role as ChatMessage["role"],
    body,
    createdAt,
    // A run does not survive a reload, so a message persisted mid-flight is
    // recorded as cancelled rather than left claiming to still be streaming.
    status:
      status === "streaming" || status === "pending"
        ? "cancelled"
        : typeof status === "string" && STATUSES.has(status)
          ? (status as ChatMessageStatus)
          : "complete",
    kind: "text",
  };
}

function validConversation(v: unknown): Conversation | null {
  if (!isRecord(v)) return null;
  const { id, agentId, title, createdAt, updatedAt, messages } = v;
  if (typeof id !== "string" || !id) return null;
  if (typeof agentId !== "string" || !agentId) return null;

  const list = Array.isArray(messages) ? messages : [];
  const parsed = list
    .map((m) => validMessage(m, id))
    // A single bad turn drops that turn, not the whole conversation.
    .filter((m): m is ChatMessage => m !== null);

  const created =
    typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt))
      ? createdAt
      : new Date(0).toISOString();

  return {
    id,
    agentId,
    title: typeof title === "string" && title ? title : "Conversation",
    createdAt: created,
    updatedAt:
      typeof updatedAt === "string" && !Number.isNaN(Date.parse(updatedAt))
        ? updatedAt
        : created,
    messages: parsed,
  };
}

/* ── Read / write ────────────────────────────────────────────────────────── */

/**
 * Load all conversations.
 *
 * Falls back to seed data on anything unexpected: absent key, unparseable
 * JSON, wrong schema version, or a payload that validates to nothing.
 */
export function loadConversations(): Conversation[] {
  const s = storage();
  if (!s) return cloneSeed();

  let raw: string | null = null;
  try {
    raw = s.getItem(STORAGE_KEY);
  } catch {
    return cloneSeed();
  }
  if (!raw) return seedAndPersist();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted JSON — discard and re-seed rather than leaving it to fail again.
    return seedAndPersist();
  }

  if (!isRecord(parsed) || parsed.version !== SCHEMA_VERSION) {
    return seedAndPersist();
  }

  const list = Array.isArray(parsed.conversations) ? parsed.conversations : [];
  const valid = list
    .map(validConversation)
    .filter((c): c is Conversation => c !== null);

  // An empty result from a non-empty payload means the shape is unusable.
  return valid.length > 0 || list.length === 0 ? valid : seedAndPersist();
}

export function saveConversations(conversations: Conversation[]): void {
  const s = storage();
  if (!s) return;
  const envelope: StoredEnvelope = {
    version: SCHEMA_VERSION,
    conversations,
  };
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or storage rejected the write. The session keeps its
    // in-memory copy; persistence is a convenience, not a correctness need.
  }
}

/**
 * Seed timestamps are authored against a fixed scenario date, which sorts
 * unpredictably against messages the operator sends today — a real message can
 * land "before" a fixture dated in the future, pushing the conversation the
 * operator is actually using down the recency ordering.
 *
 * Rebasing on first load preserves the fixtures' relative spacing while
 * anchoring the newest of them just before now, so anything sent afterwards
 * genuinely sorts newest.
 */
function rebaseToNow(conversations: Conversation[]): Conversation[] {
  const stamps = conversations.flatMap((c) => [
    Date.parse(c.updatedAt),
    ...c.messages.map((m) => Date.parse(m.createdAt)),
  ]);
  const latest = Math.max(...stamps.filter((n) => !Number.isNaN(n)));
  if (!Number.isFinite(latest)) return conversations;

  // Land the newest fixture one minute ago.
  const shift = Date.now() - 60_000 - latest;
  const move = (iso: string): string => {
    const t = Date.parse(iso);
    return Number.isNaN(t) ? iso : new Date(t + shift).toISOString();
  };

  return conversations.map((c) => ({
    ...c,
    createdAt: move(c.createdAt),
    updatedAt: move(c.updatedAt),
    messages: c.messages.map((m) => ({ ...m, createdAt: move(m.createdAt) })),
  }));
}

function cloneSeed(): Conversation[] {
  // Deep clone so a caller mutating results cannot corrupt the seed module.
  return rebaseToNow(
    SEED_CONVERSATIONS.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({ ...m })),
    })),
  );
}

function seedAndPersist(): Conversation[] {
  const seeded = cloneSeed();
  saveConversations(seeded);
  return seeded;
}

/** Wipe persisted conversations and restore the seed set. */
export function resetConversations(): Conversation[] {
  const s = storage();
  try {
    s?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — the re-seed below still returns a usable set.
  }
  return seedAndPersist();
}

/** Storage key, exported so the multi-tab listener can filter events. */
export const CONVERSATION_STORAGE_KEY = STORAGE_KEY;

/* ── Factories ───────────────────────────────────────────────────────────── */

/**
 * Monotonic local id.
 *
 * `crypto.randomUUID` where available, otherwise a timestamp+counter. Both are
 * unique enough for client-local records; server ids replace these later.
 */
let idCounter = 0;
export function localId(prefix: string): string {
  idCounter += 1;
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {
    // Fall through to the counter form.
  }
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function createConversation(
  agentId: string,
  title = "New conversation",
): Conversation {
  const now = new Date().toISOString();
  return {
    id: localId("conv"),
    agentId,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function createMessage(
  conversationId: string,
  agentId: string,
  role: ChatMessage["role"],
  body: string,
  status: ChatMessageStatus,
): ChatMessage {
  return {
    id: localId("msg"),
    conversationId,
    agentId,
    role,
    body,
    createdAt: new Date().toISOString(),
    status,
    kind: "text",
  };
}
