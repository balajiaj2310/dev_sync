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
  }
};
