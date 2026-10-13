/**
 * DevSync Community Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const CommunityService = {
  async getChannels() {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getChannels();
    }
    return await apiClient.get('/community/channels/');
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
  }
};
