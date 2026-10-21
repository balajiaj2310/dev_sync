/**
 * DevSync Dashboard Controller
 * Exact reproduction of Reference Image 1 Overview interactions
 */

import { MockAPI } from '../mock/mock-api.js';
import { RepositoryService } from '../services/repository-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { ModalManager } from '../core/modal-manager.js';
import { toastSuccess } from '../components/toast.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function initDashboardPage() {
  // Load Dynamic Overview Metrics
  const metrics = await MockAPI.getOverviewMetrics();
  if (metrics) {
    const setMetric = (id, count, trend, isUp) => {
      const el = document.getElementById(id);
      if (el) {
        el.querySelector('.metric-value').textContent = count;
        const trendEl = el.querySelector('.metric-badge-trend');
        if (trendEl) {
          trendEl.textContent = `${isUp ? '↑' : '↓'} ${trend}%`;
          trendEl.className = `metric-badge-trend ${isUp ? 'trend-up' : 'trend-down'}`;
        }
      }
    };

    setMetric('metricRepos', metrics.repositories.count, metrics.repositories.trend, metrics.repositories.isUp);
    setMetric('metricPRs', metrics.pullRequests.count, metrics.pullRequests.trend, metrics.pullRequests.isUp);
    setMetric('metricIssues', metrics.issues.count, metrics.issues.trend, metrics.issues.isUp);
    setMetric('metricTeam', metrics.teamMembers.count, metrics.teamMembers.trend, metrics.teamMembers.isUp);
  }

  // Load Real Recent Repositories
  const recentReposBody = document.getElementById('overviewRecentReposBody');
  if (recentReposBody) {
    try {
      const repos = await RepositoryService.getRepositories();
      if (Array.isArray(repos) && repos.length > 0) {
        recentReposBody.innerHTML = repos.slice(0, 6).map(repo => `
          <tr>
            <td>
              <a href="${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(repo.name || repo.id)}" class="table-repo-name">${escapeHtml(repo.name)}</a>
            </td>
            <td>
              <span class="lang-indicator"><span class="lang-dot" style="background-color: ${repo.languageColor || '#3572A5'};"></span>${escapeHtml(repo.language || 'Python')}</span>
            </td>
            <td>${repo.stars || 0}</td>
            <td class="text-secondary">${escapeHtml(repo.updated || 'Recently')}</td>
            <td><span class="badge ${repo.visibility === 'Public' ? 'badge-public' : 'badge-private'}">${escapeHtml(repo.visibility || 'Private')}</span></td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Could not load recent repositories for dashboard:', e);
    }
  }

  // Metric Card Click Navigation
  document.getElementById('metricRepos')?.addEventListener('click', () => navigateTo(ROUTES.REPOSITORIES));
  document.getElementById('metricPRs')?.addEventListener('click', () => navigateTo(ROUTES.PULL_REQUESTS));
  document.getElementById('metricIssues')?.addEventListener('click', () => navigateTo(ROUTES.ISSUES));
  document.getElementById('metricTeam')?.addEventListener('click', () => navigateTo(ROUTES.TEAM_MEMBERS));

  // Quick Action Buttons
  document.getElementById('btnNewRepo')?.addEventListener('click', () => navigateTo(ROUTES.REPOSITORY_CREATE));
  document.getElementById('btnInviteTeam')?.addEventListener('click', () => ModalManager.open('inviteTeamModal'));

  // Invite Team Modal Form Submission
  const inviteForm = document.getElementById('inviteTeamForm');
  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = inviteForm.querySelector('#inviteEmail').value;
      const role = inviteForm.querySelector('#inviteRole').value;
      await MockAPI.inviteMember({ email, role });
      ModalManager.close('inviteTeamModal');
      toastSuccess(`Invitation sent to ${email} as ${role}!`, 'Team Invitation');
      inviteForm.reset();
    });
  }
}
