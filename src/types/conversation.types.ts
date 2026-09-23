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
  /** The channels that agent is integrated with. This, not the customer's phone
      or email, decides what the composer may offer: holding a number does not
      mean there is an SMS integration to send through. */
  agentChannels?: string[];

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
