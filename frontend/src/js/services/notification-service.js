/**
 * DevSync Notification Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const NotificationService = {
  async getNotifications() {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getNotifications();
    }
    return await apiClient.get('/notifications/');
  },

  async markAllAsRead() {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.markAllNotificationsRead();
    }
    return await apiClient.post('/notifications/mark-read/', {});
  }
};
