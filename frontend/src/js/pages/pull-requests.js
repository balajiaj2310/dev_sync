/**
 * DevSync Pull Requests Controller
 * Exact reproduction of Reference Image 1 Pull Requests UI
 */

import { PullRequestService } from '../services/pull-request-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { toastSuccess, toastDanger } from '../components/toast.js';

export async function initPullRequestsPage() {
  const prListEl = document.getElementById('prListContainer');
  const searchInput = document.getElementById('prSearchInput');
  const repoFilter = document.getElementById('prRepoFilter');
  const tabs = document.querySelectorAll('.pr-tab-btn');
  let currentStatus = 'Open';

  async function renderPullRequests() {
    if (!prListEl) return;
    const query = searchInput ? searchInput.value.trim() : '';
    const repo = repoFilter ? repoFilter.value : '';

    prListEl.innerHTML = `<div class="p-6 text-center text-secondary"><span class="btn-spinner"></span> Loading pull requests...</div>`;

    const prs = await PullRequestService.getPullRequests({ status: currentStatus, search: query, repository: repo });

    if (prs.length === 0) {
      prListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No ${currentStatus.toLowerCase()} pull requests</div>
          <div class="empty-state-desc">There are no pull requests matching your active filters.</div>
        </div>`;
      return;
    }

    prListEl.innerHTML = prs.map(pr => `
      <div class="pr-list-item">
        <div class="pr-item-left">
          <span class="pr-icon-indicator ${pr.status.toLowerCase()}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
          </span>
          <div class="pr-content">
            <div class="pr-title-row">
              <a href="${ROUTES.PULL_REQUEST_DETAIL}?id=${pr.number}" class="pr-title">${pr.title}</a>
              ${pr.labels.map(lbl => `<span class="tag-label tag-${lbl}">${lbl}</span>`).join('')}
              <span class="repo-pill">${pr.repository}</span>
            </div>
            <div class="pr-meta">
              <span>#${pr.number} opened ${pr.updated} by ${pr.author}</span>
            </div>
          </div>
        </div>
        <div class="pr-item-right">
          <span class="stat-group">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${pr.commentsCount}
          </span>
          <div class="avatar-stack">
            ${pr.reviewers.map(avatar => `<img src="${avatar}" alt="Reviewer" />`).join('')}
          </div>
          <span class="badge ${pr.statusClass}">${pr.status}</span>
        </div>
      </div>
    `).join('');
  }

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatus = tab.getAttribute('data-status') || 'Open';
      renderPullRequests();
    });
  });

  if (searchInput) searchInput.addEventListener('input', renderPullRequests);
  if (repoFilter) repoFilter.addEventListener('change', renderPullRequests);

  renderPullRequests();

  // Create PR form
  const createPRForm = document.getElementById('createPRForm');
  if (createPRForm) {
    createPRForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = createPRForm.querySelector('#prTitle').value.trim();
      const description = createPRForm.querySelector('#prDescription').value.trim();
      const repository = createPRForm.querySelector('#prRepo').value;
      const sourceBranch = createPRForm.querySelector('#prSourceBranch').value;
      const targetBranch = createPRForm.querySelector('#prTargetBranch').value;

      if (!title) {
        toastDanger('Please enter a pull request title.');
        return;
      }

      await PullRequestService.createPullRequest({ title, description, repository, sourceBranch, targetBranch });
      toastSuccess(`Pull request "${title}" created successfully!`, 'PR Opened');
      setTimeout(() => navigateTo(ROUTES.PULL_REQUESTS), 600);
    });
  }
}
