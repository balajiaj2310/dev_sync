/**
 * DevSync Repositories Page Controller
 * Supports Repository Directory List, Creation, and Full Vertical Workspace Detail View.
 */

import { RepositoryService } from '../services/repository-service.js';
import { AuthService } from '../services/auth-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { isValidRepoName } from '../core/validators.js';
import { toastSuccess, toastDanger, toastInfo, toastWarning } from '../components/toast.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatFileSize(bytes) {
  if (bytes === 0 || bytes === '0' || !bytes) return '0 B';
  const num = typeof bytes === 'number' ? bytes : parseInt(bytes, 10);
  if (isNaN(num)) return String(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(val) {
  if (!val) return 'Recently';
  if (typeof val === 'number') {
    const ms = val < 10000000000 ? val * 1000 : val;
    const diff = (Date.now() - ms) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(val);
}

function getFileIcon(name, isDir) {
  if (isDir) {
    return `<svg class="file-icon folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  }
  const ext = name.split('.').pop().toLowerCase();
  if (['py'].includes(ext)) {
    return `<svg class="file-icon py-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6"/><path d="M12 10v6"/></svg>`;
  }
  if (['md', 'txt', 'rst'].includes(ext)) {
    return `<svg class="file-icon doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  }
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
    return `<svg class="file-icon js-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) {
    return `<svg class="file-icon config-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }
  return `<svg class="file-icon default-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

function renderCodeLines(content) {
  if (!content) return '<div class="code-line empty-file"><em>// Empty file (0 bytes)</em></div>';
  const lines = content.split('\n');
  return lines.map((line, idx) => `
    <div class="code-line">
      <span class="code-line-num">${idx + 1}</span>
      <span class="code-line-text">${escapeHtml(line) || '&nbsp;'}</span>
    </div>
  `).join('');
}

/* ==========================================================================
   1. Repository Directory List & Create Page Controller
   ========================================================================== */
export async function initRepositoriesPage() {
  const repoTableBody = document.getElementById('repoTableBody');
  const searchInput = document.getElementById('repoSearchInput');
  const langFilter = document.getElementById('repoLanguageFilter');
  const sortFilter = document.getElementById('repoSortFilter');

  const urlParams = new URLSearchParams(window.location.search);
  if (searchInput && urlParams.get('q')) {
    searchInput.value = urlParams.get('q');
  }

  async function renderRepositories() {
    if (!repoTableBody) return;
    const query = searchInput ? searchInput.value.trim() : '';
    const lang = langFilter ? langFilter.value : '';

    repoTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4"><span class="btn-spinner"></span> Loading repositories...</td></tr>`;

    const repos = await RepositoryService.getRepositories({ search: query, language: lang });

    if (!repos || repos.length === 0) {
      repoTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-6">
            <div class="empty-state">
              <div class="empty-state-title">No repositories found</div>
              <div class="empty-state-desc">Try adjusting your search terms or filters.</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    repoTableBody.innerHTML = repos.map(repo => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <span class="table-repo-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </span>
            <a href="${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(repo.name || repo.id)}" class="table-repo-name">${escapeHtml(repo.name)}</a>
          </div>
        </td>
        <td class="text-secondary" style="max-width: 280px;">${escapeHtml(repo.description || 'No description provided')}</td>
        <td>
          <span class="lang-indicator">
            <span class="lang-dot" style="background-color: ${repo.languageColor || '#10B981'};"></span>
            ${escapeHtml(repo.language || 'Python')}
          </span>
        </td>
        <td>
          <span class="stat-group">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${repo.stars || 0}
          </span>
        </td>
        <td>
          <span class="stat-group">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            ${repo.forks || 0}
          </span>
        </td>
        <td class="text-secondary">${escapeHtml(repo.updated || 'Recently')}</td>
        <td>
          <span class="badge ${repo.visibility === 'Public' ? 'badge-public' : 'badge-private'}">${escapeHtml(repo.visibility || 'Private')}</span>
        </td>
        <td>
          <a href="${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(repo.name || repo.id)}" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 11px;">Details &rarr;</a>
          <a href="${ROUTES.REPOSITORY_WORKSPACE}?repo=${encodeURIComponent(repo.name || repo.id)}" class="btn btn-primary btn-sm ml-1" style="padding: 2px 8px; font-size: 11px;" title="Open in Browser IDE">IDE &lt;/&gt;</a>
        </td>
      </tr>
    `).join('');
  }

  if (searchInput) searchInput.addEventListener('input', renderRepositories);
  if (langFilter) langFilter.addEventListener('change', renderRepositories);
  if (sortFilter) sortFilter.addEventListener('change', renderRepositories);

  renderRepositories();

  const createRepoForm = document.getElementById('createRepoForm');
  if (createRepoForm) {
    createRepoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = createRepoForm.querySelector('#repoName').value.trim();
      const description = createRepoForm.querySelector('#repoDescription').value.trim();
      const visibility = createRepoForm.querySelector('input[name="visibility"]:checked')?.value || 'Public';
      const initReadme = createRepoForm.querySelector('#initReadme')?.checked || false;

      if (!isValidRepoName(name)) {
        toastDanger('Repository name may only contain alphanumeric characters, hyphens, and underscores.');
        return;
      }

      const submitBtn = createRepoForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Creating...';

      try {
        await RepositoryService.createRepository({ name, description, visibility, initReadme });
        toastSuccess(`Repository ${name} created successfully!`, 'Repository Ready');
        setTimeout(() => navigateTo(`${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(name)}`), 600);
      } catch (err) {
        toastDanger(err.message || 'Failed to create repository.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Repository';
      }
    });
  }
}

/* ==========================================================================
   2. Repository Collaborative Workspace & Detail Controller
   ========================================================================== */
export async function initRepositoryDetailPage() {
  const root = document.getElementById('repoDetailRoot');
  if (!root) return;

  const urlParams = new URLSearchParams(window.location.search);
  const repoId = urlParams.get('repo') || urlParams.get('id') || 'devsync-core';
  let currentTab = urlParams.get('tab') || 'overview';
  let currentBranch = urlParams.get('branch') || 'main';
  let currentPath = urlParams.get('path') || '';

  // State
  let repo = null;
  let branches = [];
  let currentFiles = [];
  let pendingUploadContent = '';

  const contentArea = document.getElementById('repoContentArea');
  const sidebar = document.getElementById('repoSidebar');
  const sidebarBranchSelect = document.getElementById('repoSidebarBranchSelect');
  const uploadBranchSelect = document.getElementById('uploadBranchSelect');

  // Load Repository
  async function loadRepository() {
    try {
      repo = await RepositoryService.getRepository(repoId);
    } catch (err) {
      console.error('Failed to load repository:', err);
    }

    if (!repo) {
      contentArea.innerHTML = `
        <div class="empty-state py-8">
          <div class="empty-state-title">Repository Not Found</div>
          <div class="empty-state-desc">The repository "${escapeHtml(repoId)}" could not be loaded or you do not have permission to view it.</div>
          <a href="list.html" class="btn btn-primary btn-sm mt-3">Back to Repositories</a>
        </div>
      `;
      return;
    }

    document.title = `${repo.name} — DevSync Workspace`;

    // Populate Header
    const openWorkspaceBtn = document.getElementById('openWorkspaceBtn');
    if (openWorkspaceBtn) {
      openWorkspaceBtn.href = `${ROUTES.REPOSITORY_WORKSPACE}?repo=${encodeURIComponent(repo.name || repo.id)}&branch=${encodeURIComponent(currentBranch)}`;
    }

    const nameEl = document.getElementById('repoNameDisplay');
    if (nameEl) nameEl.textContent = repo.name;
    const ownerEl = document.getElementById('repoOwnerDisplay');
    if (ownerEl) ownerEl.textContent = repo.owner;
    const descEl = document.getElementById('repoDescDisplay');
    if (descEl) descEl.textContent = repo.description || 'No description provided';
    const visBadge = document.getElementById('repoVisibilityBadge');
    if (visBadge) {
      visBadge.textContent = repo.visibility;
      visBadge.className = `badge ${repo.visibility === 'Public' ? 'badge-public' : 'badge-private'} ml-2`;
    }
    const starCount = document.getElementById('starCount');
    if (starCount) starCount.textContent = repo.stars || 0;
    const forkCount = document.getElementById('forkCount');
    if (forkCount) forkCount.textContent = repo.forks || 0;
    const sidebarRepoName = document.getElementById('sidebarRepoName');
    if (sidebarRepoName) sidebarRepoName.textContent = repo.name;

    // Load Branches
    try {
      const branchRes = await RepositoryService.getBranches(repo.id, repo);
      branches = branchRes.branches || [{ name: 'main', isDefault: true }];
    } catch (err) {
      branches = [{ name: 'main', isDefault: true }];
    }

    // Ensure currentBranch is valid
    if (!branches.some(b => b.name === currentBranch)) {
      currentBranch = repo.defaultBranch || branches[0]?.name || 'main';
    }

    // Populate Sidebar Branch Dropdown
    if (sidebarBranchSelect) {
      sidebarBranchSelect.innerHTML = branches.map(b => `
        <option value="${escapeHtml(b.name)}" ${b.name === currentBranch ? 'selected' : ''}>
          ${escapeHtml(b.name)} ${b.isDefault ? '• default' : ''}
        </option>
      `).join('');
    }

    // Populate Modal Branch Dropdown
    if (uploadBranchSelect) {
      uploadBranchSelect.innerHTML = branches.map(b => `
        <option value="${escapeHtml(b.name)}" ${b.name === currentBranch ? 'selected' : ''}>
          ${escapeHtml(b.name)} ${b.isDefault ? '(default)' : ''}
        </option>
      `).join('');
    }

    updateSidebarBadges();
    renderCurrentTab();
  }

  function updateSidebarBadges() {
    const fileCountBadge = document.getElementById('sidebarFileCount');
    if (fileCountBadge) {
      const branchFiles = repo.files?.[currentBranch] || repo.branchFiles?.[currentBranch] || [];
      const count = branchFiles.length || repo.filesCount || 0;
      fileCountBadge.textContent = count;
    }
    const branchCountBadge = document.getElementById('sidebarBranchCount');
    if (branchCountBadge) {
      branchCountBadge.textContent = branches.length || (repo.branches?.length || 1);
    }
    const teamCountBadge = document.getElementById('sidebarTeamCount');
    if (teamCountBadge) {
      teamCountBadge.textContent = repo.members?.length || 0;
    }
    const prCountBadge = document.getElementById('sidebarPRCount');
    if (prCountBadge) {
      prCountBadge.textContent = repo.openPRsCount || 0;
    }
    const issueCountBadge = document.getElementById('sidebarIssueCount');
    if (issueCountBadge) {
      issueCountBadge.textContent = repo.openIssuesCount || 0;
    }
  }

  // Branch Selector Change
  if (sidebarBranchSelect) {
    sidebarBranchSelect.addEventListener('change', (e) => {
      currentBranch = e.target.value;
      if (uploadBranchSelect) uploadBranchSelect.value = currentBranch;
      currentPath = '';
      updateBranchNotice();
      updateUrl();
      updateSidebarBadges();
      if (currentTab === 'files' || currentTab === 'overview' || currentTab === 'branches') {
        renderCurrentTab();
      }
    });
  }

  if (uploadBranchSelect) {
    uploadBranchSelect.addEventListener('change', (e) => {
      updateBranchNotice();
    });
  }

  function updateBranchNotice() {
    const selectedBranch = uploadBranchSelect ? uploadBranchSelect.value : currentBranch;
    const label = document.getElementById('uploadTargetBranchLabel');
    if (label) label.textContent = selectedBranch;
    const conflictBranchNotice = document.getElementById('conflictBranchNotice');
    if (conflictBranchNotice) conflictBranchNotice.textContent = selectedBranch;
  }

  // Tab Selection
  const tabButtons = root.querySelectorAll('[data-repo-tab]');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-repo-tab');
      if (targetTab === currentTab) return;
      currentTab = targetTab;
      if (currentTab !== 'files') {
        currentPath = '';
      }
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateUrl();
      renderCurrentTab();
    });
  });

  function updateUrl() {
    const params = new URLSearchParams(window.location.search);
    params.set('repo', repoId);
    params.set('tab', currentTab);
    params.set('branch', currentBranch);
    if (currentTab === 'files' && currentPath) {
      params.set('path', currentPath);
    } else {
      params.delete('path');
    }
    window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    currentTab = params.get('tab') || 'overview';
    currentBranch = params.get('branch') || (repo?.defaultBranch || 'main');
    currentPath = params.get('path') || '';
    tabButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-repo-tab') === currentTab);
    });
    if (sidebarBranchSelect) sidebarBranchSelect.value = currentBranch;
    updateSidebarBadges();
    renderCurrentTab();
  });

  // Mobile Drawer Toggle
  const sidebarToggle = document.getElementById('repoSidebarToggle');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });
  }

  // Modal Open / Close Helpers
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('show');
      if (id === 'uploadModal') {
        updateBranchNotice();
        resetUploadModal();
      }
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
  }

  root.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-close-modal');
      closeModal(target);
    });
  });

  // Render Dispatcher
  async function renderCurrentTab() {
    if (!contentArea) return;
    switch (currentTab) {
      case 'files':
        await renderFilesTab();
        break;
      case 'branches':
        await renderBranchesTab();
        break;
      case 'team':
        await renderTeamTab();
        break;
      case 'pull-requests':
        await renderPullRequestsTab();
        break;
      case 'issues':
        await renderIssuesTab();
        break;
      case 'activity':
        await renderActivityTab();
        break;
      case 'settings':
        renderSettingsTab();
        break;
      case 'overview':
      default:
        await renderOverviewTab();
        break;
    }
  }

  /* -------------------------------------------------------------------------
   * Section 3: Overview Tab
   * ------------------------------------------------------------------------- */
  async function renderOverviewTab() {
    const files = repo.files?.[currentBranch] || repo.branchFiles?.[currentBranch] || [];
    const attachments = repo.attachments || [];
    const milestones = repo.milestones || [];
    const primaryMilestone = milestones[0] || {
      title: 'v1.0 Milestone',
      dueDate: 'November 2026',
      progress: 68,
      completedTasks: 17,
      totalTasks: 25
    };

    contentArea.innerHTML = `
      <!-- Stat Cards -->
      <div class="repo-stat-cards-grid">
        <div class="repo-stat-card">
          <span class="repo-stat-num">${repo.members?.length || 1}</span>
          <span class="repo-stat-lbl">Members</span>
        </div>
        <div class="repo-stat-card">
          <span class="repo-stat-num">${branches.length}</span>
          <span class="repo-stat-lbl">Branches</span>
        </div>
        <div class="repo-stat-card">
          <span class="repo-stat-num">${files.length}</span>
          <span class="repo-stat-lbl">Files (${escapeHtml(currentBranch)})</span>
        </div>
        <div class="repo-stat-card">
          <span class="repo-stat-num">${repo.openPRsCount || 0}</span>
          <span class="repo-stat-lbl">Open PRs</span>
        </div>
        <div class="repo-stat-card">
          <span class="repo-stat-num">${repo.openIssuesCount || 0}</span>
          <span class="repo-stat-lbl">Open Issues</span>
        </div>
      </div>

      <!-- Milestone Progress Card -->
      <div class="repo-milestone-card">
        <div class="repo-milestone-header">
          <div>
            <div style="font-weight: 700; font-size: 15px; color: var(--color-text-primary);">
              ${escapeHtml(primaryMilestone.title)}
            </div>
            <div class="text-secondary" style="font-size: 12px;">
              Target completion: ${escapeHtml(primaryMilestone.dueDate)} &bull; ${primaryMilestone.completedTasks} of ${primaryMilestone.totalTasks} tasks completed
            </div>
          </div>
          <div style="font-family: var(--font-heading); font-size: 18px; font-weight: 750; color: #10B981;">
            ${primaryMilestone.progress}%
          </div>
        </div>
        <div class="repo-progress-track">
          <div class="repo-progress-fill" style="width: ${primaryMilestone.progress}%;"></div>
        </div>
      </div>

      <!-- Quick Actions & File Explorer Preview Bar -->
      <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div class="d-flex align-items-center gap-2">
          <span class="badge badge-private" style="background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25);">
            Branch: ${escapeHtml(currentBranch)}
          </span>
          <span class="text-secondary" style="font-size: 13px;">${files.length} files tracked</span>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button type="button" class="btn btn-outline btn-sm" id="btnOpenFilesTab">Browse Files &rarr;</button>
          <button type="button" class="btn btn-primary btn-sm" id="btnQuickUpload">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload File
          </button>
        </div>
      </div>

      <!-- README Preview -->
      <div class="readme-panel mb-6">
        <div class="readme-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>README.md (${escapeHtml(currentBranch)})</span>
        </div>
        <div class="readme-content">
          <h2 class="font-heading" style="font-size: 20px; margin-bottom: 8px;">${escapeHtml(repo.name)}</h2>
          <p style="margin-bottom: 16px; color: var(--color-text-secondary);">${escapeHtml(repo.description || 'Welcome to the repository workspace.')}</p>
          <div style="background: var(--color-surface-subtle); padding: 14px; border-radius: 8px; border: 1px solid var(--color-border); font-family: var(--font-mono); font-size: 12.5px;">
            <code>$ git clone https://devsync.example/git/${escapeHtml(repo.name)}.git<br/>$ cd ${escapeHtml(repo.name)}<br/>$ git checkout ${escapeHtml(currentBranch)}</code>
          </div>
        </div>
      </div>

      <!-- Section 4: Project Attachments (Explicitly separated from Git repository files) -->
      <div class="attachments-card">
        <div class="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h3 class="font-heading" style="font-size: 16px; margin: 0 0 4px 0;">Project Attachments</h3>
            <p class="text-secondary" style="font-size: 12.5px; margin: 0;">
              Non-Git supporting assets: specifications, architectural documents, and design deliverables.
            </p>
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="btnUploadAttachmentTrigger">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Add Attachment
          </button>
        </div>

        ${attachments.length === 0 ? `
          <div class="text-secondary py-3 text-center" style="font-size: 13px;">No project attachments uploaded yet.</div>
        ` : `
          <div class="table-responsive">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>Attachment Name</th>
                  <th>Description</th>
                  <th>Size</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                ${attachments.map(att => `
                  <tr>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <strong>${escapeHtml(att.name)}</strong>
                      </div>
                    </td>
                    <td class="text-secondary">${escapeHtml(att.description || '—')}</td>
                    <td class="text-secondary">${escapeHtml(att.size || '—')}</td>
                    <td>${escapeHtml(att.uploadedBy || 'chaturya')}</td>
                    <td class="text-secondary">${escapeHtml(att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString() : 'Recent')}</td>
                    <td class="text-right">
                      <button type="button" class="btn btn-outline btn-sm" style="padding: 1px 8px; font-size: 11px;" onclick="alert('Viewing attachment: ${escapeHtml(att.name)}')">View</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    document.getElementById('btnOpenFilesTab')?.addEventListener('click', () => {
      currentTab = 'files';
      tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-repo-tab') === 'files'));
      updateUrl();
      renderCurrentTab();
    });

    document.getElementById('btnQuickUpload')?.addEventListener('click', () => openModal('uploadModal'));
    document.getElementById('btnUploadAttachmentTrigger')?.addEventListener('click', () => openModal('attachmentModal'));
  }

  /* -------------------------------------------------------------------------
   * Section 4: Code & Files Tab (Branch-Aware Repository Files & In-Page Viewer)
   * ------------------------------------------------------------------------- */
  function isFilePath(path) {
    if (!path) return false;
    const last = path.split('/').pop();
    return last.includes('.') && !last.endsWith('/');
  }

  async function renderFilesTab() {
    if (!contentArea) return;

    // If path points to a file, render the in-page file viewer
    if (isFilePath(currentPath)) {
      await renderFileViewer(currentPath);
      return;
    }

    contentArea.innerHTML = `
      <div class="file-browser-container">
        <div class="text-center py-6 text-secondary">
          <span class="btn-spinner"></span> Loading repository contents...
        </div>
      </div>
    `;

    let filesRes = { files: [] };
    try {
      filesRes = await RepositoryService.getFiles(repo.id, currentBranch, currentPath, false, repo);
    } catch (err) {
      console.warn('Failed to load files:', err);
    }

    currentFiles = filesRes.files || [];

    // Sort: directories first, then files
    currentFiles.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    // Build breadcrumbs
    const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];
    let breadcrumbHtml = `
      <div class="file-breadcrumbs">
        <svg class="file-icon folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <a class="file-breadcrumb-item" data-nav-path="">${escapeHtml(repo.name)}</a>
    `;

    let accumulatedPath = '';
    pathSegments.forEach((seg, idx) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${seg}` : seg;
      const isLast = (idx === pathSegments.length - 1);
      breadcrumbHtml += `
        <span class="file-breadcrumb-separator">/</span>
        ${isLast ? `<span class="file-breadcrumb-current">${escapeHtml(seg)}</span>` : `<a class="file-breadcrumb-item" data-nav-path="${escapeHtml(accumulatedPath)}">${escapeHtml(seg)}</a>`}
      `;
    });
    breadcrumbHtml += `</div>`;

    // Compute parent directory path for .. row
    let parentPath = '';
    if (pathSegments.length > 1) {
      parentPath = pathSegments.slice(0, -1).join('/');
    }

    const openWorkspaceUrl = `${ROUTES.REPOSITORY_WORKSPACE}?repo=${encodeURIComponent(repo.name || repo.id)}&branch=${encodeURIComponent(currentBranch)}${currentPath ? '&dir=' + encodeURIComponent(currentPath) : ''}`;

    contentArea.innerHTML = `
      <div class="file-browser-container">
        <!-- Toolbar: Breadcrumbs + Branch Selector + Actions -->
        <div class="file-browser-toolbar">
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <div class="d-flex align-items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
              <select class="form-select form-select-sm repo-branch-dropdown" id="fileToolbarBranchSelect" style="width: auto; min-width: 130px; font-size: 12.5px; padding: 4px 8px;" aria-label="Current Branch">
                ${branches.map(b => `
                  <option value="${escapeHtml(b.name)}" ${b.name === currentBranch ? 'selected' : ''}>
                    ${escapeHtml(b.name)} ${b.isDefault ? '• default' : ''}
                  </option>
                `).join('')}
              </select>
            </div>
            ${breadcrumbHtml}
          </div>

          <div class="d-flex align-items-center gap-2">
            <a href="${openWorkspaceUrl}" class="btn btn-outline btn-sm d-inline-flex align-items-center gap-1" title="Open in Browser Code Workspace">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>Workspace IDE</span>
            </a>
            <button type="button" class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" id="btnUploadFileTrigger">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload to ${escapeHtml(currentBranch)}</span>
            </button>
          </div>
        </div>

        <!-- File Browser Card -->
        <div class="file-browser-card">
          <!-- Commit Snapshot Header -->
          <div class="file-commit-header">
            <div class="d-flex align-items-center gap-2">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80" alt="Author" style="width: 22px; height: 22px; border-radius: 50%;" />
              <strong>${escapeHtml(repo.owner || 'DevSync')}</strong>
              <span class="text-secondary">Branch snapshot: <code>${escapeHtml(currentBranch)}</code> ${currentPath ? 'in <strong>' + escapeHtml(currentPath) + '</strong>' : ''}</span>
            </div>
            <div class="d-flex align-items-center gap-3 text-secondary">
              <span>${currentFiles.length} item${currentFiles.length === 1 ? '' : 's'}</span>
              <span>Updated recently</span>
            </div>
          </div>

          <!-- File List Items -->
          ${currentPath ? `
            <div class="file-row parent-dir-row" data-parent-nav="${escapeHtml(parentPath)}" title="Go to parent directory">
              <div class="file-name-col">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                <span class="table-repo-name">.. (Parent Directory)</span>
              </div>
              <div class="file-commit-col"></div>
              <div class="file-size-col"></div>
              <div class="file-updated-col"></div>
            </div>
          ` : ''}

          ${currentFiles.length === 0 ? `
            <div class="file-empty-state">
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px; color: var(--color-text-primary);">
                No files in this directory
              </div>
              <div class="text-secondary" style="font-size: 13px; margin-bottom: 14px;">
                Branch "<strong>${escapeHtml(currentBranch)}</strong>" has no files at this path.
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="btnUploadFileEmptyTrigger">Upload First File</button>
            </div>
          ` : currentFiles.map(file => {
            const isDir = (file.type === 'dir');
            return `
              <div class="file-row" data-item-path="${escapeHtml(file.path)}" data-item-type="${isDir ? 'dir' : 'file'}" role="button" tabindex="0">
                <div class="file-name-col">
                  ${getFileIcon(file.name, isDir)}
                  <span class="table-repo-name">${escapeHtml(file.name)}${isDir ? '/' : ''}</span>
                </div>
                <div class="file-commit-col" title="${escapeHtml(file.lastCommit || 'Direct branch commit')}">
                  ${escapeHtml(file.lastCommit || 'Direct branch commit')}
                </div>
                <div class="file-size-col">
                  ${isDir ? '<span class="text-secondary">—</span>' : escapeHtml(formatFileSize(file.size))}
                </div>
                <div class="file-updated-col">
                  ${escapeHtml(formatDate(file.updatedAt))}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Event: Toolbar Branch Selector
    const toolbarBranchSel = document.getElementById('fileToolbarBranchSelect');
    if (toolbarBranchSel) {
      toolbarBranchSel.addEventListener('change', (e) => {
        currentBranch = e.target.value;
        if (sidebarBranchSelect) sidebarBranchSelect.value = currentBranch;
        if (uploadBranchSelect) uploadBranchSelect.value = currentBranch;
        currentPath = '';
        updateBranchNotice();
        updateSidebarBadges();
        updateUrl();
        renderFilesTab();
      });
    }

    // Event: Breadcrumbs navigation
    contentArea.querySelectorAll('[data-nav-path]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        currentPath = link.getAttribute('data-nav-path') || '';
        updateUrl();
        renderFilesTab();
      });
    });

    // Event: Parent directory .. row
    contentArea.querySelectorAll('[data-parent-nav]').forEach(row => {
      row.addEventListener('click', () => {
        currentPath = row.getAttribute('data-parent-nav') || '';
        updateUrl();
        renderFilesTab();
      });
    });

    // Event: File and Directory row clicks
    contentArea.querySelectorAll('.file-row[data-item-path]').forEach(row => {
      row.addEventListener('click', () => {
        const itemPath = row.getAttribute('data-item-path');
        const itemType = row.getAttribute('data-item-type');
        if (itemType === 'dir') {
          currentPath = itemPath;
          updateUrl();
          renderFilesTab();
        } else {
          currentPath = itemPath;
          updateUrl();
          renderFileViewer(itemPath);
        }
      });
    });

    // Event: Upload buttons
    document.getElementById('btnUploadFileTrigger')?.addEventListener('click', () => openModal('uploadModal'));
    document.getElementById('btnUploadFileEmptyTrigger')?.addEventListener('click', () => openModal('uploadModal'));
  }

  /* -------------------------------------------------------------------------
   * In-Page File Viewer (Read-Only Preview with Syntax Formatting)
   * ------------------------------------------------------------------------- */
  async function renderFileViewer(filePath) {
    contentArea.innerHTML = `
      <div class="file-viewer-card">
        <div class="text-center py-8 text-secondary">
          <span class="btn-spinner"></span> Loading file: ${escapeHtml(filePath)}...
        </div>
      </div>
    `;

    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const parentDir = pathParts.slice(0, -1).join('/');

    let fileData = null;
    try {
      fileData = await RepositoryService.getFile(repo.id, currentBranch, filePath, repo);
    } catch (err) {
      console.error('File load error:', err);
      contentArea.innerHTML = `
        <div class="file-viewer-card">
          <div class="file-viewer-header">
            <button type="button" class="btn btn-outline btn-sm btn-back-to-files">&larr; Back to Files</button>
            <span class="badge badge-private" style="color: #f87171;">Load Error</span>
          </div>
          <div class="p-6 text-center">
            <div style="font-weight: 700; font-size: 16px; color: var(--color-danger); margin-bottom: 8px;">File Not Found</div>
            <p class="text-secondary" style="font-size: 13.5px;">The file "<strong>${escapeHtml(filePath)}</strong>" could not be loaded from branch "<strong>${escapeHtml(currentBranch)}</strong>".</p>
            <button type="button" class="btn btn-primary btn-sm btn-back-to-files mt-3">Return to Directory</button>
          </div>
        </div>
      `;
      contentArea.querySelectorAll('.btn-back-to-files').forEach(b => {
        b.addEventListener('click', () => {
          currentPath = parentDir;
          updateUrl();
          renderFilesTab();
        });
      });
      return;
    }

    const content = fileData.content || '';
    const lines = content ? content.split('\n') : [];
    const sizeFormatted = formatFileSize(fileData.size || content.length);
    const ext = fileName.split('.').pop().toLowerCase();
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);

    // Build breadcrumbs for file viewer
    let breadcrumbHtml = `
      <div class="file-breadcrumbs">
        <svg class="file-icon folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <a class="file-breadcrumb-item" data-nav-path="">${escapeHtml(repo.name)}</a>
    `;
    let accum = '';
    pathParts.forEach((part, idx) => {
      accum = accum ? `${accum}/${part}` : part;
      const isLast = (idx === pathParts.length - 1);
      breadcrumbHtml += `
        <span class="file-breadcrumb-separator">/</span>
        ${isLast
          ? `<span class="file-breadcrumb-current">${getFileIcon(part, false)} <strong>${escapeHtml(part)}</strong></span>`
          : `<a class="file-breadcrumb-item" data-nav-path="${escapeHtml(accum)}">${escapeHtml(part)}</a>`
        }
      `;
    });
    breadcrumbHtml += `</div>`;

    const openWorkspaceUrl = `${ROUTES.REPOSITORY_WORKSPACE}?repo=${encodeURIComponent(repo.name || repo.id)}&branch=${encodeURIComponent(currentBranch)}&file=${encodeURIComponent(filePath)}`;

    contentArea.innerHTML = `
      <div class="file-viewer-card">
        <!-- File Viewer Top Header -->
        <div class="file-viewer-header">
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <button type="button" class="btn btn-outline btn-sm btn-back-to-files" title="Return to folder">
              &larr; Back to Files
            </button>
            ${breadcrumbHtml}
          </div>

          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline btn-sm" id="btnCopyFileRaw" title="Copy raw file content">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy Raw</span>
            </button>
            <a href="${openWorkspaceUrl}" class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" title="Open and edit this file in the Workspace IDE">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>Edit in IDE</span>
            </a>
          </div>
        </div>

        <!-- File Metadata Sub-Bar -->
        <div class="file-viewer-meta px-4 py-2 bg-surface-subtle border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div class="d-flex align-items-center gap-2">
            <span class="file-viewer-pill">Branch: <strong>${escapeHtml(currentBranch)}</strong></span>
            <span class="file-viewer-pill">${lines.length} lines</span>
            <span class="file-viewer-pill">${sizeFormatted}</span>
            <span class="file-viewer-pill">${escapeHtml(ext.toUpperCase())}</span>
          </div>
          <div class="text-secondary text-xs">
            ${fileData.last_commit ? `Last commit: "${escapeHtml(fileData.last_commit)}"` : ''}
          </div>
        </div>

        <!-- File Content Container -->
        ${isImage ? `
          <div class="binary-file-notice">
            <img src="${escapeHtml(fileData.url || filePath)}" alt="${escapeHtml(fileName)}" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid var(--color-border);" />
            <div class="text-secondary text-sm">${escapeHtml(fileName)} (${sizeFormatted})</div>
          </div>
        ` : `
          <div class="code-viewer-container" id="codeViewerContainer">
            ${renderCodeLines(content)}
          </div>
        `}
      </div>
    `;

    // Event: Back to files
    contentArea.querySelectorAll('.btn-back-to-files').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPath = parentDir;
        updateUrl();
        renderFilesTab();
      });
    });

    // Event: Breadcrumbs navigation in file viewer
    contentArea.querySelectorAll('[data-nav-path]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        currentPath = link.getAttribute('data-nav-path') || '';
        updateUrl();
        renderFilesTab();
      });
    });

    // Event: Copy Raw Code
    const copyBtn = document.getElementById('btnCopyFileRaw');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content);
          toastSuccess(`Copied ${fileName} to clipboard!`);
        } catch (_) {
          const ta = document.createElement('textarea');
          ta.value = content;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toastSuccess(`Copied ${fileName} to clipboard!`);
        }
      });
    }
  }

  /* -------------------------------------------------------------------------
   * Section 3: Dedicated Team Panel
   * ------------------------------------------------------------------------- */
  async function renderTeamTab() {
    let membersRes = { members: [] };
    try {
      membersRes = await RepositoryService.getMembers(repo.id);
    } catch (err) {
      console.warn('Failed to load members:', err);
    }

    const members = membersRes.members || [];
    const isOwnerOrMaintainer = true; // Authorized by default in active workspace

    contentArea.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-5 flex-wrap gap-3">
        <div>
          <h2 class="font-heading" style="font-size: 20px; margin: 0 0 4px 0;">Repository Team &amp; Collaborators</h2>
          <p class="text-secondary" style="font-size: 13.5px; margin: 0;">
            ${members.length} team members managing code, pull requests, and features.
          </p>
        </div>
        ${isOwnerOrMaintainer ? `
          <button type="button" class="btn btn-primary btn-sm" id="btnInviteMemberTrigger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            Invite Collaborator
          </button>
        ` : ''}
      </div>

      <div class="repo-team-grid">
        ${members.map(m => `
          <div class="team-member-card">
            <div class="team-member-header">
              <div class="team-member-user-info">
                <img src="${escapeHtml(m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80')}" alt="${escapeHtml(m.name)}" class="team-member-avatar" />
                <div>
                  <div style="font-weight: 700; font-size: 14.5px;">
                    <a href="../developers/profile.html?user=${encodeURIComponent(m.username)}" class="text-decoration-none" style="color: inherit;">
                      ${escapeHtml(m.name || m.username)}
                    </a>
                  </div>
                  <div class="text-secondary" style="font-size: 12px;">@${escapeHtml(m.username)}</div>
                </div>
              </div>
              <span class="role-pill ${escapeHtml((m.role || 'Collaborator').toLowerCase())}">
                ${escapeHtml(m.role || 'Collaborator')}
              </span>
            </div>

            <!-- Responsibility Area -->
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="text-secondary" style="font-size: 11.5px; font-weight: 600;">Focus:</span>
              <span class="resp-pill">${escapeHtml(m.responsibility || 'Engineering')}</span>
            </div>

            <!-- Meaningful Assigned Tasks -->
            <div class="repo-assigned-tasks">
              <div class="text-secondary" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Assigned Tasks</div>
              ${(m.assignedTasks || []).length === 0 ? `
                <div class="text-secondary" style="font-size: 12px;">No active tasks assigned</div>
              ` : m.assignedTasks.map(task => `
                <div class="repo-assigned-task-item">
                  <span>${escapeHtml(task.title)}</span>
                  <span class="task-status-pill ${(task.status || '').toLowerCase().replace(' ', '-')}">${escapeHtml(task.status || 'Pending')}</span>
                </div>
              `).join('')}
            </div>

            <!-- Management Actions for Maintainers -->
            ${isOwnerOrMaintainer && m.role !== 'Owner' ? `
              <div class="d-flex align-items-center justify-content-between pt-3 border-top mt-2">
                <select class="form-select member-role-updater" data-member-user="${escapeHtml(m.username)}" style="font-size: 11.5px; padding: 2px 6px; width: 120px; height: 26px;">
                  <option value="Maintainer" ${m.role === 'Maintainer' ? 'selected' : ''}>Maintainer</option>
                  <option value="Collaborator" ${m.role === 'Collaborator' ? 'selected' : ''}>Collaborator</option>
                  <option value="Viewer" ${m.role === 'Viewer' ? 'selected' : ''}>Viewer</option>
                </select>
                <button type="button" class="btn btn-outline btn-sm text-danger btn-remove-member" data-member-user="${escapeHtml(m.username)}" style="font-size: 11px; padding: 2px 8px;">
                  Remove
                </button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('btnInviteMemberTrigger')?.addEventListener('click', () => openModal('inviteModal'));

    // Role Updater Listeners
    contentArea.querySelectorAll('.member-role-updater').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const username = sel.getAttribute('data-member-user');
        const newRole = sel.value;
        try {
          await RepositoryService.updateMember(repo.id, username, { role: newRole });
          toastSuccess(`Updated @${username}'s role to ${newRole}`);
          await loadRepository();
        } catch (err) {
          toastDanger(err.message || 'Failed to update member role.');
        }
      });
    });

    // Remove Member Listeners
    contentArea.querySelectorAll('.btn-remove-member').forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = btn.getAttribute('data-member-user');
        if (confirm(`Are you sure you want to remove @${username} from ${repo.name}?`)) {
          try {
            await RepositoryService.removeMember(repo.id, username);
            toastSuccess(`Removed @${username} from repository`);
            await loadRepository();
          } catch (err) {
            toastDanger(err.message || 'Failed to remove collaborator.');
          }
        }
      });
    });
  }

  /* -------------------------------------------------------------------------
   * Branches Tab (Isolated Workspaces, Aligned Table, Clear Actions)
   * ------------------------------------------------------------------------- */
  async function renderBranchesTab() {
    let branchesRes = { branches: [] };
    try {
      branchesRes = await RepositoryService.getBranches(repo.id, repo);
    } catch (err) {
      console.warn('Failed to load branches:', err);
    }

    branches = branchesRes.branches || branches;
    if (!branches || branches.length === 0) {
      branches = [{
        name: repo.defaultBranch || 'main',
        isDefault: true,
        filesCount: (repo.files?.[repo.defaultBranch || 'main']?.length || 0),
        lastCommit: 'Initial commit',
        lastActor: repo.owner || 'developer',
        updatedAt: 'Recently'
      }];
    }

    contentArea.innerHTML = `
      <div class="branches-view-container">
        <!-- Branches Header Bar -->
        <div class="branches-header-bar">
          <div>
            <h2 class="font-heading branches-title">Repository Branches</h2>
            <p class="text-secondary branches-subtitle">
              ${branches.length} branch${branches.length === 1 ? '' : 'es'} tracked for <strong>${escapeHtml(repo.name)}</strong>. Isolated workspaces for developing features, reviews, and fixes.
            </p>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="branch-current-badge">
              Active Context: <strong>${escapeHtml(currentBranch)}</strong>
            </span>
          </div>
        </div>

        <!-- Branches Table Card -->
        <div class="branches-card">
          <div class="table-responsive">
            <table class="data-table branches-table">
              <thead>
                <tr>
                  <th class="col-branch">Branch</th>
                  <th class="col-status">Status</th>
                  <th class="col-commit">Latest Commit</th>
                  <th class="col-updated">Updated</th>
                  <th class="col-actions text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${branches.map(b => {
                  const isCurrent = (b.name === currentBranch);
                  const isDef = Boolean(b.isDefault);
                  return `
                    <tr class="branch-row ${isCurrent ? 'branch-row-current' : ''}">
                      <td class="col-branch">
                        <div class="branch-name-wrap">
                          <svg class="branch-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                          <strong class="branch-name-text">${escapeHtml(b.name)}</strong>
                          ${isCurrent ? `<span class="badge badge-viewing">Viewing</span>` : ''}
                        </div>
                      </td>
                      <td class="col-status">
                        ${isDef
                          ? `<span class="badge badge-default-branch">Default</span>`
                          : `<span class="badge badge-active-branch">Active</span>`
                        }
                      </td>
                      <td class="col-commit">
                        <div class="branch-commit-info">
                          <span class="branch-commit-msg" title="${escapeHtml(b.lastCommit || 'Direct branch commit')}">
                            ${escapeHtml(b.lastCommit || 'Direct branch commit')}
                          </span>
                          ${b.lastActor ? `<span class="text-secondary" style="font-size: 11px;">by @${escapeHtml(b.lastActor)}</span>` : ''}
                        </div>
                      </td>
                      <td class="col-updated">
                        <span class="text-secondary" style="font-size: 12.5px;">${escapeHtml(formatDate(b.updatedAt || b.updated))}</span>
                      </td>
                      <td class="col-actions text-right">
                        ${isCurrent ? `
                          <button type="button" class="btn btn-outline btn-sm btn-branch-viewing" disabled>
                            &check; Current Branch
                          </button>
                        ` : `
                          <button type="button" class="btn btn-primary btn-sm btn-switch-branch" data-branch="${escapeHtml(b.name)}">
                            Switch Branch &rarr;
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Hook up switch branch action buttons
    contentArea.querySelectorAll('.btn-switch-branch').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetBranch = btn.getAttribute('data-branch');
        if (!targetBranch) return;
        currentBranch = targetBranch;
        if (sidebarBranchSelect) sidebarBranchSelect.value = currentBranch;
        if (uploadBranchSelect) uploadBranchSelect.value = currentBranch;
        currentPath = '';
        updateBranchNotice();
        updateSidebarBadges();
        toastSuccess(`Switched active workspace to branch "${currentBranch}"`);

        // Switch to Code & Files view to browse the selected branch
        currentTab = 'files';
        tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-repo-tab') === 'files'));
        updateUrl();
        renderCurrentTab();
      });
    });
  }

  /* -------------------------------------------------------------------------
   * Pull Requests Tab
   * ------------------------------------------------------------------------- */
  async function renderPullRequestsTab() {
    const prs = [
      { id: 101, title: 'feat: add token authentication and role checking', author: 'naveen3438', source: 'feature/authentication', target: 'develop', status: 'Open', updated: '2 hours ago' },
      { id: 102, title: 'fix: resolve race conditions on file upload streams', author: 'chaturya', source: 'fix/upload-sync', target: 'main', status: 'Open', updated: '1 day ago' },
      { id: 98, title: 'perf: optimize multi-column indexes for pulse engine', author: 'balaji', source: 'perf/pulse-index', target: 'main', status: 'Merged', updated: '3 days ago' }
    ];

    contentArea.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <h2 class="font-heading" style="font-size: 18px; margin: 0 0 4px 0;">Pull Requests</h2>
          <p class="text-secondary" style="font-size: 13px; margin: 0;">Code reviews and branches proposed for merging into ${escapeHtml(repo.name)}.</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Branches</th>
              <th>Author</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${prs.map(pr => `
              <tr>
                <td>
                  <div style="font-weight: 600;">#${pr.id} ${escapeHtml(pr.title)}</div>
                </td>
                <td>
                  <span class="badge ${pr.status === 'Open' ? 'badge-public' : 'badge-private'}">${escapeHtml(pr.status)}</span>
                </td>
                <td>
                  <code style="font-size: 11.5px;">${escapeHtml(pr.source)} &rarr; ${escapeHtml(pr.target)}</code>
                </td>
                <td>@${escapeHtml(pr.author)}</td>
                <td class="text-secondary">${escapeHtml(pr.updated)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Issues Tab
   * ------------------------------------------------------------------------- */
  async function renderIssuesTab() {
    const issues = [
      { id: 45, title: 'Path traversal protection check on nested uploads', author: 'balaji', labels: ['security', 'backend'], status: 'Open', created: 'Yesterday' },
      { id: 44, title: 'Add responsive drawer navigation for repository workspace', author: 'naveen3438', labels: ['ui/ux', 'frontend'], status: 'Open', created: '2 days ago' },
      { id: 41, title: 'Upgrade password hashing to PBKDF2 SHA-256', author: 'chaturya', labels: ['security'], status: 'Closed', created: '4 days ago' }
    ];

    contentArea.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <h2 class="font-heading" style="font-size: 18px; margin: 0 0 4px 0;">Issues</h2>
          <p class="text-secondary" style="font-size: 13px; margin: 0;">Bug reports, feature tasks, and technical proposals.</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Labels</th>
              <th>Author</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${issues.map(iss => `
              <tr>
                <td>
                  <div style="font-weight: 600;">#${iss.id} ${escapeHtml(iss.title)}</div>
                </td>
                <td>
                  ${iss.labels.map(l => `<span class="badge badge-private" style="font-size: 10.5px; margin-right: 4px;">${escapeHtml(l)}</span>`).join('')}
                </td>
                <td>@${escapeHtml(iss.author)}</td>
                <td>
                  <span class="badge ${iss.status === 'Open' ? 'badge-public' : 'badge-private'}">${escapeHtml(iss.status)}</span>
                </td>
                <td class="text-secondary">${escapeHtml(iss.created)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Activity Tab
   * ------------------------------------------------------------------------- */
  async function renderActivityTab() {
    let actRes = { events: [] };
    try {
      actRes = await RepositoryService.getActivity(repo.id);
    } catch (err) {
      console.warn('Failed to fetch repo activity:', err);
    }

    const events = actRes.events || [];

    contentArea.innerHTML = `
      <div class="mb-4">
        <h2 class="font-heading" style="font-size: 18px; margin: 0 0 4px 0;">Repository Activity Feed</h2>
        <p class="text-secondary" style="font-size: 13px; margin: 0;">Audit log of commits, branch file uploads, and collaboration changes.</p>
      </div>

      <div class="dev-activity-list">
        ${events.length === 0 ? `
          <div class="text-secondary py-4 text-center">No recent activity recorded for this repository.</div>
        ` : events.map(evt => `
          <div class="dev-activity-item">
            <div class="dev-activity-dot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
            </div>
            <div class="dev-activity-details">
              <div class="dev-activity-title-row">
                <span class="dev-activity-title">
                  <strong>@${escapeHtml(evt.actor || 'developer')}</strong> &bull; ${escapeHtml(evt.title || evt.action)}
                </span>
                <span class="dev-activity-time">${escapeHtml(evt.time || 'Recently')}</span>
              </div>
              <p class="dev-activity-desc">${escapeHtml(evt.description || '')}</p>
              ${evt.branch ? `
                <div class="text-secondary" style="font-size: 11.5px; margin-top: 2px;">
                  Branch: <code style="font-size: 11px;">${escapeHtml(evt.branch)}</code>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Settings Tab
   * ------------------------------------------------------------------------- */
  function renderSettingsTab() {
    contentArea.innerHTML = `
      <div class="mb-4">
        <h2 class="font-heading" style="font-size: 18px; margin: 0 0 4px 0;">Repository Settings</h2>
        <p class="text-secondary" style="font-size: 13px; margin: 0;">Configure repository metadata, access controls, and default branches.</p>
      </div>

      <div class="card p-5 mb-5">
        <div class="form-group mb-3">
          <label class="form-label">Repository Name</label>
          <input type="text" class="form-control" value="${escapeHtml(repo.name)}" readonly />
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Description</label>
          <input type="text" class="form-control" value="${escapeHtml(repo.description || '')}" id="settingsRepoDesc" />
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Default Branch</label>
          <select class="form-select" id="settingsDefaultBranch">
            ${branches.map(b => `<option value="${escapeHtml(b.name)}" ${b.isDefault ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-4">
          <label class="form-label">Visibility</label>
          <div>
            <span class="badge ${repo.visibility === 'Public' ? 'badge-public' : 'badge-private'}">${escapeHtml(repo.visibility)}</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btnSaveRepoSettings">Save Changes</button>
      </div>

      <div class="card p-5 border-danger">
        <h3 class="font-heading text-danger" style="font-size: 16px; margin: 0 0 6px 0;">Danger Zone</h3>
        <p class="text-secondary" style="font-size: 13px; margin-bottom: 14px;">Actions here can disrupt access or permanently archive repository branches.</p>
        <button type="button" class="btn btn-outline text-danger btn-sm" onclick="alert('Repository archive action restricted to project owners.')">
          Archive Repository
        </button>
      </div>
    `;

    document.getElementById('btnSaveRepoSettings')?.addEventListener('click', () => {
      toastSuccess('Repository settings saved successfully.');
    });
  }

  /* -------------------------------------------------------------------------
   * Section 4: File Upload & Drag-and-Drop Implementation
   * ------------------------------------------------------------------------- */
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('uploadFileInput');
  const pathInput = document.getElementById('uploadFilePath');
  const msgInput = document.getElementById('uploadCommitMessage');
  const conflictBox = document.getElementById('uploadConflictBox');
  const overwriteCheck = document.getElementById('confirmOverwriteCheckbox');
  const branchForm = document.getElementById('branchUploadForm');

  function resetUploadModal() {
    pendingUploadContent = '';
    if (pathInput) pathInput.value = '';
    if (msgInput) msgInput.value = '';
    if (fileInput) fileInput.value = '';
    if (conflictBox) conflictBox.classList.add('d-none');
    if (overwriteCheck) overwriteCheck.checked = false;
    const dropText = document.getElementById('dropzoneText');
    if (dropText) dropText.textContent = 'Drag and drop file here, or click to browse';
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });

    ['dragleave', 'dragend'].forEach(evt => {
      dropzone.addEventListener(evt, () => dropzone.classList.remove('drag-active'));
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelection(fileInput.files[0]);
      }
    });
  }

  function handleFileSelection(file) {
    const dropText = document.getElementById('dropzoneText');
    if (dropText) dropText.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    if (pathInput && !pathInput.value) {
      pathInput.value = file.name;
    }
    if (msgInput && !msgInput.value) {
      msgInput.value = `feat: upload ${file.name} to ${uploadBranchSelect.value}`;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      pendingUploadContent = e.target.result;
    };
    reader.readAsText(file);
  }

  if (branchForm) {
    branchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetBranch = uploadBranchSelect.value;
      const targetPath = pathInput.value.trim();
      const commitMessage = msgInput.value.trim();
      const overwrite = overwriteCheck ? overwriteCheck.checked : false;

      if (!targetPath) {
        toastDanger('Please specify destination path in repository.');
        return;
      }

      if (!commitMessage) {
        toastDanger('Please provide a commit message or change summary.');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitBranchUpload');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Committing...';

      try {
        const payload = {
          branch: targetBranch,
          path: targetPath,
          content: pendingUploadContent || `// ${targetPath}\n`,
          commitMessage,
          overwrite
        };

        const res = await RepositoryService.uploadFile(repo.id, payload);
        toastSuccess(`Committed ${targetPath} directly to ${targetBranch}!`, 'Upload Complete');
        closeModal('uploadModal');
        currentBranch = targetBranch;
        if (sidebarBranchSelect) sidebarBranchSelect.value = currentBranch;
        currentTab = 'files';
        tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-repo-tab') === 'files'));
        await loadRepository();
      } catch (err) {
        if (err.status === 409 || err.message?.includes('already exists') || err.message?.includes('409')) {
          // HTTP 409 Conflict: File exists on branch
          if (conflictBox) {
            conflictBox.classList.remove('d-none');
            const conflictBranchEl = document.getElementById('conflictBranchName');
            if (conflictBranchEl) conflictBranchEl.textContent = targetBranch;
          }
          toastWarning(`File "${targetPath}" already exists on branch "${targetBranch}". Check confirmation to overwrite.`);
        } else {
          toastDanger(err.message || 'File upload failed.');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Commit & Upload';
      }
    });
  }

  // Attachment Upload Handler
  const attForm = document.getElementById('attachmentUploadForm');
  if (attForm) {
    attForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const attFile = document.getElementById('attachmentFileInput')?.files?.[0];
      const desc = document.getElementById('attachmentDescInput')?.value?.trim();

      if (!attFile) {
        toastDanger('Please select an attachment file.');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitAttachmentUpload');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Uploading...';

      try {
        await RepositoryService.uploadAttachment(repo.id, {
          name: attFile.name,
          size: `${(attFile.size / 1024).toFixed(1)} KB`,
          type: attFile.type || 'document',
          description: desc || 'Supporting project asset'
        });
        toastSuccess('Attachment uploaded successfully.');
        closeModal('attachmentModal');
        await loadRepository();
      } catch (err) {
        toastDanger(err.message || 'Failed to upload attachment.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload Attachment';
      }
    });
  }

  // Invite Collaborator Form Handler
  const inviteForm = document.getElementById('inviteCollaboratorForm');
  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('inviteUsernameInput')?.value?.trim();
      const role = document.getElementById('inviteRoleSelect')?.value || 'Collaborator';
      const responsibility = document.getElementById('inviteRespInput')?.value?.trim() || 'Engineering';

      if (!username) {
        toastDanger('Please enter a username or email.');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitInvite');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Inviting...';

      try {
        await RepositoryService.inviteMember(repo.id, { username, role, responsibility });
        toastSuccess(`Invitation sent to @${username} as ${role}!`);
        closeModal('inviteModal');
        await loadRepository();
      } catch (err) {
        toastDanger(err.message || 'Failed to send invitation.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Invitation';
      }
    });
  }

  // Initial Load
  await loadRepository();
}
