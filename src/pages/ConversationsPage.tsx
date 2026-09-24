import React, { useState, useEffect } from 'react';
import { conversationsApi } from '../api';
import { useCalls } from '../components/calls/CallProvider';
import ConversationTranscript from '../components/conversations/ConversationTranscript';
import NewConversationModal from '../components/conversations/NewConversationModal';
import { useApi, useDebounced } from '../hooks/useApi';
import { Button, LoadingState, ErrorState, ErrorBanner } from '../components/common';

interface ConversationsPageProps {
  selectedConversationId?: string | null;
  setSelectedConversationId?: (id: string | null) => void;
}

/* Perfox's own conversation status, styled rather than renamed.
   `resolved` — closed with an outcome; `ended` — finished; `abandoned` — the
   customer left mid-conversation, which is the one worth noticing. */
const STATUS_STYLES: Record<string, { chip: string; dot: string }> = {
  resolved: { chip: 'bg-emerald-500/15 text-emerald-700', dot: 'bg-emerald-500' },
  ended: { chip: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-outline' },
  abandoned: { chip: 'bg-amber-500/15 text-amber-700', dot: 'bg-amber-500' },
  active: { chip: 'bg-blue-500/15 text-blue-700', dot: 'bg-blue-500' },
  open: { chip: 'bg-blue-500/15 text-blue-700', dot: 'bg-blue-500' },
};

const statusStyle = (status?: string) =>
  STATUS_STYLES[(status ?? '').toLowerCase()] ?? {
    chip: 'bg-surface-container-high text-on-surface-variant',
    dot: 'bg-outline',
  };

export default function ConversationsPage({
  selectedConversationId: propSelectedConvoId,
  setSelectedConversationId: propSetSelectedConvoId
}: ConversationsPageProps = {}) {
  const [internalActiveConvoId, setInternalActiveConvoId] = useState<string | null>(
    propSelectedConvoId || null
  );

  const [selectedChannelFilter, setSelectedChannelFilter] = useState('all');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [composerChannel, setComposerChannel] = useState('whatsapp');
  const [isNewConvoOpen, setIsNewConvoOpen] = useState(false);

  /* Calling is a human operator picking up the phone, through the Perfox
     operator SDK — not `POST /outbound`, which makes the AI AGENT dial. The
     provider reports whether this user has been signed; without the operator
     site configured there is no session and no call. */
  const { ready: canCall, unavailableReason, dial } = useCalls();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendError, setSendError] = useState('');
  /* Confirmation that a message actually went out, with where it went. */
  const [sentNotice, setSentNotice] = useState('');
  const [isSending, setIsSending] = useState(false);

  const debouncedSearch = useDebounced(searchQuery);

  /* Thread list — channel and search both filter server-side. */
  const listState = useApi(
    () =>
      conversationsApi.list({
        channel: selectedChannelFilter === 'all' ? undefined : selectedChannelFilter,
        agentId: selectedAgentFilter === 'all' ? undefined : selectedAgentFilter,
        search: debouncedSearch || undefined
      }),
    [selectedChannelFilter, selectedAgentFilter, debouncedSearch]
  );

  const conversations = listState.data?.data || [];

  const activeConvoId =
    (propSelectedConvoId !== undefined && propSelectedConvoId !== null
      ? propSelectedConvoId
      : internalActiveConvoId) || conversations[0]?.id || null;

  const setActiveConvoId = (id: string) => {
    if (propSetSelectedConvoId) propSetSelectedConvoId(id);
    setInternalActiveConvoId(id);
  };

  useEffect(() => {
    if (propSelectedConvoId) {
      setInternalActiveConvoId(propSelectedConvoId);
    }
  }, [propSelectedConvoId]);

  /* The list rows carry no messages, so the open thread is fetched by id. */
  const threadState = useApi(
    () => (activeConvoId ? conversationsApi.get(activeConvoId) : Promise.resolve(null)),
    [activeConvoId]
  );

  const activeConvo = threadState.data || conversations.find((c: any) => c.id === activeConvoId);

  /* Opening a thread clears its unread badge. */
  useEffect(() => {
    if (!activeConvoId) return;
    const row = conversations.find((c: any) => c.id === activeConvoId);
    if (!row || !row.unread) return;
    conversationsApi
      .markRead(activeConvoId)
      .then(() => listState.refetch())
      .catch(() => {
        /* a badge that fails to clear isn't worth interrupting the user */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvoId]);

  useEffect(() => {
    if (!activeConvo) return;

    /* Default to a channel the agent is actually integrated with. A web-chat
       thread has no outbound channel at all, so defaulting to the
       conversation's own channel left the composer set to something that could
       never send. */
    const integrated = new Set(
      activeConvo.agentStatus === 'published'
        ? (activeConvo.agentTriggerChannels ?? []).map((c: string) => String(c).toLowerCase())
        : []
    );
    const offered = ['whatsapp', 'sms', 'email'].filter((c) => integrated.has(c));

    setComposerChannel(
      activeConvo.channel && offered.includes(activeConvo.channel)
        ? activeConvo.channel
        : offered[0] ?? ''
    );
  }, [activeConvoId, activeConvo?.channel, activeConvo?.agentTriggerChannels, activeConvo?.agentStatus]);

  const filteredConversations = conversations;

  /* No invented fallbacks: a placeholder showing a phone number the customer
     does not have reads as though we hold it. */
  const getChannelPlaceholder = () => {
    const who = activeConvo?.name ?? 'this customer';
    if (composerChannel === 'whatsapp') return `Type a WhatsApp message to ${who}...`;
    if (composerChannel === 'sms') {
      return activeConvo?.phone
        ? `Type an SMS message (${activeConvo.phone})...`
        : `Type an SMS message to ${who}...`;
    }
    if (composerChannel === 'email') {
      return activeConvo?.email
        ? `Type an Email to ${activeConvo.email}...`
        : `Type an Email to ${who}...`;
    }
    return `Log phone call notes or trigger call with ${who}...`;
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || !activeConvoId) return;

    setSendError('');
    setSentNotice('');
    setIsSending(true);
    setInputMessage('');
    setShowEmojiPicker(false);

    try {
      /* Goes through Perfox. The previous call only recorded a message locally,
         so it appeared in the thread having never reached the customer. */
      const result = await conversationsApi.send(activeConvoId, {
        channel: composerChannel as 'whatsapp' | 'sms' | 'email',
        text,
      });

      /* A 201 means Perfox took the request, not that it went out — say so
         rather than showing a message that looks delivered. */
      if (!result.sendAuthorized) {
        setSendError(
          `Perfox accepted the message but ${
            activeConvo?.agentName || 'the agent'
          } is not authorized to send on ${composerChannel}. It was not delivered.`
        );
      } else {
        setSentNotice(`Sent via ${composerChannel} to ${result.to}`);
      }

      /* Re-read from Perfox, which now owns the message. */
      threadState.refetch();
      listState.refetch();
    } catch (err: any) {
      setSendError(err?.message || 'Message could not be sent.');
      setInputMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const emojis = ['👍', '👋', '✅', '📦', '💬', '🎉', '📋', '⭐'];

  if (listState.loading && conversations.length === 0) {
    return <LoadingState label="Loading conversations…" />;
  }

  if (listState.error && conversations.length === 0) {
    return <ErrorState message={listState.error} onRetry={listState.refetch} />;
  }

  /* Whether anything is narrowing the list, so an empty result can say which
     it is: nothing exists, or nothing matches. */
  const hasActiveFilter =
    selectedChannelFilter !== 'all' || selectedAgentFilter !== 'all' || Boolean(searchQuery.trim());

  const messages = activeConvo?.messages || [];

  /* Which channels the composer may offer.

     The agent's integrated channels decide it: a customer's phone number does
     not mean there is an SMS integration to send through, which is what the
     previous rule assumed. The conversation's own channel counts too — a thread
     that actually ran on WhatsApp is proof that channel works, even when the
     agent record does not list it.

     Anything not integrated is not rendered at all, rather than shown disabled:
     a channel that cannot exist here is not a choice to grey out. */
  const SENDABLE = ['whatsapp', 'sms', 'email'] as const;

  const CHANNEL_LABELS: Record<string, string> = {
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    email: 'Email',
  };

  /* The agent's TRIGGER nodes decide what is usable here, read from its graph
     when the thread is opened. An agent triggered only on web chat cannot be
     messaged on WhatsApp, so that option is shown but not clickable. Perfox
     also refuses outbound from an agent that is not published. */
  const agentPublished = activeConvo?.agentStatus === 'published';
  const integratedChannels = new Set(
    agentPublished
      ? ((activeConvo?.agentTriggerChannels as string[] | undefined) ?? []).map((c) =>
          String(c).toLowerCase()
        )
      : []
  );

  /* Every channel is listed; the ones the agent is not integrated with are
     shown disabled rather than hidden, so it is visible that they exist and
     simply are not available here. */
  const sendChannels = SENDABLE.map((key) => ({
    key,
    label: CHANNEL_LABELS[key],
    available: integratedChannels.has(key),
  }));
  const canSendAnywhere = sendChannels.some((c) => c.available);

  /* Calling needs a number to dial — nothing else. The button stays visible so
     the action is discoverable, but is not clickable without one. */
  const hasPhoneNumber = Boolean(activeConvo?.phone);
  /* Two independent requirements: somebody to call, and the means to call
     them. Both keep the button visible and explain themselves in the tooltip
     rather than hiding the action. */
  const canCallOut = hasPhoneNumber && canCall;
  /* The server says where the list came from. A mirrored copy shown as though it
     were live is how a stale thread gets acted on. */
  const isMirrored = listState.data?.source === 'local';

  return (
    <div className="flex flex-col w-full h-[calc(100vh-6.75rem)] gap-2">
      {isMirrored && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 shrink-0">
          <span className="material-symbols-outlined text-base shrink-0">cloud_off</span>
          <span className="font-caption text-caption">
            Perfox could not be reached, so this is the last mirrored copy — it may be out of
            date and new messages will not appear.
            {listState.data?.sourceError ? ` (${listState.data.sourceError})` : ''}
          </span>
        </div>
      )}
    <div className="flex w-full flex-1 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm border border-surface-container">
      {/* LEFT PANEL: Conversations list */}
      <div className="w-80 md:w-96 flex flex-col bg-surface-container-lowest shrink-0 border-r border-surface-container">
        {/* Panel Header */}
        <div className="p-space-sm pb-space-xs space-y-space-xs">
          <div className="flex items-center justify-between">
            <h1 className="font-title-lg text-title-lg text-on-surface font-semibold tracking-tight">
              Conversations
            </h1>
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="edit_square"
              onClick={() => setIsNewConvoOpen(true)}
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

          {/* Agent filter — only the agents that actually handled a thread are
              offered, so the list never contains a choice that returns nothing.
              The server supplies them alongside the conversations. */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">
              smart_toy
            </span>
            <select
              value={selectedAgentFilter}
              onChange={(e) => setSelectedAgentFilter(e.target.value)}
              className="flex-1 min-w-0 h-8 px-2 text-xs rounded-lg bg-surface-container-low text-on-surface border border-surface-container-high cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">
                All agents ({(listState.data?.agents ?? []).reduce((sum, a) => sum + a.count, 0)})
              </option>
              {(listState.data?.agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.id} ({agent.count})
                </option>
              ))}
            </select>
          </div>

          {/* Channel Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'whatsapp', label: 'WhatsApp' },
              { key: 'voice', label: 'Phone' },
              { key: 'sms', label: 'SMS' },
              { key: 'email', label: 'Email' }
            ].map((tab) => (
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
        </div>

        <div className="h-px bg-surface-container w-full"></div>

        {/* Conversation Thread List */}
        <div className="flex-1 overflow-y-auto p-space-xs space-y-1">
          {/* An empty list used to render as blank space, which reads as broken
              rather than as "nothing matched". */}
          {filteredConversations.length === 0 && (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <span className="material-symbols-outlined text-2xl text-outline">search_off</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {hasActiveFilter ? 'No matching threads' : 'No conversations'}
              </span>
              <span className="font-caption text-caption text-on-surface-variant">
                {hasActiveFilter
                  ? 'Try a different channel, agent or search term.'
                  : 'Threads appear here as customers message you.'}
              </span>
            </div>
          )}

          {filteredConversations.map((c: any) => {
            const isActive = c.id === activeConvoId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvoId(c.id)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-surface-container-high font-semibold'
                    : 'hover:bg-surface-container'
                }`}
              >
                <div className="relative shrink-0">
                  {c.avatar ? (
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shrink-0">
                      {c.initials || 'DM'}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${statusStyle(c.status).dot}`}
                  ></span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                      {c.name}
                    </h3>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      {c.timestamp}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate font-normal">
                    {c.lastMessage}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[10px] font-medium shrink-0">
                        {c.channelLabel}
                      </span>
                      {c.status && (
                        <span
                          className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] font-semibold shrink-0 ${
                            statusStyle(c.status).chip
                          }`}
                        >
                          {c.status}
                        </span>
                      )}
                      {/* Which agent handled it — the useful half of workflowId. */}
                      {c.agentName && (
                        <span
                          className="font-label-sm text-[10px] text-on-surface-variant truncate"
                          title={c.agentName}
                        >
                          {c.agentName}
                        </span>
                      )}
                    </span>
                    {c.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-mono text-[11px] font-semibold">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: Selected Conversation */}
      {/* The right panel needs an open thread. With none — an empty filter, or a
          workspace with no conversations — the layout stays put so the filters
          remain reachable, and the reason is stated here rather than as a
          page-wide failure. */}
      {!activeConvo ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F8F9FD] px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant">
              forum
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-title-md text-title-md text-on-surface font-semibold">
              {conversations.length === 0 && hasActiveFilter
                ? 'No conversations match these filters'
                : 'No conversations yet'}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
              {conversations.length === 0 && hasActiveFilter
                ? 'Nothing was found on this channel or agent. Clear the filters to see the rest.'
                : 'Once a customer messages one of your channels, the thread appears here.'}
            </p>
          </div>
          {hasActiveFilter && (
            <Button
              variant="outline"
              size="sm"
              startIcon="filter_alt_off"
              onClick={() => {
                setSelectedChannelFilter('all');
                setSelectedAgentFilter('all');
                setSearchQuery('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FD]">
        {/* Top Header */}
        <div className="h-12 px-space-md bg-surface-container-lowest border-b border-surface-container flex items-center justify-between shrink-0">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="relative shrink-0">
              {activeConvo.avatar ? (
                <img
                  src={activeConvo.avatar}
                  alt={activeConvo.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shrink-0">
                  {activeConvo.initials || 'DM'}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${statusStyle(activeConvo.status).dot}`}
              ></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-title-md text-title-md text-on-surface font-semibold truncate">
                  {activeConvo.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[11px] font-semibold">
                  {activeConvo.channelLabel}
                </span>
                {activeConvo.status && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] font-semibold flex items-center gap-1 ${
                      statusStyle(activeConvo.status).chip
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${statusStyle(activeConvo.status).dot}`}
                    ></span>
                    {activeConvo.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm truncate">
                <span>{activeConvo.phone}</span>
                <span>•</span>
                <span className="truncate">{activeConvo.email}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="soft"
              size="sm"
              startIcon="call"
              onClick={async () => {
                /* The operator dials from this browser; the overlay at the app
                   root takes over from here. The customer's name is passed
                   because the SDK only ever knows the number. */
                try {
                  /* The agent that already handles this thread, so the call is
                     registered against it rather than the site default. */
                  await dial(activeConvo.phone, {
                    label: activeConvo.name,
                    agentId: activeConvo.agentId,
                  });
                } catch (err: any) {
                  setSendError(err?.message || 'The call could not be started.');
                }
              }}
              disabled={!canCallOut}
              title={
                !hasPhoneNumber
                  ? 'No phone number on this customer'
                  : !canCall
                    ? unavailableReason
                    : `Call ${activeConvo.name} on ${activeConvo.phone}`
              }
            >
              <span className="hidden sm:inline">Call</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="search"
              title="Search messages"
              aria-label="Search messages"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="more_vert"
              title="Options"
              aria-label="Options"
            />
          </div>
        </div>

        {/* Chat Message Thread */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-4 space-y-2">
          <div className="flex items-center justify-center">
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">
              Today
            </span>
          </div>

          <ConversationTranscript messages={messages} />
        </div>

        {/* BOTTOM COMPOSER: Simple, clean, uncluttered with Send via channel selector */}
        <div className="p-space-sm bg-surface-container-lowest border-t border-surface-container relative">
          {sendError && <ErrorBanner message={sendError} className="mb-2" />}
          {sentNotice && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span className="font-caption text-caption flex-1">{sentNotice}</span>
              <button
                type="button"
                onClick={() => setSentNotice('')}
                className="material-symbols-outlined text-base cursor-pointer"
                aria-label="Dismiss"
              >
                close
              </button>
            </div>
          )}

          {/* Channel Selector Chips (Send via: WhatsApp, SMS, Email) */}
          <div className="flex items-center gap-1 mb-1.5 flex-wrap">
            <span className="text-on-surface-variant font-label-sm text-label-sm mr-1 font-medium">
              Send via:
            </span>
            {sendChannels.map((channel) => (
              <Button
                key={channel.key}
                variant={composerChannel === channel.key ? 'primary' : 'hover'}
                size="xs"
                disabled={!channel.available}
                title={
                  channel.available
                    ? `Send via ${channel.label}`
                    : !agentPublished
                      ? `${activeConvo?.agentName || 'This agent'} is ${
                          activeConvo?.agentStatus || 'not published'
                        } — only a published agent can send`
                      : `${activeConvo?.agentName || 'This agent'} has no ${
                          channel.label
                        } sender configured`
                }
                onClick={() => setComposerChannel(channel.key)}
              >
                {channel.label} {composerChannel === channel.key ? '(Active)' : ''}
              </Button>
            ))}
            {!canSendAnywhere && (
              <span className="font-caption text-caption text-on-surface-variant">
                {!agentPublished
                  ? `${activeConvo?.agentName || 'This agent'} is ${
                      activeConvo?.agentStatus || 'not published'
                    } — only a published agent can send.`
                  : `${
                      activeConvo?.agentName || 'This agent'
                    } has no outbound sender configured in Perfox — replies can only happen in the chat the customer started.`}
              </span>
            )}
          </div>

          {/* Quick Emoji Picker Popover */}
          {showEmojiPicker && (
            <div className="absolute bottom-16 left-6 p-2 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high flex items-center gap-2 z-30">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setInputMessage(inputMessage + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1.5 text-lg hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Input Container */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2 focus-within:bg-surface-container focus-within:ring-1 focus-within:ring-primary transition-all">
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="sentiment_satisfied"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
              aria-label="Add emoji"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              startIcon="attach_file"
              onClick={() => alert("Attach product quote, catalog sheet, or image")}
              title="Attach file"
              aria-label="Attach file"
            />

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={!canSendAnywhere}
              placeholder={
                canSendAnywhere
                  ? getChannelPlaceholder()
                  : 'No channel available to reply on'
              }
              className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none px-1 disabled:cursor-not-allowed"
            />

            <Button
              variant="primary"
              size="md"
              type="submit"
              endIcon="send"
              disabled={!inputMessage.trim() || isSending || !canSendAnywhere}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
      )}
    </div>
    <NewConversationModal
        open={isNewConvoOpen}
        onClose={() => setIsNewConvoOpen(false)}
        onStarted={(conversationId) => {
          /* Perfox creates the thread, so the list has to be re-read before it
             can be opened — it does not exist locally yet. */
          listState.refetch();
          if (conversationId) setActiveConvoId(conversationId);
        }}
      />
    </div>
  );
}
