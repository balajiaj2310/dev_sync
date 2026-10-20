/**
 * DevSync Issues Page Controller
 * Handles Issues List with Filters, Pagination, Real-time Sorting,
 * Issue Details with Comments & Close/Reopen, and Issue Creation with Validation.
 */

import { IssueService } from '../services/issue-service.js';
import { RepositoryService } from '../services/repository-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { toastSuccess, toastDanger, toastInfo } from '../components/toast.js';

export async function initIssuesPage() {
  const issueTableBody = document.getElementById('issueTableBody');
  const isDetailPage = document.getElementById('issueDetailRoot') || (window.location.pathname.includes('detail.html') && window.location.pathname.includes('issues'));
  const isCreatePage = document.getElementById('createIssueForm');

  if (isCreatePage) {
    initCreateIssuePage();
    return;
  }

  if (isDetailPage) {
    initIssueDetailPage();
    return;
  }

  if (issueTableBody) {
    initIssuesListPage();
  }
}

/**
 * 1. Issues Listing Controller
 */
async function initIssuesListPage() {
  const issueTableBody = document.getElementById('issueTableBody');
  const searchInput = document.getElementById('issueSearchInput');
  const labelFilter = document.getElementById('issueLabelFilter');
  const repoFilter = document.getElementById('issueRepoFilter');
  const sortSelect = document.querySelector('select:not(#issueLabelFilter):not(#issueRepoFilter)');
  const tabs = document.querySelectorAll('.issue-tab-btn');
  let currentStatus = 'Open';

  // Populate dynamic repository filter options
  try {
    const repos = await RepositoryService.getRepositories().catch(() => []);
    if (repoFilter && repos.length > 0) {
      const selected = repoFilter.value;
      repoFilter.innerHTML = '<option value="All Repositories">All Repositories</option>' +
        repos.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
      if (selected) repoFilter.value = selected;
    }
  } catch (e) {
    console.warn('Could not populate repo filter dropdown:', e);
  }

  // Update tab counts
  async function updateTabCounts() {
    try {
      const allIssues = await IssueService.getIssues({ status: 'all' });
      const openCount = allIssues.filter(i => (i.status || '').toLowerCase() === 'open').length;
      const closedCount = allIssues.filter(i => (i.status || '').toLowerCase() === 'closed').length;

      tabs.forEach(tab => {
        const st = tab.getAttribute('data-status');
        const badge = tab.querySelector('span');
        if (badge) {
          if (st === 'Open') badge.textContent = openCount;
          else if (st === 'Closed') badge.textContent = closedCount;
        }
      });
    } catch (e) {
      console.warn('Could not fetch tab counts:', e);
    }
  }

  async function renderIssues() {
    if (!issueTableBody) return;
    const query = searchInput ? searchInput.value.trim() : '';
    const label = labelFilter ? labelFilter.value : '';
    const repo = repoFilter ? repoFilter.value : '';
    const sort = sortSelect ? sortSelect.value : 'newest';

    // Loading State
    issueTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-6">
          <div class="d-flex align-items-center justify-content-center gap-2 text-secondary">
            <span class="btn-spinner" style="width: 18px; height: 18px; border: 2px solid var(--color-border); border-top-color: var(--color-focus); border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
            <span>Loading authentic issues...</span>
          </div>
        </td>
      </tr>`;

    try {
      const issues = await IssueService.getIssues({
        status: currentStatus,
        search: query,
        label: label,
        repository: repo,
        sort: sort
      });

      // Empty State
      if (!issues || issues.length === 0) {
        issueTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-8">
              <div class="empty-state" style="padding: 24px;">
                <div class="empty-state-icon" style="margin-bottom: 8px;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div class="empty-state-title" style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">No ${currentStatus.toLowerCase()} issues found</div>
                <div class="empty-state-desc text-secondary" style="font-size: 13px; max-width: 320px; margin: 0 auto;">There are no issues matching your current filters. Propose a new bug or task to start tracking.</div>
              </div>
            </td>
          </tr>`;
        return;
      }

      // Render Issue Rows
      issueTableBody.innerHTML = issues.map(issue => `
        <tr>
          <td>
            <div class="d-flex align-items-center">
              <span class="issue-icon-dot ${issue.status === 'Closed' ? 'closed' : ''}" title="${issue.status}"></span>
              <a href="${ROUTES.ISSUE_DETAIL}?id=${issue.number}" class="issue-title-link">
                ${escapeHtml(issue.title)}
              </a>
            </div>
          </td>
          <td>
            <span class="repo-pill">${escapeHtml(issue.repository || 'devsync-core')}</span>
          </td>
          <td>
            <div class="d-flex align-items-center gap-1 flex-wrap">
              ${(issue.labels || []).map(lbl => `<span class="tag-label tag-${escapeHtml(lbl).toLowerCase()}">${escapeHtml(lbl)}</span>`).join('')}
            </div>
          </td>
          <td>
            <div class="author-mini">
              <img src="${issue.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80'}" alt="${escapeHtml(issue.author || 'User')}" class="author-avatar-xs" />
              <span>${escapeHtml(issue.authorName || issue.author || 'Developer')}</span>
            </div>
          </td>
          <td>
            <span class="stat-group">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${issue.commentsCount || (issue.comments ? issue.comments.length : 0)}
            </span>
          </td>
          <td class="text-secondary" style="font-size: 12.5px;">${issue.updated || 'Recently'}</td>
          <td style="text-align: right;">
            <a href="${ROUTES.ISSUE_DETAIL}?id=${issue.number}" class="btn btn-outline btn-sm" style="font-size: 11.5px; padding: 3px 8px;">View</a>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Error loading issues:', err);
      // Actionable Error State with Retry Button
      issueTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-6 text-danger">
            <div class="d-flex flex-column align-items-center gap-2">
              <p style="margin: 0; font-weight: 600;">Failed to fetch issues: ${escapeHtml(err.message || 'Network error')}</p>
              <button class="btn btn-outline btn-sm" id="btnRetryIssues" style="margin-top: 6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Retry
              </button>
            </div>
          </td>
        </tr>`;

      const retryBtn = document.getElementById('btnRetryIssues');
      if (retryBtn) retryBtn.addEventListener('click', renderIssues);
    }
  }

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatus = tab.getAttribute('data-status') || 'Open';
      renderIssues();
    });
  });

  // Event Listeners
  if (searchInput) searchInput.addEventListener('input', debounce(renderIssues, 250));
  if (labelFilter) labelFilter.addEventListener('change', renderIssues);
  if (repoFilter) repoFilter.addEventListener('change', renderIssues);
  if (sortSelect) sortSelect.addEventListener('change', renderIssues);

  // Initial render & counts
  renderIssues();
  updateTabCounts();
}

