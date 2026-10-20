/**
 * DevSync Notifications Page Controller
 * High-performance, accessible, responsive notification center
 * Supports real filtering, date grouping, connection actions, mark as read/unread, and deletion
 */

import { NotificationService } from '../services/notification-service.js';
import { toastSuccess, toastDanger, toastInfo } from '../components/toast.js';

let notificationsState = [];
let summaryState = { total: 0, unread: 0, connection_requests: 0 };
let currentFilter = 'all';

/**
 * Format timestamp into human-readable relative time string
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const now = Math.floor(Date.now() / 1000);
  const diffSec = Math.max(0, now - Math.floor(timestamp));

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Group notifications into date buckets: Today, Yesterday, Earlier This Week, Older
 */
function groupNotificationsByDate(list) {
  const now = Date.now() / 1000;
  const groups = {
    today: [],
    yesterday: [],
    earlierThisWeek: [],
    older: []
  };

  list.forEach(item => {
    const ts = item.timestamp || now;
    const diff = now - ts;

    if (diff < 86400) {
      groups.today.push(item);
    } else if (diff < 172800) {
      groups.yesterday.push(item);
    } else if (diff < 604800) {
      groups.earlierThisWeek.push(item);
    } else {
      groups.older.push(item);
    }
  });

  return groups;
}

/**
 * Filter notifications according to the active tab
 */
function getFilteredNotifications() {
  switch (currentFilter) {
    case 'unread':
      return notificationsState.filter(n => n.unread === true);
    case 'mentions':
      return notificationsState.filter(n => n.category === 'mention');
    case 'pull-requests':
      return notificationsState.filter(n => n.category === 'pull_request');
    case 'repository':
      return notificationsState.filter(n => n.category === 'repository');
    case 'connections':
      return notificationsState.filter(n => n.category === 'connection');
    case 'all':
    default:
      return [...notificationsState];
  }
}

/**
 * Refresh summary card counts & tab badges based on current state
 */
function updateSummaryAndBadges() {
  const total = notificationsState.length;
  const unread = notificationsState.filter(n => n.unread).length;
  const pendingRequests = notificationsState.filter(
    n => n.category === 'connection' && n.connection_status === 'pending'
  ).length;

  summaryState = { total, unread, connection_requests: pendingRequests };

  // Summary Cards
  const totalEl = document.getElementById('summary-total-count');
  const unreadEl = document.getElementById('summary-unread-count');
  const requestsEl = document.getElementById('summary-requests-count');

  if (totalEl) totalEl.textContent = total;
  if (unreadEl) unreadEl.textContent = unread;
  if (requestsEl) requestsEl.textContent = pendingRequests;

  // Tab Badges
  const badgeAll = document.getElementById('tab-badge-all');
  const badgeUnread = document.getElementById('tab-badge-unread');
  const badgeConnections = document.getElementById('tab-badge-connections');

  if (badgeAll) badgeAll.textContent = total;
  if (badgeUnread) badgeUnread.textContent = unread;
  if (badgeConnections) {
    badgeConnections.textContent = pendingRequests;
    badgeConnections.style.display = pendingRequests > 0 ? 'inline-block' : 'none';
  }
}

/**
 * Category Icon rendering helper
 */
function getCategoryBadgeHtml(category) {
  switch (category) {
    case 'pull_request':
      return `
        <span class="notification-type-badge cat-pr" title="Pull Request">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
        </span>`;
    case 'repository':
      return `
        <span class="notification-type-badge cat-repo" title="Repository">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </span>`;
    case 'connection':
      return `
        <span class="notification-type-badge cat-connection" title="Connection Request">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </span>`;
    case 'issue':
      return `
        <span class="notification-type-badge cat-issue" title="Issue">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </span>`;
    case 'mention':
      return `
        <span class="notification-type-badge cat-mention" title="Mention">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
        </span>`;
    case 'team':
      return `
        <span class="notification-type-badge cat-team" title="Team Activity">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>`;
    default:
      return '';
  }
}

