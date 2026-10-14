/**
 * DevSync Profile Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const ProfileService = {
  async getProfile() {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getCurrentUser();
    }
    return await apiClient.get('/users/me/');
  },

  async updateProfile(data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.updateProfile(data);
    }
    return await apiClient.patch('/users/me/', data);
  },

  async getDeveloperProfile(username) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getDeveloperByUsername(username);
    }
    return await apiClient.get(`/developers/${username}/`);
  },

  async updateDeveloperProfile(username, data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.updateDeveloperProfile(username, data);
    }
    return await apiClient.patch(`/developers/${username}/`, data);
  },

  async togglePinnedProject(username, projectId) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.togglePinnedProject(username, projectId);
    }
    return await apiClient.post(`/developers/${username}/pin/`, { projectId });
  },

  async toggleFollow(username) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.toggleFollow(username);
    }
    return await apiClient.post(`/developers/${username}/follow/`);
  }
};