/**
 * 2. Issue Detail View Controller
 */
async function initIssueDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const issueId = urlParams.get('id') || '104';

  try {
    const issue = await IssueService.getIssue(issueId);
    if (!issue) {
      toastDanger('Issue not found');
      return;
    }

    // Populate Issue Header
    const titleHeader = document.querySelector('h1.text-page-title');
    if (titleHeader) {
      titleHeader.innerHTML = `${escapeHtml(issue.title)} <span class="text-secondary" style="font-weight: 400;">#${issue.number}</span>`;
    }

    // Status Badge
    const statusBadge = document.querySelector('.badge-status-open, .badge-status-closed, .badge');
    if (statusBadge) {
      const isClosed = issue.status === 'Closed';
      statusBadge.className = `badge ${isClosed ? 'badge-status-closed' : 'badge-status-open'}`;
      statusBadge.textContent = issue.status;
    }

    // Meta row
    const metaRow = document.querySelector('.text-secondary[style*="font-size: 13.5px"]');
    if (metaRow) {
      metaRow.innerHTML = `<strong>${escapeHtml(issue.authorName || issue.author)}</strong> opened this issue ${issue.updated || 'recently'} &bull; ${issue.commentsCount || 0} comments &bull; in <code>${escapeHtml(issue.repository)}</code>`;
    }

    // Description
    const descP = document.querySelector('.card p[style*="font-size: 14px"]');
    if (descP) {
      descP.textContent = issue.description || 'No description provided.';
    }

    // Tags
    const tagsContainer = document.querySelector('.card .d-flex.align-items-center.gap-2');
    if (tagsContainer && issue.labels) {
      tagsContainer.innerHTML = issue.labels.map(lbl => `<span class="tag-label tag-${escapeHtml(lbl).toLowerCase()}">${escapeHtml(lbl)}</span>`).join('');
    }

    // Render Comments Stream
    renderCommentsStream(issue);

    // Wire Close/Reopen Button
    const closeBtn = document.querySelector('button.btn-outline.btn-pill.btn-sm');
    if (closeBtn) {
      closeBtn.textContent = issue.status === 'Closed' ? 'Reopen Issue' : 'Close Issue';
      closeBtn.onclick = async () => {
        try {
          if (issue.status === 'Closed') {
            await IssueService.reopenIssue(issue.number);
            toastSuccess(`Issue #${issue.number} reopened!`, 'Issue Reopened');
          } else {
            await IssueService.closeIssue(issue.number);
            toastSuccess(`Issue #${issue.number} closed!`, 'Issue Closed');
          }
          setTimeout(() => window.location.reload(), 400);
        } catch (e) {
          toastDanger(e.message || 'Action failed');
        }
      };
    }

    // Wire Comment Form
    const commentInput = document.querySelector('textarea.form-control');
    const commentBtn = document.querySelector('button.btn-primary.btn-pill.btn-sm');
    if (commentBtn && commentInput) {
      commentBtn.onclick = async (e) => {
        e.preventDefault();
        const text = commentInput.value.trim();
        if (!text) {
          toastDanger('Comment text cannot be empty');
          return;
        }
        commentBtn.disabled = true;
        commentBtn.textContent = 'Posting...';
        try {
          await IssueService.addComment(issue.number, text);
          toastSuccess('Comment posted successfully');
          commentInput.value = '';
          const updated = await IssueService.getIssue(issue.number);
          renderCommentsStream(updated);
        } catch (err) {
          toastDanger(err.message || 'Failed to post comment');
        } finally {
          commentBtn.disabled = false;
          commentBtn.textContent = 'Comment →';
        }
      };
    }

  } catch (err) {
    console.error('Error loading issue detail:', err);
    toastDanger('Failed to load issue details');
  }
}

