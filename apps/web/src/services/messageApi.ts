import { apiClient } from "./http";
import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatMember,
  ChatMessage,
  MessageInboxSync,
} from "../types/api";

export const messageApi = {
  sync(organizationId: string, conversationId?: string) {
    return apiClient.get<MessageInboxSync>("/messages/sync", {
      params: { organizationId, conversationId },
    });
  },

  directory(organizationId: string) {
    return apiClient.get<{ members: ChatMember[] }>("/messages/directory", {
      params: { organizationId },
    });
  },

  listConversations(organizationId: string) {
    return apiClient.get<{ conversations: ChatConversationSummary[] }>("/messages/conversations", {
      params: { organizationId },
    });
  },

  createConversation(body: {
    organizationId: string;
    type: "dm" | "group";
    title?: string;
    memberIds: string[];
  }) {
    return apiClient.post<{ conversation: ChatConversationDetail }>("/messages/conversations", body);
  },

  getConversation(conversationId: string) {
    return apiClient.get<{ conversation: ChatConversationDetail }>(
      `/messages/conversations/${conversationId}`,
    );
  },

  listMessages(conversationId: string, params?: { after?: string; limit?: number }) {
    return apiClient.get<{ messages: ChatMessage[] }>(
      `/messages/conversations/${conversationId}/messages`,
      { params },
    );
  },

  sendMessage(conversationId: string, body: string) {
    return apiClient.post<{ message: ChatMessage }>(
      `/messages/conversations/${conversationId}/messages`,
      { body },
    );
  },

  markRead(conversationId: string) {
    return apiClient.post<{ ok: boolean }>(`/messages/conversations/${conversationId}/read`);
  },

  editMessage(conversationId: string, messageId: string, body: string) {
    return apiClient.patch<{ message: ChatMessage }>(
      `/messages/conversations/${conversationId}/messages/${messageId}`,
      { body },
    );
  },

  deleteMessages(
    conversationId: string,
    body: { messageIds: string[]; scope: "me" | "all" },
  ) {
    return apiClient.post<{
      scope: "me" | "all";
      hiddenIds: string[];
      messages: ChatMessage[];
    }>(`/messages/conversations/${conversationId}/messages/delete`, body);
  },

  addMembers(conversationId: string, memberIds: string[]) {
    return apiClient.post<{ conversation: ChatConversationDetail }>(
      `/messages/conversations/${conversationId}/members`,
      { memberIds },
    );
  },

  removeMember(conversationId: string, userId: string) {
    return apiClient.delete<{ conversation: ChatConversationDetail | null; left: boolean }>(
      `/messages/conversations/${conversationId}/members/${userId}`,
    );
  },
};
