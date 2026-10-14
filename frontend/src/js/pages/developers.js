/**
 * DevSync Developers & Social Connections Controller
 */

import { ConnectionService } from '../services/connection-service.js';
import { ROUTES } from '../core/route-config.js';
import { toastSuccess, toastInfo } from '../components/toast.js';

export async function initDevelopersPage() {
  const devGrid = document.getElementById('developerGrid');
  const searchInput = document.getElementById('devSearchInput');
  const skillFilter = document.getElementById('devSkillFilter');

  async function renderDevelopers() {
    if (!devGrid) return;
    const search = searchInput ? searchInput.value.trim() : '';
    const skill = skillFilter ? skillFilter.value : '';

    const developers = await ConnectionService.getDevelopers({ search, skill });

    devGrid.innerHTML = developers.map(dev => {
      let btnLabel = 'Connect';
      let btnClass = 'btn-primary';

      if (dev.connectionState === 'Request Sent') {
        btnLabel = 'Pending &bull; Cancel';
        btnClass = 'btn-outline';
      } else if (dev.connectionState === 'Accept Request') {
        btnLabel = 'Accept Request';
        btnClass = 'btn-mint';
      } else if (dev.connectionState === 'Connected') {
        btnLabel = 'Connected &check;';
        btnClass = 'btn-outline';
      }

      return `
        <div class="developer-card" data-dev-id="${dev.id}">
          <a href="${ROUTES.DEVELOPER_PROFILE}?user=${dev.username}" style="text-decoration: none; display: block;">
            <img src="${dev.avatar}" alt="${dev.name}" class="dev-avatar-lg" />
          </a>
          <a href="${ROUTES.DEVELOPER_PROFILE}?user=${dev.username}" class="dev-name" style="text-decoration: none; color: inherit;">${dev.name}</a>
          <div class="dev-handle">@${dev.username}</div>
          <div class="dev-bio">${dev.bio}</div>
          <div class="dev-skills-wrap">
            ${dev.skills.map(s => `<span class="tag-label">${s}</span>`).join('')}
          </div>
          <div class="dev-actions">
            <a href="${ROUTES.DEVELOPER_PROFILE}?user=${dev.username}" class="btn btn-outline btn-sm">Profile</a>
            <button class="btn btn-sm ${btnClass} btn-connect-state" data-state="${dev.connectionState}">${btnLabel}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (searchInput) searchInput.addEventListener('input', renderDevelopers);
  if (skillFilter) skillFilter.addEventListener('change', renderDevelopers);

  // Connection State Machine Interactions
  if (devGrid) {
    devGrid.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-connect-state');
      if (!btn) return;
      const card = btn.closest('.developer-card');
      const devId = card.getAttribute('data-dev-id');
      const currentState = btn.getAttribute('data-state');

      let nextState = 'Request Sent';
      if (currentState === 'Not Connected') {
        nextState = 'Request Sent';
        toastSuccess('Connection request sent!', 'Connection');
      } else if (currentState === 'Request Sent') {
        nextState = 'Not Connected';
        toastInfo('Connection request cancelled.');
      } else if (currentState === 'Accept Request') {
        nextState = 'Connected';
        toastSuccess('You are now connected!', 'Connection Accepted');
      } else if (currentState === 'Connected') {
        nextState = 'Not Connected';
        toastInfo('Disconnected.');
      }

      await ConnectionService.updateConnectionState(devId, nextState);
      renderDevelopers();
    });
  }

  renderDevelopers();
}
