/**
 * DevSync Repositories Page Controller
 */

import { RepositoryService } from '../services/repository-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { isValidRepoName } from '../core/validators.js';
import { toastSuccess, toastDanger } from '../components/toast.js';

export async function initRepositoriesPage() {
  const repoTableBody = document.getElementById('repoTableBody');
  const searchInput = document.getElementById('repoSearchInput');
  const langFilter = document.getElementById('repoLanguageFilter');
  const sortFilter = document.getElementById('repoSortFilter');

  // Check URL query params for initial search
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

    if (repos.length === 0) {
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
            <a href="${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(repo.name)}" class="table-repo-name">${repo.name}</a>
          </div>
        </td>
        <td class="text-secondary" style="max-width: 280px;">${repo.description}</td>
        <td>
          <span class="lang-indicator">
            <span class="lang-dot" style="background-color: ${repo.languageColor};"></span>
            ${repo.language}
          </span>
        </td>
        <td>
          <span class="stat-group">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${repo.stars}
          </span>
        </td>
        <td>
          <span class="stat-group">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            ${repo.forks}
          </span>
        </td>
        <td class="text-secondary">${repo.updated}</td>
        <td>
          <span class="badge ${repo.visibility === 'Public' ? 'badge-public' : 'badge-private'}">${repo.visibility}</span>
        </td>
        <td>
          <button class="row-action-btn" title="More options" data-repo-id="${repo.id}">&bull;&bull;&bull;</button>
        </td>
      </tr>
    `).join('');
  }

  if (searchInput) searchInput.addEventListener('input', renderRepositories);
  if (langFilter) langFilter.addEventListener('change', renderRepositories);
  if (sortFilter) sortFilter.addEventListener('change', renderRepositories);

  renderRepositories();

  // Create Repository Form
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
        setTimeout(() => navigateTo(ROUTES.REPOSITORIES), 600);
      } catch (err) {
        toastDanger(err.message || 'Failed to create repository.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Repository';
      }
    });
  }
}
