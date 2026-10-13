/**
 * DevSync Issues Page Controller
 * Exact reproduction of Reference Image 1 Issues UI
 */

import { IssueService } from '../services/issue-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { toastSuccess, toastDanger } from '../components/toast.js';

export async function initIssuesPage() {
  const issueTableBody = document.getElementById('issueTableBody');
  const searchInput = document.getElementById('issueSearchInput');
  const labelFilter = document.getElementById('issueLabelFilter');
  const repoFilter = document.getElementById('issueRepoFilter');
  const tabs = document.querySelectorAll('.issue-tab-btn');
  let currentStatus = 'Open';

  async function renderIssues() {
    if (!issueTableBody) return;
    const query = searchInput ? searchInput.value.trim() : '';
    const label = labelFilter ? labelFilter.value : '';

    issueTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4"><span class="btn-spinner"></span> Loading issues...</td></tr>`;

    const issues = await IssueService.getIssues({ status: currentStatus, search: query, label });

    if (issues.length === 0) {
      issueTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-6">
            <div class="empty-state">
              <div class="empty-state-title">No ${currentStatus.toLowerCase()} issues</div>
              <div class="empty-state-desc">There are no open issues matching your search filters.</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    issueTableBody.innerHTML = issues.map(issue => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <span class="issue-icon-dot ${issue.status === 'Closed' ? 'closed' : ''}"></span>
            <a href="${ROUTES.ISSUE_DETAIL}?id=${issue.number}" class="issue-title-link">${issue.title}</a>
          </div>
        </td>
        <td>
          <span class="repo-pill">${issue.repository}</span>
        </td>
        <td>
          <div class="d-flex align-items-center gap-1">
            ${issue.labels.map(lbl => `<span class="tag-label tag-${lbl}">${lbl}</span>`).join('')}
          </div>
        </td>
        <td>
          <div class="author-mini">
            <img src="${issue.authorAvatar}" alt="${issue.author}" class="author-avatar-xs" />
            <span>${issue.author}</span>
          </div>
        </td>
        <td>
          <span class="stat-group">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${issue.commentsCount}
          </span>
        </td>
        <td class="text-secondary">${issue.updated}</td>
        <td>
          <button class="row-action-btn" title="More options">&bull;&bull;&bull;</button>
        </td>
      </tr>
    `).join('');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatus = tab.getAttribute('data-status') || 'Open';
      renderIssues();
    });
  });

  if (searchInput) searchInput.addEventListener('input', renderIssues);
  if (labelFilter) labelFilter.addEventListener('change', renderIssues);
  if (repoFilter) repoFilter.addEventListener('change', renderIssues);

  renderIssues();

  // Create Issue Form
  const createIssueForm = document.getElementById('createIssueForm');
  if (createIssueForm) {
    createIssueForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = createIssueForm.querySelector('#issueTitle').value.trim();
      const description = createIssueForm.querySelector('#issueDescription').value.trim();
      const repository = createIssueForm.querySelector('#issueRepo').value;

      if (!title) {
        toastDanger('Please enter an issue title.');
        return;
      }

      await IssueService.createIssue({ title, description, repository });
      toastSuccess(`Issue #${Date.now().toString().slice(-3)} created successfully!`, 'Issue Created');
      setTimeout(() => navigateTo(ROUTES.ISSUES), 600);
    });
  }
}
