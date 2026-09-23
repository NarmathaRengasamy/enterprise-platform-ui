import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/common';
import { conversationService } from '../services/conversation.service';
import type {
  ConversationAgentOption,
  ConversationItem,
  ConversationMessage,
  ConversationSource,
  NewConversationPayload
} from '../types/conversation.types';
import { clockTime, dayKey, dayLabel, fullTimestamp, relativeLabel } from '../utils/datetime';

interface ConversationsPageProps {
  selectedConversationId?: string | null;
  setSelectedConversationId?: (id: string | null) => void;
}

/* The backend returns every conversation in one response, so "Load more"
   widens a client-side window rather than fetching another page. */
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

/* The transcript carries the whole event stream — tool calls, grounding
   decisions, guardrails, status changes — and the backend turns the textless
   ones into placeholder bubbles ("🧠 Knowledge base grounding applied").
   Only genuine turns belong in a chat, so the rest are filtered out here. */
const CHAT_EVENT_TYPES = new Set(['user_message', 'ai_response']);

const isChatMessage = (m: ConversationMessage): boolean => {
  if (!m.eventType) return true; // locally composed messages carry no event type
  return CHAT_EVENT_TYPES.has(m.eventType) && Boolean((m.text || '').trim());
};

/* Status dot: ended → blue, abandoned → grey, resolved → green.
   `active` is a live thread, so it gets its own amber; anything unrecognised
   falls back to grey rather than pretending to be one of the known states. */
