import React, { useState, useEffect } from 'react';
import { INITIAL_CONVERSATIONS } from '../data/mockData';
import { Button } from '../components/common';

interface ConversationsPageProps {
  selectedConversationId?: string | null;
  setSelectedConversationId?: (id: string | null) => void;
}

export default function ConversationsPage({
  selectedConversationId: propSelectedConvoId,
  setSelectedConversationId: propSetSelectedConvoId
}: ConversationsPageProps = {}) {
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [internalActiveConvoId, setInternalActiveConvoId] = useState(
    propSelectedConvoId || INITIAL_CONVERSATIONS[0].id
  );

  const activeConvoId = propSelectedConvoId !== undefined && propSelectedConvoId !== null
    ? propSelectedConvoId
    : internalActiveConvoId;

  const setActiveConvoId = (id) => {
    if (propSetSelectedConvoId) propSetSelectedConvoId(id);
    setInternalActiveConvoId(id);
  };

  useEffect(() => {
    if (propSelectedConvoId) {
      setInternalActiveConvoId(propSelectedConvoId);
    }
  }, [propSelectedConvoId]);

  const [selectedChannelFilter, setSelectedChannelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [composerChannel, setComposerChannel] = useState('whatsapp');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const activeConvo = conversations.find((c) => c.id === activeConvoId) || conversations[0];

  useEffect(() => {
    if (activeConvo && activeConvo.channel) {
      setComposerChannel(activeConvo.channel);
    }
  }, [activeConvoId, activeConvo]);

  const filteredConversations = conversations.filter((c) => {
    const matchesFilter = selectedChannelFilter === 'all' || c.channel === selectedChannelFilter;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getChannelPlaceholder = () => {
    if (composerChannel === 'whatsapp') {
      return `Type a WhatsApp message to ${activeConvo.name}...`;
    } else if (composerChannel === 'sms') {
      return `Type an SMS message (${activeConvo.phone || '+91 98201 44521'})...`;
    } else if (composerChannel === 'email') {
      return `Type an Email to ${activeConvo.email || 'contact@example.com'}...`;
    } else {
      return `Log phone call notes or trigger call with ${activeConvo.name}...`;
    }
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = {
      id: `m_${Date.now()}`,
      sender: 'me',
      text: inputMessage,
      channel: composerChannel,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updated = conversations.map((c) => {
      if (c.id === activeConvoId) {
        return {
          ...c,
          lastMessage: inputMessage,
          messages: [...c.messages, newMessage]
        };
      }
      return c;
    });

    setConversations(updated);
    setInputMessage('');
    setShowEmojiPicker(false);
  };

  const emojis = ['👍', '👋', '✅', '📦', '💬', '🎉', '📋', '⭐'];

  return (
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
              onClick={() => alert("Start new conversation thread")}
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
          {filteredConversations.map((c) => {
            const isActive = c.id === activeConvoId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvoId(c.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
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
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shrink-0">
                      {c.initials || 'DM'}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-label-lg text-label-lg text-on-surface font-semibold truncate">
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
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[10px] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {c.channelLabel}
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
                  {activeConvo.initials || 'DM'}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                  {activeConvo.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-label-sm text-[11px] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {activeConvo.channelLabel}
                </span>
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
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 py-6 space-y-4">
          <div className="flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
              Today
            </span>
          </div>

          {activeConvo.messages.map((m) => {
            const isMe = m.sender === 'me';
            return (
              <div
                key={m.id}
                className={`flex flex-col max-w-lg ${isMe ? 'items-end ml-auto' : 'items-start'}`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl shadow-sm space-y-1 ${
                    isMe
                      ? 'bg-primary text-on-primary rounded-br-sm'
                      : 'bg-surface-container-lowest text-on-surface rounded-bl-sm'
                  }`}
                >
                  {/* Attachment Card if present */}
                  {m.attachment && (
                    <div className="rounded-xl overflow-hidden bg-surface-container text-on-surface mb-2">
                      <img
                        src={m.attachment.image}
                        alt={m.attachment.title}
                        className="w-full h-40 object-cover"
                      />
                      <div className="p-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-label-md text-label-md font-semibold text-on-surface">
                            {m.attachment.title}
                          </p>
                          <p className="font-body-sm text-[11px] text-on-surface-variant">
                            SKU: {m.attachment.sku}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {m.attachment.status}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="font-body-md text-body-md leading-relaxed">
                    {m.text}
                  </p>
                  <div className={`flex items-center justify-end gap-1.5 font-mono text-[10px] ${isMe ? 'text-primary-fixed' : 'text-on-surface-variant'}`}>
                    {m.channel && (
                      <span className="uppercase text-[9px] font-semibold tracking-wider opacity-80">
                        via {m.channel}
                      </span>
                    )}
                    <span>{m.time}</span>
                    {isMe && (
                      <span className="material-symbols-outlined text-[14px]">done_all</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM COMPOSER: Simple, clean, uncluttered with Send via channel selector */}
        <div className="p-space-md bg-surface-container-lowest border-t border-surface-container relative">
          {/* Channel Selector Chips (Send via: WhatsApp, SMS, Email) */}
          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
            <span className="text-on-surface-variant font-label-sm text-label-sm mr-1 font-medium">
              Send via:
            </span>
            <Button
              variant={composerChannel === 'whatsapp' ? 'primary' : 'hover'}
              size="xs"
              onClick={() => setComposerChannel('whatsapp')}
            >
              WhatsApp {composerChannel === 'whatsapp' ? '(Active)' : ''}
            </Button>
            <Button
              variant={composerChannel === 'sms' ? 'primary' : 'hover'}
              size="xs"
              onClick={() => setComposerChannel('sms')}
            >
              SMS {composerChannel === 'sms' ? '(Active)' : ''}
            </Button>
            <Button
              variant={composerChannel === 'email' ? 'primary' : 'hover'}
              size="xs"
              onClick={() => setComposerChannel('email')}
            >
              Email {composerChannel === 'email' ? '(Active)' : ''}
            </Button>
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
              placeholder={getChannelPlaceholder()}
              className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md focus:outline-none px-1"
            />

            <Button
              variant="primary"
              size="md"
              type="submit"
              endIcon="send"
              disabled={!inputMessage.trim()}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
