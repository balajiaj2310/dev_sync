/**
 * DevSync Profile Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const ProfileService = {
  async getProfile() {
    try {
      const user = await apiClient.get('/users/me/');
      if (user && (user.id || user.username)) return user;
    } catch (err) {
      // Check localStorage session
      const raw = localStorage.getItem(APP_CONFIG.storageKeys.userSession);
      if (raw) {
        try { return JSON.parse(raw); } catch (e) {}
      }
    }
    return await MockAPI.getCurrentUser();
  },

  async updateProfile(data) {
    try {
      const res = await apiClient.patch('/users/me/', data);
      if (res) return res;
    } catch (err) {
      console.warn('[ProfileService] updateProfile API failed, falling back:', err);
    }
    return await MockAPI.updateProfile(data);
  },

  async getDeveloperProfile(username) {
    try {
      const dev = await apiClient.get(`/developers/${username}/`);
      if (dev && (dev.id || dev.username)) return dev;
    } catch (err) {
      console.warn(`[ProfileService] Backend getDeveloperProfile(${username}) failed:`, err);
    }
    return await MockAPI.getDeveloperByUsername(username);
  },

  async updateDeveloperProfile(username, data) {
    try {
      const res = await apiClient.patch(`/developers/${username}/`, data);
      if (res) return res;
    } catch (err) {
      console.warn('[ProfileService] updateDeveloperProfile API failed, falling back:', err);
    }
    return await MockAPI.updateDeveloperProfile(username, data);
  },

  async togglePinnedProject(username, projectId) {
    try {
      const res = await apiClient.post(`/developers/${username}/pin/`, { projectId });
      if (res) return res;
    } catch (err) {
      console.warn('[ProfileService] togglePinnedProject API failed, falling back:', err);
    }
    return await MockAPI.togglePinnedProject(username, projectId);
  },

  async toggleFollow(username) {
    try {
      const res = await apiClient.post(`/developers/${username}/follow/`);
      if (res) return res;
    } catch (err) {
      console.warn('[ProfileService] toggleFollow API failed, falling back:', err);
    }
    return await MockAPI.toggleFollow(username);
  }
};
