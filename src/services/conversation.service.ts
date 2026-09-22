import { client } from './client';
import {
  ConversationFilters,
  ConversationItem,
  NewConversationPayload,
  SendMessagePayload,
  UnreadCount,
} from '../types/conversation.types';

export const conversationService = {
  /**
   * List threads, newest first.
   *
   * The endpoint documents `page` / `limit` in Swagger but ignores them — every
   * call returns the whole set — so the caller windows the list itself. Once the
   * backend honours its own paging this can pass the params through.
   */
  async getConversations(filters?: ConversationFilters): Promise<ConversationItem[]> {
    const params: Record<string, string | undefined> = {};
    if (filters?.channel && filters.channel !== 'all') params.channel = filters.channel;
    if (filters?.search) params.search = filters.search;

    const response = await client.get<ConversationItem[]>('/conversations', { params });
    return response.data || [];
  },

  /** One thread with its full `messages` array. */
  async getConversation(id: string, options?: { signal?: AbortSignal }): Promise<ConversationItem> {
    const response = await client.get<ConversationItem>(
      `/conversations/${encodeURIComponent(id)}`,
      options
    );
    if (!response.data) {
      throw new Error(response.message || 'Conversation not found');
    }
    return response.data;
  },

  /** Unread threads and messages, for the sidebar badge. */
  async getUnreadCount(): Promise<UnreadCount> {
    const response = await client.get<UnreadCount>('/conversations/unread-count');
    return response.data || { threads: 0, messages: 0 };
  },

  /**
   * Start a thread.
   *
   * It will not come back from getConversations(): that endpoint serves the
   * Perfox list whenever Perfox is reachable, and a thread created here lives
   * only in the local store. The caller has to hold on to what is returned.
   */
  async createConversation(payload: NewConversationPayload): Promise<ConversationItem> {
    const response = await client.post<ConversationItem>('/conversations', payload);
    if (!response.data) {
      throw new Error(response.message || 'Failed to start the conversation');
    }
    return response.data;
  },

  /** Append a message to a thread. Returns the updated thread. */
  async sendMessage(id: string, payload: SendMessagePayload): Promise<ConversationItem> {
    const response = await client.post<ConversationItem>(
      `/conversations/${encodeURIComponent(id)}/messages`,
      payload
    );
    if (!response.data) {
      throw new Error(response.message || 'Failed to send the message');
    }
    return response.data;
  },

  /** Clear the unread badge on a thread. */
  async markAsRead(id: string): Promise<ConversationItem | null> {
    const response = await client.patch<ConversationItem>(
      `/conversations/${encodeURIComponent(id)}/read`
    );
    return response.data || null;
  },
};
