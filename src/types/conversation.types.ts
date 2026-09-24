/* Shapes returned by the conversations module of the backend API.
   The backend already normalises Perfox's snake_case into these camelCase view
   models, so the page renders them almost as-is. */

import type { ApiResponse } from './auth.types';

export type ConversationStatus = 'ended' | 'abandoned' | 'resolved' | 'active' | string;

export type ConversationChannel = 'whatsapp' | 'sms' | 'email' | 'voice' | 'web';

export interface ConversationAttachment {
  // A product card the agent sent
  title?: string;
  sku?: string;
  status?: string;
  image?: string;
  // A file sent with the message
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

export interface ConversationMessage {
  id: string;
  sender: 'me' | 'them' | 'system';
  actor?: string;
  /** Perfox event type. Only user_message / ai_response are real chat turns. */
  eventType?: string;
  text: string;
  time: string;
  timestamp?: string;
  channel?: string;
  toolName?: string;
  toolStatus?: string;
  attachment?: ConversationAttachment;
}

export interface ConversationItem {
  id: string;
  name: string;
  customerId?: string;
  workflowId?: string;
  status?: ConversationStatus;
  summary?: string;
  avatar?: string;
  initials?: string;
  channel: string;
  channels?: string[];
  channelLabel: string;
  channelColor: string;
  phone?: string;
  email?: string;
  unread: number;
  timestamp: string;
  lastMessage: string;
  messages: ConversationMessage[];
  createdAt?: string;
  updatedAt?: string;

  /* ── Resolved server-side, per row ─────────────────────────────────────── */

  /** The Perfox agent that handled the thread — `workflowId` under the name the
      agent filter uses. Empty for a thread started in this UI. */
  agentId?: string;
  agentName?: string;
  /** Perfox's own vocabulary: published | paused | draft. Only a published
      agent can send, which is enforced server-side with a 409. */
  agentStatus?: string;
  /** How conversations with this agent START, as the cached agent list reports
      it. **Not** the composer's gate: that list does not report every trigger an
      agent has, so gating on it hides channels that would work. */
  agentChannels?: string[];
  /** The sender nodes wired on the agent's canvas — how it *could* reach out.
      Informational; the send route does not check it. */
  agentSenderChannels?: string[];
  /**
   * The channels named by trigger nodes on the agent's own graph, and the one
   * thing the composer may gate on — it is the same list the send route checks.
   *
   * **Detail response only.** Reading it costs one Perfox call per agent, so no
   * list row carries it: the composer can only be gated once a thread is open.
   */
  agentTriggerChannels?: string[];

  /** A Perfox conversation carries only a `customer_id`; the backend resolves
      the record and folds these in so a row can name who it is about. */
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerTags?: string[];
  /** False for an anonymous visitor — someone absent from the identified
      customer index, which is most of them. */
  customerKnown?: boolean;
}

export interface ConversationFilters {
  channel?: string;
  search?: string;
  /** Matches the agent that handled the thread. */
  agentId?: string;
}

/**
 * An agent present in the current list, for the agent filter.
 *
 * Built by the backend *before* `agentId` is applied and counted against the
 * channel and search already in force, so selecting an agent never empties the
 * dropdown and each option reports what it would actually return.
 */
export interface ConversationAgentOption {
  id: string;
  name: string;
  count: number;
}

/**
 * Which store answered the list request.
 *
 * `local` is the Mongo mirror, served because Perfox could not be reached — it
 * has to be shown, or a stale copy passes for a live one. `perfox` is **not** a
 * freshness signal: that list is cached 30s server-side, so it can be up to
 * half a minute old and still say `perfox`.
 */
export type ConversationSource = 'perfox' | 'local';

/** `GET /conversations` returns more than `data`; this is the whole envelope. */
export interface ConversationListEnvelope extends ApiResponse<ConversationItem[]> {
  source?: ConversationSource;
  sourceError?: string;
  agents?: ConversationAgentOption[];
}

export interface ConversationListResult {
  conversations: ConversationItem[];
  total: number;
  source: ConversationSource;
  /** Why the live read failed. Only set when `source` is `local`. */
  sourceError: string;
  agents: ConversationAgentOption[];
}

export interface UnreadCount {
  threads: number;
  messages: number;
}

export interface NewConversationPayload {
  name: string;
  channel: ConversationChannel;
  initialMessage: string;
  phone?: string;
  email?: string;
  avatar?: string;
  initials?: string;
}

export interface SendMessagePayload {
  text: string;
  sender?: 'me' | 'them' | 'system';
  channel?: string;
  attachment?: ConversationAttachment;
}

/** The channels a reply can actually go out on. `phone` is not among them:
    Perfox opens a new conversation for a call, so it is not a reply here. */
export type OutboundChannel = 'whatsapp' | 'sms' | 'email';

export interface SendOutboundPayload {
  channel: OutboundChannel;
  text: string;
}

/** A channel a conversation can be started on. `web` is not among them: a web
    chat begins when a visitor opens the widget, not from here. */
export type StartChannel = OutboundChannel | 'phone';

/** An agent that holds a trigger for the channel it is listed under. */
export interface OutboundAgentOption {
  id: string;
  name: string;
  /** Perfox's vocabulary — published | paused | draft. */
  status: string;
  /** False for anything but a published agent: Perfox refuses outbound from
      one, so it is offered disabled rather than hidden. */
  available: boolean;
}

export interface OutboundChannelOption {
  key: StartChannel;
  label: string;
  /** What the recipient field has to hold. */
  contact: 'phone' | 'email';
  /** False when no published agent triggers on it. */
  available: boolean;
  agents: OutboundAgentOption[];
}

/**
 * What `GET /conversations/outbound/options` answers with.
 *
 * Every channel comes back, usable or not, so the UI can show what exists and
 * disable the rest. It is served from the agent cache — the trigger channels
 * are stored during the sync — so it costs no Perfox calls.
 */
export interface OutboundOptions {
  channels: OutboundChannelOption[];
}

/** Starting a conversation that does not exist yet. */
export interface StartConversationPayload {
  agentId: string;
  channel: StartChannel;
  /** The number or address to reach. There is no thread yet, so there is no
      customer record to resolve it from. Email wants an address, every other
      channel a number, and the server rejects the mismatch with a 400. */
  to: string;
  /** Required: Perfox opens the conversation with it. */
  message: string;
  /** Links the new thread to a customer already known to the workspace. */
  customerId?: string;
}

export interface SendOutboundResult {
  /** Perfox opens a **new** conversation for an outbound message, so this is
      not necessarily the thread it was sent from. */
  conversationId: string;
  executionId: string;
  status: string;
  channel: string;
  /**
   * Whether it will actually go out.
   *
   * A 200 only means Perfox accepted the request. `false` means the agent is
   * not authorized to send on that channel, so the customer receives nothing —
   * it must be surfaced, never shown as sent.
   */
  sendAuthorized: boolean;
  /** The address it was sent to, from the customer record. */
  to: string;
  /** The server's own wording, which explains an unauthorized send. */
  message?: string;
}
