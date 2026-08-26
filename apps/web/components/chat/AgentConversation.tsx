"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversations } from "./ConversationProvider";
import { ChatTimeline } from "./ChatTimeline";
import { ChatComposer } from "./ChatComposer";
import { ConversationList } from "./ConversationList";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import type { Agent, Conversation } from "@/lib/types";

interface AgentConversationProps {
  agent: Agent;
  /** Shows the conversation picker alongside the transcript. */
  showList?: boolean;
  className?: string;
}

/**
 * AgentConversation — one agent's channel, backed by the shared store.
 *
 * Used by the agent workspace and the Chats route, so both read and write the
 * same conversations. The agent is passed in explicitly and every write is
 * keyed by `agent.id`, so a message cannot land in another agent's channel.
 */
export function AgentConversation({
  agent,
  showList = true,
  className,
}: AgentConversationProps) {
  const {
    hydrated,
    conversationsFor,
    getConversation,
    activeConversationId,
    ensureActive,
    setActiveConversation,
    startConversation,
    renameConversation,
    sendMessage,
    streamingConversations,
    cancelRun,
    retryMessage,
    orchestrate,
  } = useConversations();
  const { activeAgentId } = useVoiceContext();

  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  // Fixed reference for "x ago" labels: recomputing per render would make
  // timestamps jitter and break server/client agreement.
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const conversations = useMemo(
    () => conversationsFor(agent.id),
    [conversationsFor, agent.id],
  );

  // Pin the resolved conversation once hydrated so a send — which updates
  // `updatedAt` and can re-order the list — cannot swap the transcript out
  // from under the operator.
  useEffect(() => {
    if (hydrated) ensureActive(agent.id);
  }, [hydrated, agent.id, ensureActive]);

  const activeId = activeConversationId(agent.id);
  const active = activeId ? getConversation(activeId) : undefined;
  const isVoiceTarget = activeAgentId === agent.id;

  const handleSend = useCallback(
    (body: string) => {
      // Create a conversation on demand so a command is never dropped for
      // want of a container.
      const conversationId = activeId ?? startConversation(agent.id).id;
      // Messages to Hermes go through the orchestrator: it decides whether
      // specialists are needed. Every other agent runs directly.
      if (agent.id === "hermes") {
        orchestrate(conversationId, body);
        return;
      }
      void sendMessage(agent.id, conversationId, body);
    },
    [activeId, agent.id, orchestrate, sendMessage, startConversation],
  );

  const handleSelect = useCallback(
    (c: Conversation) => {
      setActiveConversation(agent.id, c.id);
      setRenaming(false);
    },
    [agent.id, setActiveConversation],
  );

  const handleCreate = useCallback(() => {
    startConversation(agent.id);
    setRenaming(false);
    // Focus the composer so the operator can type straight away.
    requestAnimationFrame(() => {
      document
        .getElementById(`composer-${agent.id}`)
        ?.focus({ preventScroll: true });
    });
  }, [agent.id, startConversation]);

  const commitRename = useCallback(() => {
    if (active && draftTitle.trim()) {
      renameConversation(active.id, draftTitle);
    }
    setRenaming(false);
  }, [active, draftTitle, renameConversation]);

  if (!hydrated) {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>
        <p className="t-meta py-8 text-center">Loading channel…</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-3",
        showList && "lg:flex-row",
        className,
      )}
    >
      {showList && (
        <div className="flex min-h-0 flex-none flex-col lg:w-[230px]">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelect}
            onCreate={handleCreate}
            nowMs={nowMs}
            className="max-h-[220px] lg:max-h-none"
            emptyMessage={`No conversations with ${agent.name} yet.`}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Conversation title, renameable in place. */}
        {active && (
          <div className="mb-2 flex flex-none items-center gap-2">
            {renaming ? (
              <>
                <label htmlFor={`rename-${agent.id}`} className="sr-only">
                  Conversation title
                </label>
                <input
                  id={`rename-${agent.id}`}
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  className="clip-hud-sm min-w-0 flex-1 border border-hud-cyan/50 bg-surface-inset px-2 py-1 font-hud text-[11px] uppercase tracking-[0.12em] text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={commitRename}
                  aria-label="Save title"
                  className="flex-none border border-line p-1 text-hud-cyan transition-colors hover:border-hud-cyan/50"
                >
                  <Check size={12} strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setRenaming(false)}
                  aria-label="Cancel rename"
                  className="flex-none border border-line p-1 text-ink-faint transition-colors hover:text-ink-mute"
                >
                  <X size={12} strokeWidth={2} aria-hidden />
                </button>
              </>
            ) : (
              <>
                <h3 className="min-w-0 flex-1 truncate font-hud text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">
                  {active.title}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setDraftTitle(active.title);
                    setRenaming(true);
                  }}
                  aria-label="Rename conversation"
                  className="flex-none border border-line p-1 text-ink-faint transition-colors hover:border-hud-cyan/40 hover:text-hud-cyan"
                >
                  <Pencil size={11} strokeWidth={2} aria-hidden />
                </button>
              </>
            )}
          </div>
        )}

        <ChatTimeline
          agent={agent}
          messages={active?.messages ?? []}
          onRetry={
            activeId ? (id) => retryMessage(activeId, id) : undefined
          }
          emptyMessage={
            active
              ? `No messages in this conversation yet.`
              : `Start a conversation with ${agent.name}.`
          }
          className="min-h-[160px]"
        />

        <ChatComposer
          agent={agent}
          onSend={handleSend}
          isVoiceTarget={isVoiceTarget}
          streaming={Boolean(activeId && streamingConversations.includes(activeId))}
          onStop={activeId ? () => cancelRun(activeId) : undefined}
          className="mt-2.5"
        />
      </div>
    </div>
  );
}