/**
 * Contextual actions rendering helper
 */
function renderContextualActions(notif) {
  // 1. Connection Request Actions (Accept & Decline)
  if (notif.category === 'connection') {
    if (notif.connection_status === 'accepted') {
      return `
        <div class="notification-actions-area">
          <span class="badge-connected-status">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Connected
          </span>
        </div>`;
    }
    if (notif.connection_status === 'declined') {
      return `
        <div class="notification-actions-area">
          <span class="badge-declined-status">Declined</span>
        </div>`;
    }
    return `
      <div class="notification-actions-area" id="conn-actions-${notif.id}">
        <button class="btn-action-primary btn-accept-conn" data-id="${notif.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Accept
        </button>
        <button class="btn-action-outline btn-decline-conn" data-id="${notif.id}">
          Decline
        </button>
      </div>`;
  }

  // 2. Pull Request Actions
  if (notif.category === 'pull_request') {
    const label = notif.type === 'pr_review_requested' ? 'Review Changes' : 'View Pull Request';
    return `
      <div class="notification-actions-area">
        <a href="${notif.link || '../pull-requests/list.html'}" class="btn-action-outline">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/></svg>
          ${label}
        </a>
      </div>`;
  }

  // 3. Repository Actions
  if (notif.category === 'repository') {
    return `
      <div class="notification-actions-area">
        <a href="${notif.link || '../repositories/list.html'}" class="btn-action-outline">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          View Activity
        </a>
      </div>`;
  }

  // 4. Issue Actions
  if (notif.category === 'issue') {
    return `
      <div class="notification-actions-area">
        <a href="${notif.link || '../issues/list.html'}" class="btn-action-outline">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
          View Issue
        </a>
      </div>`;
  }

  return '';
}

/**
 * Render single notification row HTML
 */
function renderNotificationRow(notif) {
  const actor = notif.actor || { name: 'DevSync Member', username: 'dev', avatar: '' };
  const avatarUrl = actor.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
  const targetBadge = notif.target ? `<span class="notification-target-badge">${escapeHtml(notif.target)}</span>` : '';
  const timeText = formatTimeAgo(notif.timestamp);

  return `
    <div class="notification-row ${notif.unread ? 'unread' : ''}" data-id="${notif.id}">
      ${notif.unread ? '<span class="unread-indicator-dot" title="Unread notification"></span>' : '<span class="read-placeholder-dot"></span>'}
      
      <div class="notification-avatar-wrapper">
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(actor.name || actor.username)}" class="notification-avatar" />
        ${getCategoryBadgeHtml(notif.category)}
      </div>

      <div class="notification-main">
        <div class="notification-title-line">
          <a href="${escapeHtml(notif.link || '#')}" class="notification-title" data-nav-id="${notif.id}">${escapeHtml(notif.title)}</a>
          ${targetBadge}
        </div>
        <div class="notification-message">${escapeHtml(notif.message)}</div>
        <div class="notification-meta-row">
          <span class="notification-time">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${timeText}
          </span>
        </div>
        ${renderContextualActions(notif)}
      </div>

      <div class="notification-menu-cell">
        <button class="btn-row-menu" data-menu-toggle="${notif.id}" aria-label="Notification options">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
        <div class="notification-dropdown" id="dropdown-${notif.id}">
          <button class="dropdown-item-btn btn-toggle-read" data-id="${notif.id}" data-unread="${notif.unread}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            ${notif.unread ? 'Mark as read' : 'Mark as unread'}
          </button>
          <button class="dropdown-item-btn text-danger btn-delete-notif" data-id="${notif.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
          </button>
        </div>
      </div>
    </div>`;
}

/**
 * Render the full feed inside #notifications-feed-root
 */
