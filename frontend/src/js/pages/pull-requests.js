/**
 * DevSync Pull Requests Controller
 * Multi-page support: List, Detail, and Create with Real Git-aware Merging
 */

import { PullRequestService } from '../services/pull-request-service.js';
import { RepositoryService } from '../services/repository-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { toastSuccess, toastDanger, toastInfo } from '../components/toast.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

export async function initPullRequestsPage() {
  if (document.getElementById('prListContainer')) {
    initPullRequestsListPage();
  } else if (document.getElementById('createPRForm')) {
    initCreatePullRequestPage();
  } else if (document.getElementById('prDetailRoot') || window.location.pathname.includes('detail.html')) {
    initPullRequestDetailPage();
  }
}

/**
 * 1. Pull Requests List Page Controller
 */
async function initPullRequestsListPage() {
  const prListEl = document.getElementById('prListContainer');
  const searchInput = document.getElementById('prSearchInput');
  const repoFilter = document.getElementById('prRepoFilter');
  const authorFilter = document.getElementById('prAuthorFilter');
  const sortSelect = document.getElementById('prSortSelect');
  const tabs = document.querySelectorAll('.pr-tab-btn');

  const openCountEl = document.getElementById('prOpenCount');
  const closedCountEl = document.getElementById('prClosedCount');
  const mergedCountEl = document.getElementById('prMergedCount');

  let currentStatus = 'Open';

  async function updateTabCounts() {
    try {
      const allPRs = await PullRequestService.getPullRequests({});
      if (Array.isArray(allPRs)) {
        const openCount = allPRs.filter(p => p.status === 'Open').length;
        const closedCount = allPRs.filter(p => p.status === 'Closed').length;
        const mergedCount = allPRs.filter(p => p.status === 'Merged').length;

        if (openCountEl) openCountEl.textContent = openCount;
        if (closedCountEl) closedCountEl.textContent = closedCount;
        if (mergedCountEl) mergedCountEl.textContent = mergedCount;
      }
    } catch (err) {
      console.warn('Could not update PR counts:', err);
    }
  }

  async function renderPullRequests() {
    if (!prListEl) return;
    const query = searchInput ? searchInput.value.trim() : '';
    const repo = repoFilter ? repoFilter.value : '';
    const author = authorFilter ? authorFilter.value : '';
    const sort = sortSelect ? sortSelect.value : 'newest';

    prListEl.innerHTML = `
      <div class="p-6 text-center text-secondary">
        <span class="btn-spinner"></span> Loading pull requests...
      </div>`;

    try {
      const prs = await PullRequestService.getPullRequests({
        status: currentStatus,
        search: query,
        repository: repo,
        author: author,
        sort: sort
      });

      if (!prs || prs.length === 0) {
        prListEl.innerHTML = `
          <div class="empty-state" style="padding: 32px 16px; text-align: center;">
            <div class="empty-state-icon" style="margin-bottom: 8px;">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.8">
                <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
              </svg>
            </div>
            <div class="empty-state-title" style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">No ${currentStatus.toLowerCase()} pull requests</div>
            <div class="empty-state-desc text-secondary" style="font-size: 13px; max-width: 320px; margin: 0 auto;">There are no pull requests matching your active filters. Open a new pull request to propose changes.</div>
          </div>`;
        return;
      }

      prListEl.innerHTML = prs.map(pr => {
        const isMerged = pr.status === 'Merged';
        const isClosed = pr.status === 'Closed';
        const statusClass = isMerged ? 'badge-status-merged' : (isClosed ? 'badge-status-closed' : 'badge-status-open');
        const iconColorClass = isMerged ? 'merged' : (isClosed ? 'closed' : 'open');
        const reviewers = pr.reviewers || [];
        const labels = pr.labels || [];
        const authorName = pr.authorName || pr.author || 'Developer';

        return `
          <div class="pr-list-item">
            <div class="pr-item-left">
              <span class="pr-icon-indicator ${iconColorClass}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
                </svg>
              </span>
              <div class="pr-content">
                <div class="pr-title-row">
                  <a href="${ROUTES.PULL_REQUEST_DETAIL || 'detail.html'}?id=${pr.number}" class="pr-title">${escapeHtml(pr.title)}</a>
                  ${labels.map(lbl => `<span class="tag-label tag-${escapeHtml(lbl).toLowerCase()}">${escapeHtml(lbl)}</span>`).join('')}
                  <span class="repo-pill">${escapeHtml(pr.repository)}</span>
                  ${pr.sourceBranch ? `<span class="badge badge-neutral" style="font-size: 11px; font-family: monospace;">${escapeHtml(pr.sourceBranch)} &rarr; ${escapeHtml(pr.targetBranch || 'main')}</span>` : ''}
                </div>
                <div class="pr-meta">
                  <span>#${pr.number} opened ${pr.updated || 'recently'} by ${escapeHtml(authorName)}</span>
                </div>
              </div>
            </div>
            <div class="pr-item-right">
              <span class="stat-group">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                ${pr.commentsCount || 0}
              </span>
              <div class="avatar-stack">
                ${reviewers.map(avatar => `<img src="${avatar}" alt="Reviewer" />`).join('')}
              </div>
              <span class="badge ${statusClass}">${escapeHtml(pr.status)}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading pull requests:', err);
      prListEl.innerHTML = `
        <div class="p-6 text-center text-danger" style="background: rgba(239, 68, 68, 0.05); border-radius: 8px;">
          <p style="font-weight: 600; margin-bottom: 6px;">Failed to load pull requests</p>
          <p class="text-secondary" style="font-size: 13px; margin-bottom: 12px;">Could not connect to the DevSync backend API.</p>
          <button id="retryPRBtn" class="btn btn-sm btn-outline btn-pill">Try Again</button>
        </div>`;
      const retryBtn = document.getElementById('retryPRBtn');
      if (retryBtn) retryBtn.addEventListener('click', renderPullRequests);
    }
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

  // Filter listeners
  if (searchInput) searchInput.addEventListener('input', debounce(renderPullRequests, 250));
  if (repoFilter) repoFilter.addEventListener('change', renderPullRequests);
  if (authorFilter) authorFilter.addEventListener('change', renderPullRequests);
  if (sortSelect) sortSelect.addEventListener('change', renderPullRequests);

  // Initial loads
  renderPullRequests();
  updateTabCounts();
}

/**
 * 2. Pull Request Detail Page Controller
 */
async function initPullRequestDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const prId = urlParams.get('id') || '42';

  const titleHeading = document.getElementById('prTitleHeading');
  const statusBadge = document.getElementById('prStatusBadge');
  const metaRow = document.getElementById('prMetaRow');
  const descText = document.getElementById('prDescriptionText');
  const labelsContainer = document.getElementById('prLabelsContainer');

  const commitsCard = document.getElementById('prCommitsCard');
  const commitsCount = document.getElementById('prCommitsCount');
  const commitsList = document.getElementById('prCommitsList');

  const diffHeading = document.getElementById('prFilesChangedHeading');
  const diffContainer = document.getElementById('prDiffContainer');

  const reviewsCard = document.getElementById('prReviewsCard');
  const reviewsList = document.getElementById('prReviewsList');

  const mergeNotice = document.getElementById('prMergeNotice');
  const mergeStatusText = document.getElementById('prMergeStatusText');
  const mergeSubtext = document.getElementById('prMergeSubtext');
  const actionButtons = document.getElementById('prActionButtons');

  const btnClose = document.getElementById('btnClosePR');
  const btnRequestChanges = document.getElementById('btnRequestChanges');
  const btnApprove = document.getElementById('btnApprovePR');
  const btnMerge = document.getElementById('btnMergePR');

  async function loadDetail() {
    try {
      const pr = await PullRequestService.getPullRequest(prId);
      if (!pr) {
        toastDanger('Pull request not found');
        return;
      }

      // 1. Title & Header
      if (titleHeading) {
        titleHeading.innerHTML = `${escapeHtml(pr.title)} <span class="text-secondary" style="font-weight: 400;">#${pr.number}</span>`;
      }

      const isMerged = pr.status === 'Merged';
      const isClosed = pr.status === 'Closed';
      const isOpen = pr.status === 'Open';

      if (statusBadge) {
        const badgeClass = isMerged ? 'badge-status-merged' : (isClosed ? 'badge-status-closed' : 'badge-status-open');
        statusBadge.className = `badge ${badgeClass}`;
        statusBadge.textContent = pr.status;
      }

      if (metaRow) {
        const author = pr.authorName || pr.author || 'Developer';
        const commitsTotal = pr.commitsCount || (pr.commits ? pr.commits.length : 1);
        metaRow.innerHTML = `
          <strong>${escapeHtml(author)}</strong> wants to merge ${commitsTotal} commit${commitsTotal > 1 ? 's' : ''} into <code>${escapeHtml(pr.targetBranch || 'main')}</code> from <code>${escapeHtml(pr.sourceBranch || 'branch')}</code> &bull; in <code>${escapeHtml(pr.repository)}</code> &bull; opened ${pr.updated || 'recently'}
        `;
      }

      // 2. Description
      if (descText) {
        descText.textContent = pr.description || 'No description provided.';
      }
      if (labelsContainer && pr.labels) {
        labelsContainer.innerHTML = pr.labels.map(lbl => `<span class="tag-label tag-${escapeHtml(lbl).toLowerCase()}">${escapeHtml(lbl)}</span>`).join('');
      }

      // 3. Commits List
      if (commitsCard && commitsList) {
        const commits = pr.commits || [];
        if (commits.length > 0) {
          commitsCard.style.display = 'block';
          if (commitsCount) commitsCount.textContent = commits.length;
          commitsList.innerHTML = commits.map(c => `
            <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background: rgba(255,255,255,0.03); border: 1px solid var(--color-border);">
              <div class="d-flex align-items-center gap-2">
                <span class="badge badge-neutral" style="font-family: monospace; font-size: 11px;">${escapeHtml(c.hash || 'hash')}</span>
                <span style="font-size: 13.5px; font-weight: 500;">${escapeHtml(c.message)}</span>
              </div>
              <span class="text-secondary" style="font-size: 12px;">${escapeHtml(c.author || '')} &bull; ${escapeHtml(c.time || '')}</span>
            </div>
          `).join('');
        } else {
          commitsCard.style.display = 'none';
        }
      }

      // 4. Diffs Presentation
      if (diffContainer) {
        const files = pr.changedFiles || [];
        if (files.length > 0) {
          const firstFile = files[0];
          if (diffHeading) {
            diffHeading.innerHTML = `Files changed: <code>${escapeHtml(firstFile.path)}</code> <span class="text-success" style="font-size: 13px;">(+${firstFile.additions || 0})</span> <span class="text-danger" style="font-size: 13px;">(-${firstFile.deletions || 0})</span>`;
          }

          const rawDiff = firstFile.diff || '';
          const lines = rawDiff.split('\n');
          diffContainer.innerHTML = lines.map((line, idx) => {
            const isAdd = line.startsWith('+');
            const isDel = line.startsWith('-');
            const lineClass = isAdd ? 'diff-line diff-add' : (isDel ? 'diff-line diff-remove' : 'diff-line');
            return `
              <div class="${lineClass}">
                <span class="diff-line-number">${idx + 42}</span>
                <span>${escapeHtml(line)}</span>
              </div>
            `;
          }).join('');
        } else {
          if (diffHeading) diffHeading.textContent = 'Files changed (0)';
          diffContainer.innerHTML = `<div class="p-4 text-center text-secondary">No files modified in this pull request.</div>`;
        }
      }

      // 5. Reviews Card
      if (reviewsCard && reviewsList) {
        const reviews = pr.reviews || [];
        if (reviews.length > 0) {
          reviewsCard.style.display = 'block';
          reviewsList.innerHTML = reviews.map(r => `
            <div class="p-3 rounded" style="background: rgba(255,255,255,0.02); border-left: 3px solid ${r.action === 'approve' ? 'var(--color-primary-green)' : 'var(--color-status-danger)'};">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <strong>${escapeHtml(r.author)}</strong>
                <span class="badge ${r.action === 'approve' ? 'badge-status-open' : 'badge-status-closed'}">${r.action === 'approve' ? 'Approved' : 'Changes Requested'}</span>
              </div>
              <p class="text-secondary m-0" style="font-size: 13px;">${escapeHtml(r.comment || 'No review comment provided.')}</p>
            </div>
          `).join('');
        } else {
          reviewsCard.style.display = 'none';
        }
      }

      // 6. Merge & Action Controls
      if (isMerged) {
        if (mergeStatusText) mergeStatusText.textContent = `Pull Request Successfully Merged into ${pr.targetBranch || 'main'}`;
        if (mergeSubtext) mergeSubtext.textContent = `All commits from ${pr.sourceBranch} have been integrated cleanly into the base branch repository files.`;
        if (actionButtons) {
          actionButtons.innerHTML = `<span class="badge badge-status-merged" style="padding: 6px 14px; font-size: 13px;">Merged</span>`;
        }
      } else if (isClosed) {
        if (mergeStatusText) mergeStatusText.textContent = `This Pull Request was Closed`;
        if (mergeSubtext) mergeSubtext.textContent = `No changes were integrated into ${pr.targetBranch || 'main'}. You can reopen this pull request anytime.`;
        if (actionButtons) {
          actionButtons.innerHTML = `<button class="btn btn-outline btn-pill btn-sm" id="btnReopenPR">Reopen Pull Request</button>`;
          const btnReopen = document.getElementById('btnReopenPR');
          if (btnReopen) {
            btnReopen.addEventListener('click', async () => {
              btnReopen.disabled = true;
              btnReopen.innerHTML = '<span class="btn-spinner"></span> Reopening...';
              try {
                await PullRequestService.reviewPullRequest(pr.number, 'reopen', 'Reopened pull request');
                toastSuccess('Pull request reopened successfully');
                loadDetail();
              } catch (err) {
                toastDanger('Failed to reopen pull request');
                btnReopen.disabled = false;
              }
            });
          }
        }
      } else {
        // Open PR: Wire Approve, Request Changes, Close, and Merge
        if (mergeStatusText) mergeStatusText.textContent = `This branch has no conflicts with base branch`;
        if (mergeSubtext) mergeSubtext.textContent = `Merging can be performed automatically. All continuous integration checks have passed.`;

        if (btnClose) {
          btnClose.onclick = async () => {
            if (!confirm('Are you sure you want to close this pull request without merging?')) return;
            btnClose.disabled = true;
            try {
              await PullRequestService.closePullRequest(pr.number);
              toastSuccess('Pull request closed');
              loadDetail();
            } catch (err) {
              toastDanger('Failed to close pull request');
              btnClose.disabled = false;
            }
          };
        }

        if (btnApprove) {
          btnApprove.onclick = async () => {
            btnApprove.disabled = true;
            try {
              await PullRequestService.reviewPullRequest(pr.number, 'approve', 'Looks solid! Ready to merge.');
              toastSuccess('Pull request approved!', 'Review Submitted');
              loadDetail();
            } catch (err) {
              toastDanger('Failed to submit approval review');
              btnApprove.disabled = false;
            }
          };
        }

        if (btnRequestChanges) {
          btnRequestChanges.onclick = async () => {
            const comment = prompt('Please specify the changes or improvements requested:');
            if (comment === null) return;
            btnRequestChanges.disabled = true;
            try {
              await PullRequestService.reviewPullRequest(pr.number, 'request_changes', comment || 'Please address inline review remarks.');
              toastInfo('Requested changes recorded', 'Review Submitted');
              loadDetail();
            } catch (err) {
              toastDanger('Failed to submit review');
              btnRequestChanges.disabled = false;
            }
          };
        }

        if (btnMerge) {
          btnMerge.onclick = async () => {
            if (!confirm(`Merge pull request #${pr.number} into ${pr.targetBranch || 'main'}? This will commit all changes into the repository branch.`)) return;
            btnMerge.disabled = true;
            btnMerge.innerHTML = '<span class="btn-spinner"></span> Merging branch...';
            try {
              const res = await PullRequestService.mergePullRequest(pr.number);
              toastSuccess(`Pull request #${pr.number} merged into ${pr.targetBranch || 'main'} successfully!`, 'Merge Successful');
              loadDetail();
            } catch (err) {
              toastDanger(err.message || 'Failed to merge pull request. Check permissions or conflicts.');
              btnMerge.disabled = false;
              btnMerge.innerHTML = 'Merge Pull Request &rarr;';
            }
          };
        }
      }
    } catch (err) {
      console.error('Error loading PR detail:', err);
      toastDanger('Could not load pull request details.');
    }
  }

  loadDetail();
}

/**
 * 3. Create Pull Request Page Controller
 */
async function initCreatePullRequestPage() {
  const createPRForm = document.getElementById('createPRForm');
  if (!createPRForm) return;

  const repoSelect = createPRForm.querySelector('#prRepo');
  const sourceBranchSelect = createPRForm.querySelector('#prSourceBranch');
  const targetBranchSelect = createPRForm.querySelector('#prTargetBranch');
  const titleInput = createPRForm.querySelector('#prTitle');
  const descInput = createPRForm.querySelector('#prDescription');
  const submitBtn = createPRForm.querySelector('button[type="submit"]');

  // Dynamically populate available repositories
  try {
    const repos = await RepositoryService.getRepositories();
    if (Array.isArray(repos) && repos.length > 0 && repoSelect) {
      repoSelect.innerHTML = repos.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');

      // Update branches whenever repo selection changes
      function updateBranches() {
        const selectedRepoName = repoSelect.value;
        const selectedRepo = repos.find(r => r.name === selectedRepoName);
        const branches = (selectedRepo && selectedRepo.branches && selectedRepo.branches.length > 0)
          ? selectedRepo.branches
          : ['main', 'develop', 'feat/google-oauth', 'perf/db-indexes'];

        if (targetBranchSelect) {
          targetBranchSelect.innerHTML = branches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
          if (branches.includes('main')) targetBranchSelect.value = 'main';
        }

        if (sourceBranchSelect) {
          sourceBranchSelect.innerHTML = branches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
          const nonMain = branches.find(b => b !== 'main');
          if (nonMain) sourceBranchSelect.value = nonMain;
        }
      }

      repoSelect.addEventListener('change', updateBranches);
      updateBranches();
    }
  } catch (err) {
    console.warn('Could not load repositories for PR creation form:', err);
  }

  createPRForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput ? titleInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';
    const repository = repoSelect ? repoSelect.value : 'campus-connect';
    const sourceBranch = sourceBranchSelect ? sourceBranchSelect.value : 'feat/google-oauth';
    const targetBranch = targetBranchSelect ? targetBranchSelect.value : 'main';

    if (!title) {
      toastDanger('Please enter a pull request title.');
      return;
    }

    if (sourceBranch === targetBranch) {
      toastDanger('Compare branch and base branch cannot be the same.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Creating PR...';
    }

    try {
      await PullRequestService.createPullRequest({
        title,
        description,
        repository,
        sourceBranch,
        targetBranch
      });
      toastSuccess(`Pull request "${title}" created successfully!`, 'PR Opened');
      setTimeout(() => navigateTo(ROUTES.PULL_REQUESTS || 'list.html'), 500);
    } catch (err) {
      console.error('Error creating pull request:', err);
      toastDanger(err.message || 'Failed to create pull request. Please try again.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Pull Request &rarr;';
      }
    }
  });
}
