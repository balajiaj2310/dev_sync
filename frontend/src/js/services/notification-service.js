/**
 * DevSync Notification Service
 * Connects frontend to live backend notification endpoints
 * Supports real filtering, mark as read/unread, deletion, and connection actions
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

function computeSummary(list) {
  const notifs = Array.isArray(list) ? list : [];
  return {
    total: notifs.length,
    unread: notifs.filter(n => n.unread).length,
    connection_requests: notifs.filter(n => n.category === 'connection' && n.connection_status === 'pending').length,
    mentions: notifs.filter(n => n.category === 'mention').length,
    pull_requests: notifs.filter(n => n.category === 'pull_request').length,
    repository: notifs.filter(n => n.category === 'repository').length
  };
}

export const NotificationService = {
  /**
   * Fetch user notifications with summary counts.
   */
  async getNotifications() {
    try {
      const res = await apiClient.get('/notifications/');
      if (res && Array.isArray(res.notifications)) {
        return {
          notifications: res.notifications,
          summary: res.summary || computeSummary(res.notifications)
        };
      }
      if (Array.isArray(res)) {
        return {
          notifications: res,
          summary: computeSummary(res)
        };
      }
    } catch (err) {
      console.warn('[NotificationService] Live API call failed:', err);
      if (APP_CONFIG.demoMode) {
        const fallback = await MockAPI.getNotifications();
        return {
          notifications: fallback,
          summary: computeSummary(fallback)
        };
      }
      throw err;
    }
    return { notifications: [], summary: { total: 0, unread: 0, connection_requests: 0 } };
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id) {
    return await apiClient.post('/notifications/mark-read/', { id });
  },

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead() {
    return await apiClient.post('/notifications/mark-read/', { all: true });
  },

  /**
   * Mark a single notification as unread.
   */
  async markAsUnread(id) {
    return await apiClient.post('/notifications/mark-unread/', { id });
  },

  /**
   * Delete a notification by ID.
   */
  async deleteNotification(id) {
    return await apiClient.delete(`/notifications/${encodeURIComponent(id)}/`);
  },

  /**
   * Accept or decline an incoming connection request.
   */
  async respondToConnection(notificationId, action) {
    return await apiClient.post('/notifications/connection-action/', {
      notification_id: notificationId,
      action: action // 'accept' or 'decline'
    });
  }
};