const STATUS_STYLES: Record<string, { dot: string; pill: string; label: string }> = {
  ended: { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700', label: 'Ended' },
  abandoned: { dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600', label: 'Abandoned' },
  resolved: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700', label: 'Resolved' },
  active: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700', label: 'Active' }
};

const UNKNOWN_STATUS = { dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600', label: 'Unknown' };

const statusStyle = (status?: string) =>
  STATUS_STYLES[String(status || '').toLowerCase()] || UNKNOWN_STATUS;

const CHANNEL_TABS = [
  { key: 'all', label: 'All' },
  { key: 'web', label: 'Web' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'voice', label: 'Phone' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' }
];

/* The channels a reply could go out on. Which of them are offered for a given
   thread is data-driven — see `channelOptions` — but that it is these three is
   not: a channel Perfox adds later would arrive in `agentChannels` and never
   render until it is listed here. `web` and `voice` are deliberately absent;
   the widget has no outbound address and a call is the Call button. */
const SENDABLE = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' }
];

const EMPTY_CONVO: ConversationItem = {
  id: '',
  name: '',
  initials: '',
  avatar: '',
  phone: '',
  email: '',
  timestamp: '',
  lastMessage: '',
  channel: 'web',
  channelLabel: '',
  channelColor: '#2563eb',
  unread: 0,
  status: '',
  messages: []
};

const initialsOf = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

export default function ConversationsPage({
  selectedConversationId: propSelectedConvoId,
  setSelectedConversationId: propSetSelectedConvoId
}: ConversationsPageProps = {}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');

  const [internalActiveConvoId, setInternalActiveConvoId] = useState<string | null>(
    propSelectedConvoId || null
  );
  const [threadLoading, setThreadLoading] = useState(false);

  /* Transcripts are fetched once per id and kept for the lifetime of the page.
     This holds the messages themselves, not just "which ids were fetched":
     switching channel tabs refetches the list, and those rows arrive with an
     empty `messages`, so a set of ids would suppress the refetch and leave the
     thread looking empty. The cache is what re-fills it. */
  const transcriptCache = useRef<Map<string, ConversationMessage[]>>(new Map());

  /* Which store answered, and why the live one did not. A list served from the
     mirror looks exactly like a live one, so it has to say so. */
  const [source, setSource] = useState<ConversationSource>('perfox');
  const [sourceError, setSourceError] = useState('');

  /* The agent filter rides on the list response — no separate call. */
  const [agentOptions, setAgentOptions] = useState<ConversationAgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('all');

  const [selectedChannelFilter, setSelectedChannelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [composerChannel, setComposerChannel] = useState('whatsapp');
  const [sending, setSending] = useState(false);

  /* Attachments are disabled: this backend exposes no upload endpoint. */
  const attachment = null;
  const uploading = false;

  /* Search within the open thread */
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeConvoId =
    propSelectedConvoId !== undefined && propSelectedConvoId !== null
      ? propSelectedConvoId
      : internalActiveConvoId;

  const setActiveConvoId = (id: string | null) => {
    if (propSetSelectedConvoId) propSetSelectedConvoId(id);
    setInternalActiveConvoId(id);
  };

  useEffect(() => {
    if (propSelectedConvoId) setInternalActiveConvoId(propSelectedConvoId);
  }, [propSelectedConvoId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* The whole (filtered, newest-first) list from the backend in one call; the
     rail shows `visibleCount` of it and "Load more" widens that window. */
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    setLoading(true);
    setLoadError('');

    (async () => {
      try {
        const result = await conversationService.getConversations(
          {
            channel: selectedChannelFilter,
            search: debouncedSearch,
            agentId: selectedAgentId
          },
          { signal }
        );
        if (signal.aborted) return;
        setConversations(result.conversations);
        setTotal(result.total);
        setSource(result.source);
        setSourceError(result.sourceError);
        /* The options are counted against the channel and search in force but
           before the agent filter is applied, so they stay switchable. */
        setAgentOptions(result.agents);
        setVisibleCount(PAGE_SIZE);
        setLoading(false);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setLoadError(err?.message || 'Could not load conversations.');
        setConversations([]);
        setTotal(0);
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedChannelFilter, debouncedSearch, selectedAgentId]);

  /* An agent that no longer appears under the current channel and search cannot
     be cleared from a dropdown that no longer lists it, so clear it here. */
  useEffect(() => {
    if (selectedAgentId === 'all') return;
    if (agentOptions.some((a) => a.id === selectedAgentId)) return;
    setSelectedAgentId('all');
  }, [agentOptions, selectedAgentId]);

  const visibleConversations = useMemo(
    () => conversations.slice(0, visibleCount),
    [conversations, visibleCount]
  );
  const hasMore = visibleCount < conversations.length;

  const loadMore = useCallback(() => {
    setVisibleCount((n) => n + PAGE_SIZE);
  }, []);

  /* Which thread the right pane is actually showing. Normally the selected one;
     it falls back to the newest row when nothing is selected, or when a filter
     no longer contains the previously open thread. A selected id that is not in
     the list yet (a deep link from the dashboard) is kept so it can be fetched. */
  const displayedId = useMemo(() => {
    if (activeConvoId) {
      if (conversations.some((c) => c.id === activeConvoId)) return activeConvoId;
      if (!transcriptCache.current.has(activeConvoId)) return activeConvoId;
    }
    return conversations[0]?.id || null;
  }, [activeConvoId, conversations]);

  /* Transcript for the open thread. GET /conversations/:id returns the whole
     event stream, so the non-chat events are dropped here. */
  useEffect(() => {
    if (!displayedId || transcriptCache.current.has(displayedId)) return undefined;

    const controller = new AbortController();
    const signal = controller.signal;
    const id = displayedId;

    setThreadLoading(true);
    conversationService
      .getConversation(id, { signal })
      .then((detail) => {
        if (signal.aborted) return;
        const messages = (detail.messages || []).filter(isChatMessage);
        transcriptCache.current.set(id, messages);
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === id);
          if (!exists) return [{ ...detail, messages }, ...prev];
          return prev.map((c) => (c.id === id ? { ...c, ...detail, messages } : c));
        });
        setThreadLoading(false);
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        setThreadLoading(false);
        /* An id that is not in the list and cannot be fetched is stale — a deep
           link to a thread that no longer exists — so fall back to the newest
           row instead of leaving the pane stuck on an error. */
        const inList = conversations.some((c) => c.id === id);
        if (!inList) {
          setActiveConvoId(null);
          return;
        }
        setLoadError(err?.message || 'Could not load this transcript.');
      });

    return () => controller.abort();
  }, [displayedId]);

  /* Opening a thread reads it. The badge is cleared locally as well as on the
     server so the row does not sit there looking unread until the next refetch;
     a failed call is not worth reporting — nothing the operator did failed. */
  useEffect(() => {
    if (!displayedId) return;
    const row = conversations.find((c) => c.id === displayedId);
    if (!row || row.unread <= 0) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === displayedId ? { ...c, unread: 0 } : c))
    );
    conversationService.markAsRead(displayedId).catch(() => {});
  }, [displayedId, conversations]);

  const activeConvo = useMemo(() => {
    const row = conversations.find((c) => c.id === displayedId);
    if (!row) return EMPTY_CONVO;
    // List rows carry no messages, so a row that came back from a refetch needs
    // its transcript put back from the cache
    if (row.messages.length > 0) return row;
    const cached = transcriptCache.current.get(row.id);
    return cached && cached.length > 0 ? { ...row, messages: cached } : row;
  }, [conversations, displayedId]);

  /* Which channels the composer may offer.

     The agent that handled the thread decides this, not the customer's contact
     details: holding a phone number does not mean an SMS integration exists to
     send through, and `agentChannels` is exactly the list of what that agent is
     integrated with. It arrives on the list row and again on the thread detail.

     A thread started in this UI has no Perfox agent behind it, so it falls back
     to the channel it was created with — otherwise a local thread could never be
     replied to at all.

     Unavailable channels are disabled rather than hidden, so it stays visible
     that they exist and are simply not wired up. */
  const channelOptions = useMemo(() => {
    const integrated = (activeConvo.agentChannels ?? []).map((c) => c.toLowerCase());
    const isLocalThread = !activeConvo.agentId;

    return SENDABLE.map((option) => {
      const available = isLocalThread
        ? activeConvo.channel === option.key
        : integrated.some((c) => c.includes(option.key));

      return {
        ...option,
        available,
        reason: available
          ? ''
          : isLocalThread
            ? `This thread was started on ${activeConvo.channelLabel || 'another channel'}`
            : `${activeConvo.agentName || 'The agent handling this thread'} is not integrated with ${option.label}`
      };
    });
  }, [
    activeConvo.agentChannels,
    activeConvo.agentId,
    activeConvo.agentName,
    activeConvo.channel,
    activeConvo.channelLabel
  ]);

  const activeChannelOption = channelOptions.find((o) => o.key === composerChannel);
  const canSendOnChannel = Boolean(activeChannelOption?.available);

  useEffect(() => {
    if (!activeConvo.id) return;
    // Prefer the conversation's own channel, else the first one that can reach them
    const own = channelOptions.find((o) => o.key === activeConvo.channel && o.available);
    const fallback = channelOptions.find((o) => o.available);
    setComposerChannel((own || fallback || channelOptions[0]).key);
  }, [activeConvo.id, activeConvo.channel, channelOptions]);

  const getChannelPlaceholder = () => {
    if (!activeConvo.id) return 'Select a conversation to reply...';
    if (composerChannel === 'whatsapp') {
      return `Type a WhatsApp message to ${activeConvo.name}...`;
    } else if (composerChannel === 'sms') {
      return `Type an SMS message (${activeConvo.phone || 'no number on file'})...`;
    } else if (composerChannel === 'email') {
      return `Type an Email to ${activeConvo.email || 'no address on file'}...`;
    }
    return `Log phone call notes or trigger call with ${activeConvo.name}...`;
  };

  /* ── New conversation ──────────────────────────────────────────────────── */
  const [showNewChat, setShowNewChat] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newChatError, setNewChatError] = useState('');
  const [newChat, setNewChat] = useState({
    name: '',
    channel: 'whatsapp' as NewConversationPayload['channel'],
    phone: '',
    email: '',
    initialMessage: ''
  });

  const resetNewChat = () => {
    setNewChat({ name: '', channel: 'whatsapp', phone: '', email: '', initialMessage: '' });
    setNewChatError('');
  };

  const handleCreateConversation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (creating) return;

    const name = newChat.name.trim();
    const initialMessage = newChat.initialMessage.trim();
    if (!name || !initialMessage) {
      setNewChatError('A name and a first message are both required.');
      return;
    }

    setCreating(true);
    setNewChatError('');
    try {
      const created = await conversationService.createConversation({
        name,
        channel: newChat.channel,
        initialMessage,
        phone: newChat.phone.trim() || undefined,
        email: newChat.email.trim() || undefined
      });

      // The list call will not return it, so keep it in local state and cache
      // its messages the same way a fetched transcript would be
      transcriptCache.current.set(created.id, created.messages || []);
      setConversations((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setTotal((n) => n + 1);
      setVisibleCount((n) => Math.max(n, 1));
      setActiveConvoId(created.id);
      setShowNewChat(false);
      resetNewChat();
    } catch (err: any) {
      setNewChatError(err?.message || 'Could not start the conversation.');
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if ((!text && !attachment) || !activeConvo.id || sending || uploading || !canSendOnChannel) return;

    const now = new Date();
    const optimistic: ConversationMessage = {
      id: `m_${now.getTime()}`,
      sender: 'me',
      text,
      channel: composerChannel,
      attachment: attachment || undefined,
      timestamp: now.toISOString(),
      time: clockTime(now.toISOString())
    };

    const convoId = activeConvo.id;
    /* Append to activeConvo.messages, not to the row in `conversations` — the row
       may be a post-refetch one whose messages are empty and only live in the
       cache. Writing the cache too keeps the message across a tab switch. */
    const previousMessages = activeConvo.messages;
    const nextMessages = [...previousMessages, optimistic];
    transcriptCache.current.set(convoId, nextMessages);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convoId
          ? { ...c, lastMessage: text || attachment?.fileName || 'Attachment', messages: nextMessages }
          : c
      )
    );
    const sentAttachment = attachment;
    setInputMessage('');
    setSendError('');
    setSending(true);

    try {
      const updated = await conversationService.sendMessage(convoId, {
        text,
        sender: 'me',
        channel: composerChannel,
        attachment: sentAttachment || undefined
      });
      transcriptCache.current.set(convoId, updated.messages || nextMessages);
      setConversations((prev) => prev.map((c) => (c.id === convoId ? { ...c, ...updated } : c)));
    } catch (err: any) {
      // Put the text back so nothing is silently lost
      transcriptCache.current.set(convoId, previousMessages);
      setConversations((prev) =>
        prev.map((c) => (c.id === convoId ? { ...c, messages: previousMessages } : c))
      );
      setInputMessage(text);
      setSendError(err?.message || 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  /* ── Search within the open thread ─────────────────────────────────────── */
  const matchIds = useMemo(() => {
    const q = messageSearch.trim().toLowerCase();
    if (!q) return [];
    return activeConvo.messages.filter((m) => (m.text || '').toLowerCase().includes(q)).map((m) => m.id);
  }, [messageSearch, activeConvo.messages]);

  const currentMatchId = matchIds[matchIndex] ?? null;

  // A new query starts from the first hit again
  useEffect(() => {
    setMatchIndex(0);
  }, [messageSearch, activeConvo.id]);

  // Bring the current hit into view
  useEffect(() => {
    if (!currentMatchId) return;
    messageRefs.current[currentMatchId]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentMatchId]);

  const stepMatch = (delta: number) => {
    if (matchIds.length === 0) return;
    setMatchIndex((i) => (i + delta + matchIds.length) % matchIds.length);
  };

  const closeMessageSearch = () => {
    setShowMessageSearch(false);
    setMessageSearch('');
    setMatchIndex(0);
  };

  /* Split a message into plain and matching runs so hits can be marked without
     dangerouslySetInnerHTML. */
  const highlight = (text: string, messageId: string) => {
    const q = messageSearch.trim();
    if (!q) return text;

    const lower = text.toLowerCase();
    const needle = q.toLowerCase();
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let hit = lower.indexOf(needle);

    while (hit !== -1) {
      if (hit > cursor) parts.push(text.slice(cursor, hit));
      const isCurrent = messageId === currentMatchId;
      parts.push(
        <mark
          key={`${messageId}-${hit}`}
          className={
            isCurrent
              ? 'bg-amber-400 text-on-surface rounded-sm px-0.5'
              : 'bg-amber-200/70 text-on-surface rounded-sm px-0.5'
          }
        >
          {text.slice(hit, hit + q.length)}
        </mark>
      );
      cursor = hit + q.length;
      hit = lower.indexOf(needle, cursor);
    }

    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
  };

  /* ── Group the thread into days ────────────────────────────────────────── */
  const messageDays = useMemo(() => {
    const groups: { key: string; label: string; messages: ConversationMessage[] }[] = [];
    activeConvo.messages.forEach((m) => {
      const iso = m.timestamp || '';
      const key = dayKey(iso);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.messages.push(m);
      } else {
        groups.push({ key, label: dayLabel(iso), messages: [m] });
      }
    });
    return groups;
  }, [activeConvo.messages]);

  const activeStatus = statusStyle(activeConvo.status);

  return (
    <>
    <div className="flex w-full h-[calc(100vh-6.75rem)] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm border border-surface-container">
      {/* LEFT PANEL: Conversations list */}
      <div className="w-80 md:w-96 flex flex-col bg-surface-container-lowest shrink-0 border-r border-surface-container">
        {/* Panel Header */}
        <div className="p-space-md pb-space-sm space-y-space-sm">
          <div className="flex items-center justify-between">
            <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
              Conversations
            </h1>
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="edit_square"
              onClick={() => setShowNewChat(true)}
              title="New conversation"
              aria-label="New conversation"
            />
          </div>

          {/* Search Input */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:bg-surface-container transition-colors"
            />
          </div>

          {/* Channel Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
            {CHANNEL_TABS.map((tab) => (
              <Button
                key={tab.key}
                variant={selectedChannelFilter === tab.key ? 'primary' : 'hover'}
                size="xs"
                onClick={() => setSelectedChannelFilter(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Agent filter. The options come back with the list itself, counted
              against the channel and search already applied, so each one says
              how many threads it would actually show. */}
          {agentOptions.length > 0 && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                smart_toy
              </span>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:bg-surface-container transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All agents</option>
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.id} ({agent.count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="h-px bg-surface-container w-full"></div>

        {/* Conversation Thread List */}
        <div className="flex-1 overflow-y-auto p-space-xs space-y-1">
          {/* Served from the local mirror because Perfox could not be reached.
              Saying nothing here is how a dead thread gets acted on. */}
          {source === 'local' && !loading && (
            <div className="m-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">
                cloud_off
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-label-lg text-label-lg text-amber-900 font-semibold">
                  Showing a mirrored copy
                </span>
                <span className="font-body-sm text-[11px] text-amber-800">
                  Perfox could not be reached, so these threads come from this workspace's own
                  copy and may be out of date.
                  {sourceError ? ` ${sourceError}` : ''}
                </span>
              </div>
            </div>
          )}

          {loadError && (
            <div className="m-2 p-3 rounded-xl bg-error/10 text-error font-body-sm text-body-sm">
              {loadError}
            </div>
          )}

          {loading && (
            <div className="p-6 flex items-center justify-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              Loading conversations...
            </div>
          )}

          {!loading && !loadError && conversations.length === 0 && (
            <div className="p-6 text-center text-on-surface-variant font-body-sm text-body-sm">
              No conversations match this filter.
            </div>
          )}

          {visibleConversations.map((c) => {
            const isActive = c.id === activeConvo.id;
            const status = statusStyle(c.status);
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvoId(c.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  isActive ? 'bg-surface-container-high font-semibold' : 'hover:bg-surface-container'
                }`}
              >
                <div className="relative shrink-0">
                  {c.avatar ? (
                    <img src={c.avatar} alt={c.name} className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shrink-0">
                      {c.initials || initialsOf(c.name) || 'CU'}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${status.dot}`}
                    title={status.label}
                  ></span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-label-lg text-label-lg text-on-surface font-semibold truncate">
                      {c.name}
                    </h3>
                    <span
                      className="font-mono text-[11px] text-on-surface-variant shrink-0 ml-2"
                      title={fullTimestamp(c.updatedAt || c.createdAt)}
                    >
                      {relativeLabel(c.updatedAt || c.createdAt) || c.timestamp}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate font-normal">
                    {c.lastMessage}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[10px] font-medium flex items-center gap-1 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                        {c.channelLabel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] font-medium shrink-0 ${status.pill}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    {c.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-mono text-[11px] font-semibold shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load more — pulls the next PAGE_SIZE rows and appends them */}
          {hasMore && !loading && (
            <div className="p-2">
              <Button variant="hover" size="sm" fullWidth onClick={loadMore}>
                {`Load more (${visibleConversations.length} of ${total})`}
              </Button>
            </div>
          )}

          {!loading && visibleConversations.length > 0 && (
            <p className="py-2 text-center font-body-sm text-[11px] text-on-surface-variant">
              {visibleConversations.length} of {total} conversations
            </p>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Selected Conversation */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FD]">
        {/* Top Header */}
        <div className="h-16 px-space-lg bg-surface-container-lowest border-b border-surface-container flex items-center justify-between shrink-0">
          <div className="flex items-center gap-space-md min-w-0">
            <div className="relative shrink-0">
              {activeConvo.avatar ? (
                <img
                  src={activeConvo.avatar}
                  alt={activeConvo.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shrink-0">
                  {activeConvo.initials || initialsOf(activeConvo.name) || 'CU'}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${activeStatus.dot}`}
                title={activeStatus.label}
              ></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                  {activeConvo.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[11px] font-semibold flex items-center gap-1 shrink-0">
                  {activeConvo.channelLabel}
                </span>
                {activeConvo.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] font-semibold flex items-center gap-1 shrink-0 ${activeStatus.pill}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${activeStatus.dot}`}></span>
                    {activeStatus.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm truncate">
                {/* The agent is resolved server-side from `workflowId`; an id on
                    its own means nothing to the person reading this. */}
                {activeConvo.agentName && (
                  <span className="flex items-center gap-1 shrink-0" title="Agent that handled this thread">
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                    {activeConvo.agentName}
                  </span>
                )}
                {activeConvo.agentName && (activeConvo.phone || activeConvo.email) && <span>•</span>}
                <span>{activeConvo.phone}</span>
                {activeConvo.phone && activeConvo.email && <span>•</span>}
                <span className="truncate">{activeConvo.email}</span>
                {/* Absent from the identified-customer index: everything known
                    about them is what they said in the thread. */}
                {activeConvo.id && activeConvo.customerKnown === false && (
                  <span
                    className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-medium shrink-0"
                    title="This visitor never identified themselves"
                  >
                    Anonymous
                  </span>
                )}
                {(activeConvo.customerTags ?? []).slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-primary-container/40 text-on-primary-container text-[10px] font-medium shrink-0"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="soft"
              size="sm"
              startIcon="call"
              disabled={!activeConvo.id}
              onClick={() => {
                setComposerChannel('voice');
                alert(`Starting voice call / logging call with ${activeConvo.name} (${activeConvo.phone})`);
              }}
              title="Call via Phone"
            >
              <span className="hidden sm:inline">Call</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="search"
              active={showMessageSearch}
              disabled={!activeConvo.id}
              onClick={() => (showMessageSearch ? closeMessageSearch() : setShowMessageSearch(true))}
              title="Search messages"
              aria-label="Search messages"
            />
          </div>
        </div>

        {/* Search within this conversation */}
        {showMessageSearch && (
          <div className="px-space-lg py-2 bg-surface-container-lowest border-b border-surface-container flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              autoFocus
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeMessageSearch();
                if (e.key === 'Enter') stepMatch(e.shiftKey ? -1 : 1);
              }}
              placeholder="Search in this conversation..."
              className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none"
            />
            <span className="font-mono text-[11px] text-on-surface-variant shrink-0 min-w-[4.5rem] text-right">
              {messageSearch.trim()
                ? matchIds.length > 0
                  ? `${matchIndex + 1} of ${matchIds.length}`
                  : 'no matches'
                : ''}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="keyboard_arrow_up"
              disabled={matchIds.length === 0}
              onClick={() => stepMatch(-1)}
              title="Previous match"
              aria-label="Previous match"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="keyboard_arrow_down"
              disabled={matchIds.length === 0}
              onClick={() => stepMatch(1)}
              title="Next match"
              aria-label="Next match"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="close"
              onClick={closeMessageSearch}
              title="Close search"
              aria-label="Close search"
            />
          </div>
        )}

        {/* Chat Message Thread */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 py-6 space-y-4">
          {threadLoading && (
            <div className="flex items-center justify-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              Loading messages...
            </div>
          )}

          {!threadLoading && activeConvo.messages.length === 0 && (
            <div className="flex items-center justify-center text-on-surface-variant font-body-sm text-body-sm">
              No messages in this conversation yet.
            </div>
          )}

          {messageDays.map((day) => (
            <div key={day.key} className="space-y-4">
              {/* Day separator — this is what tells you whether a message is from
                  today or three weeks ago; the bubbles themselves only show a clock. */}
              <div className="flex items-center justify-center sticky top-0 z-10 py-1">
                <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm shadow-sm">
                  {day.label}
                </span>
              </div>

              {day.messages.map((m) => {
                const isMe = m.sender === 'me';
                const isSystem = m.sender === 'system';
                const isCurrentMatch = m.id === currentMatchId;
                const isMatch = matchIds.includes(m.id);

                if (isSystem) {
                  return (
                    <div key={m.id} className="flex items-center justify-center">
                      <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[11px]">
                        {highlight(m.text, m.id)}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    ref={(el) => {
                      messageRefs.current[m.id] = el;
                    }}
                    className={`flex flex-col max-w-lg ${isMe ? 'items-end ml-auto' : 'items-start'}`}
                  >
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm space-y-1 transition-shadow ${
                        isMe
                          ? 'bg-primary text-on-primary rounded-br-sm'
                          : 'bg-surface-container-lowest text-on-surface rounded-bl-sm'
                      } ${isCurrentMatch ? 'ring-2 ring-amber-400' : isMatch ? 'ring-1 ring-amber-300/70' : ''}`}
                    >
                      {/* Attachment: an image preview, a product card, or a file
                          the reader can open — whichever the payload describes. */}
                      {m.attachment && (
                        <div className="rounded-xl overflow-hidden bg-surface-container text-on-surface mb-2">
                          {m.attachment.image && !m.attachment.fileUrl && (
                            <img
                              src={m.attachment.image}
                              alt={m.attachment.title}
                              className="w-full h-40 object-cover"
                            />
                          )}

                          {m.attachment.fileUrl && m.attachment.mimeType?.startsWith('image/') && (
                            <a href={m.attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={m.attachment.fileUrl}
                                alt={m.attachment.fileName || 'Attachment'}
                                className="w-full max-h-64 object-cover"
                              />
                            </a>
                          )}

                          {m.attachment.fileUrl && !m.attachment.mimeType?.startsWith('image/') && (
                            <a
                              href={m.attachment.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 flex items-center gap-2.5 hover:bg-surface-container-high transition-colors"
                            >
                              <span className="material-symbols-outlined text-primary text-[22px] shrink-0">
                                description
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-label-md text-label-md font-semibold text-on-surface truncate">
                                  {m.attachment.fileName || 'Attachment'}
                                </span>
                                <span className="block font-body-sm text-[11px] text-on-surface-variant">
                                  {m.attachment.mimeType || 'File'}
                                </span>
                              </span>
                              <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">
                                download
                              </span>
                            </a>
                          )}

                          {m.attachment.title && (
                            <div className="p-2.5 flex items-center justify-between">
                              <div>
                                <p className="font-label-md text-label-md font-semibold text-on-surface">
                                  {m.attachment.title}
                                </p>
                                {m.attachment.sku && (
                                  <p className="font-body-sm text-[11px] text-on-surface-variant">
                                    SKU: {m.attachment.sku}
                                  </p>
                                )}
                              </div>
                              {m.attachment.status && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  {m.attachment.status}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {m.text && (
                        <p className="font-body-md text-body-md leading-relaxed whitespace-pre-wrap">
                          {highlight(m.text, m.id)}
                        </p>
                      )}
                      <div
                        className={`flex items-center justify-end gap-1.5 font-mono text-[10px] ${
                          isMe ? 'text-primary-fixed' : 'text-on-surface-variant'
                        }`}
                      >
                        {m.channel && (
                          <span className="uppercase text-[9px] font-semibold tracking-wider opacity-80">
                            via {m.channel}
                          </span>
                        )}
                        <span title={fullTimestamp(m.timestamp)}>
                          {clockTime(m.timestamp) || m.time}
                        </span>
                        {isMe && <span className="material-symbols-outlined text-[14px]">done_all</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* BOTTOM COMPOSER */}
        <div className="p-space-md bg-surface-container-lowest border-t border-surface-container relative">
          {sendError && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-error/10 text-error font-body-sm text-body-sm">
              {sendError}
            </div>
          )}

          {/* Channel Selector Chips — a channel the handling agent is not
              integrated with is disabled rather than failing at send time */}
          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
            <span className="text-on-surface-variant font-label-sm text-label-sm mr-1 font-medium">
              Send via:
            </span>
            {channelOptions.map((option) => (
              <Button
                key={option.key}
                variant={composerChannel === option.key ? 'primary' : 'hover'}
                size="xs"
                disabled={!option.available}
                onClick={() => setComposerChannel(option.key)}
                title={option.available ? `Send over ${option.label}` : option.reason}
              >
                {option.label} {composerChannel === option.key ? '(Active)' : ''}
              </Button>
            ))}
          </div>

          {activeConvo.id && !canSendOnChannel && (
            <p className="mb-2 font-body-sm text-[11px] text-on-surface-variant">
              {activeConvo.agentId
                ? `${activeConvo.agentName || 'The agent handling this thread'} is not integrated with any channel this composer can send on.`
                : 'This thread was started here, so only the channel it was created with is available.'}
            </p>
          )}

          {/* Sending is not wired to Perfox: the message is written to this
              workspace and the customer never receives it. Saying so beside the
              box is the difference between a draft and a message believed sent. */}
          {activeConvo.id && canSendOnChannel && (
            <p className="mb-2 font-body-sm text-[11px] text-on-surface-variant">
              Replies are recorded on this thread only — there is no send endpoint yet, so the
              customer will not receive them.
            </p>
          )}

          {/* Input Container */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2 focus-within:bg-surface-container focus-within:ring-1 focus-within:ring-primary transition-all"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={getChannelPlaceholder()}
              disabled={!activeConvo.id}
              className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus:outline-none px-1 disabled:cursor-not-allowed"
            />

            <Button
              variant="primary"
              size="md"
              type="submit"
              endIcon="send"
              loading={sending}
              disabled={
                (!inputMessage.trim() && !attachment) ||
                !activeConvo.id ||
                uploading ||
                !canSendOnChannel
              }
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>

      {/* New conversation dialog */}
      {showNewChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => {
            if (!creating) {
              setShowNewChat(false);
              resetNewChat();
            }
          }}
        >
          <form
            onSubmit={handleCreateConversation}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container p-space-lg space-y-space-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Start a conversation
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                disabled={creating}
                onClick={() => {
                  setShowNewChat(false);
                  resetNewChat();
                }}
                title="Close"
                aria-label="Close"
              />
            </div>

            {newChatError && (
              <div className="px-3 py-2 rounded-lg bg-error/10 text-error font-body-sm text-body-sm">
                {newChatError}
              </div>
            )}

            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">Customer name</span>
              <input
                autoFocus
                value={newChat.name}
                onChange={(e) => setNewChat((v) => ({ ...v, name: e.target.value }))}
                placeholder="e.g. Anna Lakshmi"
                className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">Channel</span>
              <select
                value={newChat.channel}
                onChange={(e) =>
                  setNewChat((v) => ({ ...v, channel: e.target.value as NewConversationPayload['channel'] }))
                }
                className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="voice">Voice</option>
                <option value="web">Web</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="font-label-md text-label-md text-on-surface-variant">Phone</span>
                <input
                  value={newChat.phone}
                  onChange={(e) => setNewChat((v) => ({ ...v, phone: e.target.value }))}
                  placeholder="+91…"
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label className="block">
                <span className="font-label-md text-label-md text-on-surface-variant">Email</span>
                <input
                  value={newChat.email}
                  onChange={(e) => setNewChat((v) => ({ ...v, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>

            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant">First message</span>
              <textarea
                rows={3}
                value={newChat.initialMessage}
                onChange={(e) => setNewChat((v) => ({ ...v, initialMessage: e.target.value }))}
                placeholder="What did the customer ask?"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </label>

            <p className="font-body-sm text-[11px] text-on-surface-variant">
              This thread is stored locally. It will not appear in the list after a refresh until the
              backend merges local threads into <code>GET /conversations</code>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="hover"
                size="sm"
                disabled={creating}
                onClick={() => {
                  setShowNewChat(false);
                  resetNewChat();
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={creating}
                disabled={!newChat.name.trim() || !newChat.initialMessage.trim() || creating}
              >
                Start conversation
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
