/**
 * DevSync Community & Chat Service
 * Supports WhatsApp-style Direct Messaging, Group Chats, Channels, Reactions, and Status Updates
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const CommunityService = {
  // Communities & Channels
  async getChannels() {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getChannels();
    }
    return await apiClient.get('/community/channels/');
  },

  async getCommunities() {
    return await apiClient.get('/chat/communities/');
  },

  async getMessages(channelId) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getMessages(channelId);
    }
    return await apiClient.get(`/community/channels/${channelId}/messages/`);
  },

  async postMessage(channelId, text) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.postMessage(channelId, text);
    }
    return await apiClient.post(`/community/channels/${channelId}/messages/`, { text });
  },

  // 1:1 & Group Chat Conversations
  async getConversations() {
    return await apiClient.get('/chat/conversations/');
  },

  async getConversationMessages(conversationId) {
    return await apiClient.get(`/chat/conversations/${conversationId}/messages/`);
  },

  async sendConversationMessage(conversationId, text, replyTo = null, attachment = null) {
    return await apiClient.post(`/chat/conversations/${conversationId}/messages/`, {
      text,
      reply_to: replyTo,
      attachment
    });
  },

  async markConversationRead(conversationId) {
    return await apiClient.post(`/chat/conversations/${conversationId}/read/`, {});
  },

  async reactToMessage(messageId, emoji, conversationId) {
    return await apiClient.post(`/chat/messages/${messageId}/react/`, {
      emoji,
      conversation_id: conversationId
    });
  },

  async createConversation(data) {
    return await apiClient.post('/chat/conversations/', data);
  },

  // Developer 24-Hour Status Updates
  async getStatuses() {
    return await apiClient.get('/chat/statuses/');
  },

  async publishStatus(text, audience = 'everyone', media = null) {
    return await apiClient.post('/chat/statuses/', { text, audience, media });
  },

  async deleteStatus(statusId) {
    return await apiClient.delete(`/chat/statuses/${statusId}/`);
  }
};