function renderCommentsStream(issue) {
  const stream = document.querySelector('.d-flex.flex-column.gap-4.mb-6');
  if (!stream) return;
  const comments = issue.comments || [];
  if (comments.length === 0) {
    stream.innerHTML = '<div class="text-secondary text-center py-4" style="font-size: 13px;">No comments yet. Leave a response below.</div>';
    return;
  }
  stream.innerHTML = comments.map(c => `
    <div class="card">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div class="d-flex align-items-center gap-2">
          <img src="${c.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80'}" alt="${escapeHtml(c.authorName || c.author)}" style="width: 24px; height: 24px; border-radius: 50%;" />
          <strong>${escapeHtml(c.authorName || c.author)}</strong>
          <span class="text-secondary" style="font-size: 12px;">${c.time || 'Recently'}</span>
        </div>
      </div>
      <p style="font-size: 13.5px; margin: 0; line-height: 1.5;">${escapeHtml(c.text)}</p>
    </div>
  `).join('');
}

/**
 * 3. Issue Creation View Controller
 */
function initCreateIssuePage() {
  const createIssueForm = document.getElementById('createIssueForm');
  if (!createIssueForm) return;

  createIssueForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = createIssueForm.querySelector('#issueTitle');
    const descInput = createIssueForm.querySelector('#issueDescription');
    const repoInput = createIssueForm.querySelector('#issueRepo');
    const submitBtn = createIssueForm.querySelector('button[type="submit"]');

    const title = titleInput ? titleInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';
    const repository = repoInput ? repoInput.value : 'devsync-core';

    if (!title) {
      toastDanger('Please enter an issue title.');
      titleInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Submitting...';
    }

    try {
      const res = await IssueService.createIssue({
        title,
        description,
        repository,
        labels: ['enhancement']
      });
      toastSuccess(`Issue #${res.number} created successfully!`, 'Issue Created');
      setTimeout(() => navigateTo(ROUTES.ISSUES), 600);
    } catch (err) {
      console.error('Error creating issue:', err);
      toastDanger(err.message || 'Failed to create issue. Please verify permissions.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit New Issue &rarr;';
      }
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
