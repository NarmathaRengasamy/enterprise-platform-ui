/* Shapes returned by the conversations module of the backend API.
   The backend already normalises Perfox's snake_case into these camelCase view
   models, so the page renders them almost as-is. */

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
}

export interface ConversationFilters {
  channel?: string;
  search?: string;
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
