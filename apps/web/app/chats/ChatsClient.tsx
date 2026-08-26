"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ExternalLink, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/hud/Panel";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusDot } from "@/components/hud/StatusDot";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { AgentStatusBadge } from "@/components/agents/AgentStatusBadge";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatTimeline } from "@/components/chat/ChatTimeline";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useConversations } from "@/components/chat/ConversationProvider";
import { useAgents } from "@/hooks/useAgents";
import { useVoiceContext } from "@/components/voice/VoiceProvider";
import { agentStatusVisual } from "@/lib/agent-status";
import { agentHref } from "@/lib/navigation";
import type { Agent, Conversation } from "@/lib/types";

/**
 * Chats — every agent channel in one place.
 *
 * Three columns on desktop: agents, that agent's conversations, and the
 * transcript. The selected agent is also the voice target, so the global bar,
 * the sidebar and this screen never disagree about who is being addressed.
 *
 * Reads the same `ConversationProvider` store as the agent workspaces — there
 * is no separate chat state.
 */
export default function ChatsClient() {
  const { agents } = useAgents();
  const {
    hydrated,
    conversations,
    conversationsFor,
    getConversation,
    activeConversationId,
    ensureActive,
    setActiveConversation,
    startConversation,
    sendMessage,
    streamingConversations,
    cancelRun,
    retryMessage,
  } = useConversations();
  const { setAgents, setActiveAgentId, activeAgentId } = useVoiceContext();

  const [query, setQuery] = useState("");
  const [nowMs, setNowMs] = useState(0);
  // Mobile: the agent/conversation columns collapse into a drawer.
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setAgents(agents.map(({ id, name }) => ({ id, name })));
  }, [agents, setAgents]);

  // Default to the agent with the most recent traffic, so arriving on Chats
  // lands on a channel with history rather than an arbitrary first entry.
  useEffect(() => {
    if (activeAgentId || agents.length === 0 || !hydrated) return;
    const newest = [...conversations].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];
    setActiveAgentId(
      newest && agents.some((a) => a.id === newest.agentId)
        ? newest.agentId
        : agents[0].id,
    );
  }, [activeAgentId, agents, conversations, hydrated, setActiveAgentId]);

  const agent = agents.find((a) => a.id === activeAgentId) ?? agents[0] ?? null;

  const agentConversations = useMemo(
    () => (agent ? conversationsFor(agent.id) : []),
    [agent, conversationsFor],
  );

  // Pin the resolved conversation so re-ordering after a send cannot swap
  // the transcript out from under the operator.
  useEffect(() => {
    if (hydrated && agent) ensureActive(agent.id);
  }, [hydrated, agent, ensureActive]);

  const activeId = agent ? activeConversationId(agent.id) : null;
  const active = activeId ? getConversation(activeId) : undefined;

  /** Conversation counts per agent, for the roster column. */
  const countByAgent = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of conversations) {
      map.set(c.agentId, (map.get(c.agentId) ?? 0) + 1);
    }
    return map;
  }, [conversations]);

  /**
   * Search across titles, message bodies and agent names.
   *
   * Local only — it filters the store already in memory, so there is no
   * network call and no server index.
   */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const nameById = new Map(agents.map((a) => [a.id, a.name.toLowerCase()]));
    return conversations
      .filter((c) => {
        if (c.title.toLowerCase().includes(q)) return true;
        if ((nameById.get(c.agentId) ?? "").includes(q)) return true;
        return c.messages.some((m) => m.body.toLowerCase().includes(q));
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [query, conversations, agents]);

  const selectAgent = useCallback(
    (a: Agent) => {
      setActiveAgentId(a.id);
      setListOpen(false);
    },
    [setActiveAgentId],
  );

  const selectConversation = useCallback(
    (c: Conversation) => {
      // Selecting a search hit can cross agents — follow it.
      setActiveAgentId(c.agentId);
      setActiveConversation(c.agentId, c.id);
      setQuery("");
      setListOpen(false);
    },
    [setActiveAgentId, setActiveConversation],
  );

  const handleSend = useCallback(
    (body: string) => {
      if (!agent) return;
      const conversationId = activeId ?? startConversation(agent.id).id;
      void sendMessage(agent.id, conversationId, body);
    },
    [agent, activeId, sendMessage, startConversation],
  );

  const handleCreate = useCallback(() => {
    if (!agent) return;
    startConversation(agent.id);
    requestAnimationFrame(() => {
      document
        .getElementById(`composer-${agent.id}`)
        ?.focus({ preventScroll: true });
    });
  }, [agent, startConversation]);

  const totalMessages = useMemo(
    () => conversations.reduce((n, c) => n + c.messages.length, 0),
    [conversations],
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Chats"
        subtitle="Agent channels · local conversation store"
        meta={[
          { label: "CHANNELS", value: `${conversations.length}` },
          { label: "MESSAGES", value: `${totalMessages}` },
          { label: "TARGET", value: agent?.name ?? "—" },
        ]}
      />

      <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.6fr)]">
        {/* ── Agents ──────────────────────────────────────────────────── */}
        <Panel
          title="Agents"
          eyebrow={`${agents.length}`}
          status="info"
          stagger={0}
          className={cn("flex flex-col", !listOpen && "max-lg:hidden")}
          fill
        >
          <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto">
            {agents.map((a) => {
              const visual = agentStatusVisual(a.status);
              const selected = a.id === agent?.id;
              const count = countByAgent.get(a.id) ?? 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => selectAgent(a)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-l-2 px-2.5 py-2 text-left transition-colors",
                      selected
                        ? "border-l-hud-cyan bg-hud-cyan/[0.07]"
                        : "border-l-transparent hover:border-l-hud-cyan/40 hover:bg-hud-cyan/[0.03]",
                    )}
                  >
                    <StatusDot
                      tone={visual.tone}
                      live={visual.live}
                      size="xs"
                      className="flex-none"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate font-hud text-[11px] font-bold uppercase tracking-[0.14em]",
                          selected ? "text-hud-cyan" : "text-ink",
                        )}
                      >
                        {a.name}
                      </span>
                      <span className="t-timestamp">
                        {count} {count === 1 ? "chat" : "chats"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* ── Conversations + search ──────────────────────────────────── */}
        <Panel
          title={results ? "Search Results" : "Conversations"}
          eyebrow={
            results ? `${results.length}` : `${agentConversations.length}`
          }
          stagger={1}
          className={cn("flex flex-col", !listOpen && "max-lg:hidden")}
          fill
        >
          <div className="mb-2.5 flex flex-none items-center gap-2">
            <label htmlFor="chat-search" className="sr-only">
              Search conversations, messages and agents
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                size={12}
                strokeWidth={2}
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-ghost"
              />
              <input
                id="chat-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="clip-hud-sm w-full border border-line bg-surface-inset py-1.5 pl-7 pr-2 font-data text-xs text-ink outline-none transition-colors placeholder:text-ink-ghost focus:border-hud-cyan/60"
              />
            </div>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="flex-none border border-line p-1 text-ink-faint transition-colors hover:text-ink-mute"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>

          {!hydrated ? (
            <p className="t-meta py-4">Loading conversations…</p>
          ) : results ? (
            results.length === 0 ? (
              <p className="t-meta py-4">No matches for “{query}”.</p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto">
                {results.map((c) => {
                  const owner = agents.find((a) => a.id === c.agentId);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(c)}
                        className="w-full border-l-2 border-l-transparent px-2.5 py-2 text-left transition-colors hover:border-l-hud-cyan/40 hover:bg-hud-cyan/[0.03]"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="flex-none font-hud text-[10px] font-bold uppercase tracking-[0.14em] text-hud-cyan">
                            {owner?.name ?? c.agentId.toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-hud text-[11px] uppercase tracking-[0.1em] text-ink">
                            {c.title}
                          </span>
                        </div>
                        <p className="t-meta mt-0.5 truncate">
                          {c.messages[c.messages.length - 1]?.body ??
                            "No messages"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : agent ? (
            <ConversationList
              conversations={agentConversations}
              activeId={activeId}
              onSelect={selectConversation}
              onCreate={handleCreate}
              nowMs={nowMs}
              className="min-h-0 flex-1"
              emptyMessage={`No conversations with ${agent.name} yet.`}
            />
          ) : (
            <p className="t-meta py-4">No agents registered.</p>
          )}
        </Panel>

        {/* ── Transcript ──────────────────────────────────────────────── */}
        <Panel
          title={agent ? `${agent.name} Channel` : "Channel"}
          eyebrow={active?.title ?? "NO CONVERSATION"}
          status={agent ? "info" : "neutral"}
          statusLive={Boolean(agent)}
          variant="active"
          stagger={2}
          className="flex min-h-[420px] flex-col"
          fill
          actions={
            agent && (
              <>
                <button
                  type="button"
                  onClick={() => setListOpen((v) => !v)}
                  className="t-label border border-line px-1.5 py-0.5 text-ink-mute transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan lg:hidden"
                >
                  {listOpen ? "Hide list" : "Channels"}
                </button>
                <Link
                  href={agentHref(agent.id) as Route}
                  className="clip-hud-sm flex items-center gap-1.5 border border-line px-2 py-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-mute transition-colors hover:border-hud-cyan/50 hover:text-hud-cyan"
                >
                  <ExternalLink size={10} strokeWidth={2} aria-hidden />
                  Workspace
                </Link>
              </>
            )
          }
        >
          {agent ? (
            <>
              {/* Channel identity — the active target, stated plainly. */}
              <div className="mb-3 flex flex-none items-center gap-3 border-b border-line-soft pb-3">
                <AgentAvatar agent={agent} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="t-agent-name text-ink">{agent.name}</span>
                    <AgentStatusBadge status={agent.status} />
                  </div>
                  <p className="t-label mt-1">{agent.role}</p>
                </div>
                <span className="clip-hud-sm flex flex-none items-center gap-1.5 border border-hud-cyan/50 bg-hud-cyan/10 px-2 py-0.5">
                  <StatusDot tone="info" live size="xs" />
                  <span className="font-hud text-[9px] font-bold uppercase tracking-[0.16em] text-hud-cyan">
                    Channel active
                  </span>
                </span>
              </div>

              <ChatTimeline
                agent={agent}
                messages={active?.messages ?? []}
                onRetry={
                  activeId ? (id) => retryMessage(activeId, id) : undefined
                }
                emptyMessage={
                  active
                    ? "No messages in this conversation yet."
                    : `Select or start a conversation with ${agent.name}.`
                }
              />

              <ChatComposer
                agent={agent}
                onSend={handleSend}
                isVoiceTarget={activeAgentId === agent.id}
                disabled={!hydrated}
                streaming={Boolean(
                  activeId && streamingConversations.includes(activeId),
                )}
                onStop={activeId ? () => cancelRun(activeId) : undefined}
                className="mt-2.5"
              />
            </>
          ) : (
            <p className="t-meta py-10 text-center">
              No agents registered on this network.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
