import React, { useEffect, useMemo, useState } from 'react';
import { conversationsApi, OutboundChannelOption } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useCalls } from '../calls/CallProvider';
import { Button, ErrorBanner, LoadingState } from '../common';

/**
 * Starts a new outbound conversation.
 *
 * Two dependent dropdowns: a channel, then the agents that can be reached on
 * it. An agent qualifies by having a TRIGGER for that channel — Perfox's
 * `channels` field does not report every trigger, so the list is built from the
 * agent graphs read during the sync.
 *
 * Nothing is hidden. A channel no agent triggers on, and an agent that is not
 * published, both appear disabled with the reason attached — "why is my agent
 * missing" is a worse question than "why is it greyed out".
 */

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new conversation id, so the list can open it. */
  onStarted: (conversationId: string) => void;
}

export default function NewConversationModal({
  open,
  onClose,
  onStarted,
}: NewConversationModalProps) {
  const optionsState = useApi(() => conversationsApi.outboundOptions(), [], { enabled: open });
  const {
    ready: callsReady,
    unavailableReason: callsUnavailable,
    unavailableShort: callsUnavailableShort,
    dial,
  } = useCalls();

  const [channelKey, setChannelKey] = useState('');
  const [agentId, setAgentId] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const channels: OutboundChannelOption[] = optionsState.data?.channels ?? [];
  const channel = channels.find((c) => c.key === channelKey);
  const agents = channel?.agents ?? [];
  const agent = agents.find((a) => a.id === agentId);

  /* Default to the first channel that can actually be used, rather than the
     first in the list — landing on a disabled channel reads as broken. */
  useEffect(() => {
    if (!open || !channels.length || channelKey) return;
    setChannelKey((channels.find((c) => c.available) ?? channels[0]).key);
  }, [open, channels, channelKey]);

  /* The agent list changes with the channel, so a selection from the previous
     channel must not survive into the new one. */
  useEffect(() => {
    setAgentId((agents.find((a) => a.available) ?? agents[0])?.id ?? '');
  }, [channelKey, agents.length]);

  /* Cleared on open so a previous attempt is never half-filled in. */
  useEffect(() => {
    if (!open) return;
    setTo('');
    setMessage('');
    setError('');
    setWarning('');
  }, [open]);

  const recipientLabel = channel?.contact === 'email' ? 'Email address' : 'Phone number';

  /* A call has nothing to open with — Perfox dials and the agent speaks — so
     `opening_message` is optional upstream and the field is not shown. On the
     text channels a message with no message is nothing to send. */
  const isCall = channelKey === 'phone';
  /* A call is placed by the OPERATOR through the SDK, not by an agent through
     `POST /outbound` — so it needs a number and a signed operator, and no agent
     at all. The text channels still go through the agent. */
  const canSend = Boolean(
    to.trim() &&
      agent?.available &&
      (isCall ? callsReady : message.trim()) &&
      !isSending
  );

  const blockedReason = useMemo(() => {
    if (isCall && !callsReady) return callsUnavailable;
    if (!channels.length) return '';
    if (!channel?.agents.length) {
      return `No agent in this workspace has a ${channel?.label ?? 'that'} trigger configured.`;
    }
    if (!channel.available) {
      return `Every agent with a ${channel.label} trigger is unpublished, so none of them can start a conversation.`;
    }
    if (agent && !agent.available) {
      return `${agent.name} is ${agent.status} — only a published agent can start a conversation.`;
    }
    return '';
  }, [isCall, callsReady, callsUnavailable, channels.length, channel, agent]);

  const handleStart = async () => {
    if (!canSend) return;
    setError('');
    setWarning('');
    setIsSending(true);
    try {
      if (isCall) {
        /* The chosen agent handles the call — without it Perfox falls back to
           the site default and the call answers as though no agent is
           registered. The overlay at the app root takes over from here. */
        await dial(to.trim(), { agentId: agent?.id });
        onClose();
        return;
      }

      if (!agent) return;
      const result = await conversationsApi.startConversation({
        agentId: agent.id,
        channel: channelKey,
        to: to.trim(),
        ...(isCall ? {} : { message: message.trim() }),
      });

      /* Accepted is not the same as delivered — saying "started" when Perfox
         refused to authorise it would be a lie the user acts on. */
      if (!result.sendAuthorized) {
        setWarning(
          `Perfox accepted the request but ${agent.name} is not authorized to send on ${channelKey}, so nothing went out.`
        );
        return;
      }

      onStarted(result.conversationId);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not start the conversation.');
    } finally {
      setIsSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between gap-3 p-space-md border-b border-surface-container">
          <h3 className="font-title text-title text-on-surface font-bold">New conversation</h3>
          <Button
            variant="ghost"
            size="icon-sm"
            startIcon="close"
            onClick={onClose}
            aria-label="Close"
          />
        </div>

        <div className="flex flex-col gap-space-md p-space-md overflow-y-auto">
          {error && <ErrorBanner message={error} />}

          {warning && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800">
              <span className="material-symbols-outlined text-base shrink-0">warning</span>
              <span className="font-caption text-caption">{warning}</span>
            </div>
          )}

          {optionsState.loading && !optionsState.data ? (
            <LoadingState label="Loading channels…" />
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Channel
                </span>
                <select
                  value={channelKey}
                  onChange={(e) => setChannelKey(e.target.value)}
                  disabled={isSending}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container cursor-pointer focus:outline-none focus:border-primary"
                >
                  {channels.map((option) => {
                    /* A call does not go through an agent, so agent
                       availability says nothing about whether it can be
                       placed — the operator session does. */
                    const usable = option.key === 'phone' ? callsReady : option.available;
                    /* The real reason, not a guess: a server that is merely
                       unreachable must not be reported as misconfigured. */
                    const why =
                      option.key === 'phone' ? ` — ${callsUnavailableShort}` : ' — no published agent';
                    return (
                      <option key={option.key} value={option.key}>
                        {option.label}
                        {usable ? '' : why}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Agent
                </span>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  disabled={isSending || !agents.length}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container cursor-pointer focus:outline-none focus:border-primary disabled:opacity-60"
                >
                  {!agents.length && <option value="">No agent triggers on this channel</option>}
                  {agents.map((option) => (
                    <option key={option.id} value={option.id} disabled={!option.available}>
                      {option.name}
                      {option.available ? '' : ` — ${option.status}`}
                    </option>
                  ))}
                </select>
              </label>

              {blockedReason && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container">
                  <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">
                    info
                  </span>
                  <span className="font-caption text-caption text-on-surface-variant">
                    {blockedReason}
                  </span>
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  {recipientLabel}
                </span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={isSending}
                  placeholder={channel?.contact === 'email' ? 'name@example.com' : '+91…'}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container focus:outline-none focus:border-primary"
                />
              </label>

              {isCall ? (
                /* Stated rather than left blank: an empty panel here reads as a
                   field that failed to load. */
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container">
                  <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">
                    call
                  </span>
                  <span className="font-caption text-caption text-on-surface-variant">
                    You will be connected to {to.trim() || 'the number'} and speak yourself —
                    this is an operator call, not the AI agent.{' '}
                    {agent?.name ? `${agent.name} handles the call` : 'Pick the agent that handles it'}.
                    Your microphone is used, and starting it rings a real phone.
                  </span>
                </div>
              ) : (
              <label className="flex flex-col gap-1.5">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  Opening message
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSending}
                  rows={4}
                  placeholder="What should the agent open with?"
                  maxLength={2000}
                  className="px-3 py-2 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container resize-none focus:outline-none focus:border-primary"
                />
                {message.length > 1800 && (
                  <span className="font-caption text-caption text-outline">
                    {2000 - message.length} characters left
                  </span>
                )}
              </label>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-space-xs p-space-md border-t border-surface-container">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            startIcon={isCall ? 'call' : 'send'}
            onClick={handleStart}
            disabled={!canSend}
            title={blockedReason || undefined}
          >
            {isSending ? (isCall ? 'Calling…' : 'Starting…') : isCall ? 'Call now' : 'Start conversation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
