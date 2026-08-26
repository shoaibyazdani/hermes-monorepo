"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAgo } from "@/lib/format";
import type { Conversation } from "@/lib/types";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (conversation: Conversation) => void;
  onCreate?: () => void;
  /** Reference instant for "x ago" labels — passed in to stay deterministic. */
  nowMs: number;
  className?: string;
  /** Cap the rendered list; the rest stay reachable by scrolling. */
  emptyMessage?: string;
}

/**
 * ConversationList — an agent's conversations, most recently active first.
 *
 * Each row carries enough to pick without opening: title, a preview of the
 * latest turn, its age and the message count.
 */
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  nowMs,
  className,
  emptyMessage = "No conversations yet.",
}: ConversationListProps) {
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="clip-hud-sm mb-2 flex flex-none items-center gap-1.5 border border-line px-2.5 py-1.5 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan"
        >
          <Plus size={12} strokeWidth={2} aria-hidden />
          New conversation
        </button>
      )}

      {conversations.length === 0 ? (
        <p className="t-meta py-4">{emptyMessage}</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto">
          {conversations.map((c) => {
            const last = c.messages[c.messages.length - 1];
            const active = c.id === activeId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-full border-l-2 px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-l-hud-cyan bg-hud-cyan/[0.07]"
                      : "border-l-transparent hover:border-l-hud-cyan/40 hover:bg-hud-cyan/[0.03]",
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-hud text-[11px] font-semibold uppercase tracking-[0.12em]",
                        active ? "text-hud-cyan" : "text-ink",
                      )}
                    >
                      {c.title}
                    </span>
                    <span className="t-timestamp flex-none" suppressHydrationWarning>
                      {formatAgo(c.updatedAt, nowMs)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="t-meta min-w-0 flex-1 truncate">
                      {last
                        ? `${last.role === "operator" ? "You: " : ""}${last.body}`
                        : "No messages yet"}
                    </span>
                    <span className="t-timestamp flex-none tabular-nums">
                      {c.messages.length}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