function renderFeed() {
  const container = document.getElementById('notifications-feed-root');
  if (!container) return;

  const filtered = getFilteredNotifications();

  // 1. Empty State
  if (filtered.length === 0) {
    if (currentFilter === 'all') {
      container.innerHTML = `
        <div class="notifications-empty-card">
          <div class="empty-icon-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <h2 class="state-title">You're all caught up!</h2>
          <p class="state-desc">New repository updates, mentions and connection requests will appear here as they occur.</p>
          <div class="state-actions">
            <a href="../developers/discover.html" class="btn-action-primary">Explore Developers</a>
            <a href="../repositories/list.html" class="btn-action-outline">View Repositories</a>
          </div>
        </div>`;
    } else {
      const filterNames = {
        'unread': 'unread notifications',
        'mentions': 'mentions',
        'pull-requests': 'pull request updates',
        'repository': 'repository activity',
        'connections': 'connection requests'
      };
      const label = filterNames[currentFilter] || 'notifications';
      container.innerHTML = `
        <div class="notifications-empty-card">
          <div class="empty-icon-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 class="state-title">No ${label}</h2>
          <p class="state-desc">There are currently no items matching the "${currentFilter}" filter.</p>
          <div class="state-actions">
            <button class="btn-action-outline" id="btn-reset-filter">View All Notifications</button>
          </div>
        </div>`;
      
      const resetBtn = document.getElementById('btn-reset-filter');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          setActiveFilter('all');
        });
      }
    }
    return;
  }

  // 2. Group by date
  const groups = groupNotificationsByDate(filtered);
  const groupConfig = [
    { key: 'today', label: 'Today', items: groups.today },
    { key: 'yesterday', label: 'Yesterday', items: groups.yesterday },
    { key: 'earlierThisWeek', label: 'Earlier This Week', items: groups.earlierThisWeek },
    { key: 'older', label: 'Older', items: groups.older }
  ];

  let html = '<div class="notifications-feed">';
  groupConfig.forEach(g => {
    if (g.items.length > 0) {
      html += `
        <div class="date-group">
          <div class="date-group-header">${g.label}</div>
          <div class="date-group-card">
            ${g.items.map(renderNotificationRow).join('')}
          </div>
        </div>`;
    }
  });
  html += '</div>';

  container.innerHTML = html;
  bindFeedInteractions();
}

/**
 * Bind interactive elements inside the notifications feed
 */
function bindFeedInteractions() {
  const container = document.getElementById('notifications-feed-root');
  if (!container) return;

  // 1. Dropdown menus
  container.querySelectorAll('[data-menu-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-menu-toggle');
      const dropdown = document.getElementById(`dropdown-${id}`);
      
      // Close any other open dropdowns
      document.querySelectorAll('.notification-dropdown.show').forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
      });

      if (dropdown) dropdown.classList.toggle('show');
    });
  });

  // Close menus on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.notification-dropdown.show').forEach(d => d.classList.remove('show'));
  });

  // 2. Mark as read / unread toggle
  container.querySelectorAll('.btn-toggle-read').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const isCurrentlyUnread = btn.getAttribute('data-unread') === 'true';

      try {
        if (isCurrentlyUnread) {
          await NotificationService.markAsRead(id);
          const target = notificationsState.find(n => n.id === id);
          if (target) target.unread = false;
          toastSuccess('Notification marked as read.');
        } else {
          await NotificationService.markAsUnread(id);
          const target = notificationsState.find(n => n.id === id);
          if (target) target.unread = true;
          toastInfo('Notification marked as unread.');
        }
        updateSummaryAndBadges();
        renderFeed();
      } catch (err) {
        console.error('Failed to toggle notification status:', err);
        toastDanger('Could not update notification status.');
      }
    });
  });

  // 3. Delete notification
  container.querySelectorAll('.btn-delete-notif').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      try {
        await NotificationService.deleteNotification(id);
        notificationsState = notificationsState.filter(n => n.id !== id);
        toastSuccess('Notification deleted.');
        updateSummaryAndBadges();
        renderFeed();
      } catch (err) {
        console.error('Failed to delete notification:', err);
        toastDanger('Could not delete notification.');
      }
    });
  });

  // 4. Accept Connection Request
  container.querySelectorAll('.btn-accept-conn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Accepting...`;

      try {
        await NotificationService.respondToConnection(id, 'accept');
        const notif = notificationsState.find(n => n.id === id);
        if (notif) {
          notif.connection_status = 'accepted';
          notif.unread = false;
        }
        toastSuccess('Connection request accepted!');
        updateSummaryAndBadges();
        renderFeed();
      } catch (err) {
        console.error('Failed to accept connection:', err);
        btn.disabled = false;
        btn.innerHTML = 'Accept';
        toastDanger('Could not accept connection request.');
      }
    });
  });

  // 5. Decline Connection Request
  container.querySelectorAll('.btn-decline-conn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Declining...`;

      try {
        await NotificationService.respondToConnection(id, 'decline');
        const notif = notificationsState.find(n => n.id === id);
        if (notif) {
          notif.connection_status = 'declined';
          notif.unread = false;
        }
        toastInfo('Connection request declined.');
        updateSummaryAndBadges();
        renderFeed();
      } catch (err) {
        console.error('Failed to decline connection:', err);
        btn.disabled = false;
        btn.innerHTML = 'Decline';
        toastDanger('Could not decline connection request.');
      }
    });
  });

  // 6. Navigation Link Clicking - marks as read on follow
  container.querySelectorAll('[data-nav-id]').forEach(link => {
    link.addEventListener('click', async (e) => {
      const id = link.getAttribute('data-nav-id');
      const notif = notificationsState.find(n => n.id === id);
      if (notif && notif.unread) {
        notif.unread = false;
        updateSummaryAndBadges();
        try {
          await NotificationService.markAsRead(id);
        } catch (_) {}
      }
    });
  });
}

