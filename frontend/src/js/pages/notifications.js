/**
 * DevSync Notifications Controller
 */

import { NotificationService } from '../services/notification-service.js';
import { toastSuccess } from '../components/toast.js';

export async function initNotificationsPage() {
  const container = document.getElementById('notificationsFeed');
  const markAllBtn = document.getElementById('btnMarkAllRead');

  async function renderNotifications() {
    if (!container) return;
    const notifs = await NotificationService.getNotifications();

    if (notifs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No notifications</div>
          <div class="empty-state-desc">You are all caught up!</div>
        </div>`;
      return;
    }

    container.innerHTML = notifs.map(n => `
      <div class="notification-item ${n.unread ? 'unread' : ''}">
        ${n.unread ? '<span class="notification-dot"></span>' : '<span style="width: 8px;"></span>'}
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 13.5px; margin-bottom: 2px;">
            <a href="${n.link}" style="color: inherit;">${n.title}</a>
          </div>
          <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px;">${n.message}</div>
          <div style="font-size: 11px; color: var(--color-text-secondary);">${n.time}</div>
        </div>
      </div>
    `).join('');
  }

  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      await NotificationService.markAllAsRead();
      toastSuccess('All notifications marked as read.');
      renderNotifications();
    });
  }

  renderNotifications();
}