/**
 * Change the active filter tab and re-render
 */
function setActiveFilter(filterKey) {
  currentFilter = filterKey;

  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.getAttribute('data-filter') === filterKey) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  renderFeed();
}

/**
 * Fetch notifications from the backend and initialize UI
 */
async function loadNotifications() {
  const container = document.getElementById('notifications-feed-root');
  if (container) {
    container.innerHTML = `
      <div class="notifications-loading-state">
        <div class="spinner-border spinner-border-sm text-success me-2" role="status"></div>
        <span>Loading notifications...</span>
      </div>`;
  }

  try {
    const res = await NotificationService.getNotifications();
    notificationsState = Array.isArray(res.notifications) ? res.notifications : [];
    summaryState = res.summary || {};
    updateSummaryAndBadges();
    renderFeed();
  } catch (err) {
    console.error('[Notifications] Failed to load data:', err);
    if (container) {
      container.innerHTML = `
        <div class="notifications-error-card">
          <div class="error-icon-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 class="state-title">Couldn't load notifications</h2>
          <p class="state-desc">${escapeHtml(err.message || 'Unable to communicate with the DevSync notification server.')}</p>
          <div class="state-actions">
            <button class="btn-action-primary" id="btn-retry-notifications">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
              Retry
            </button>
          </div>
        </div>`;

      const retryBtn = document.getElementById('btn-retry-notifications');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => loadNotifications());
      }
    }
  }
}

/**
 * Escape raw HTML to prevent injection
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Controller Initialization
 */
export async function initNotificationsPage() {
  // Bind Header "Mark all as read" button
  const markAllBtn = document.getElementById('btn-mark-all-read');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      const hasUnread = notificationsState.some(n => n.unread);
      if (!hasUnread) {
        toastInfo('All notifications are already marked as read.');
        return;
      }
      try {
        await NotificationService.markAllAsRead();
        notificationsState.forEach(n => { n.unread = false; });
        updateSummaryAndBadges();
        renderFeed();
        toastSuccess('All notifications marked as read.');
      } catch (err) {
        console.error('Failed to mark all as read:', err);
        toastDanger('Could not mark notifications as read.');
      }
    });
  }

  // Bind Tab switching
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const filterKey = tab.getAttribute('data-filter');
      setActiveFilter(filterKey);
    });
  });

  // Load notifications from server
  await loadNotifications();
}
