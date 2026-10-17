/**
 * DevSync Developers & Social Connections Controller
 * Robust directory view with loading, empty, and error states
 */

import { ConnectionService } from '../services/connection-service.js';
import { ROUTES } from '../core/route-config.js';
import { toastSuccess, toastInfo, toastDanger } from '../components/toast.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function initDevelopersPage() {
  const devGrid = document.getElementById('developerGrid');
  const searchInput = document.getElementById('devSearchInput');
  const skillFilter = document.getElementById('devSkillFilter');

  if (!devGrid) return;

  async function renderDevelopers() {
    const search = searchInput ? searchInput.value.trim() : '';
    const skill = skillFilter ? skillFilter.value : '';

    // 1. Show Loading State
    devGrid.innerHTML = `
      <div class="developer-loading-state" role="status" aria-live="polite">
        <div class="spinner mb-3" style="margin: 0 auto 12px auto;"></div>
        <p class="text-secondary" style="font-size: 14px; margin: 0;">Discovering talented developers...</p>
      </div>
    `;

    try {
      const developers = await ConnectionService.getDevelopers({ search, skill });

      // 2. Handle Empty State
      if (!developers || developers.length === 0) {
        devGrid.innerHTML = `
          <div class="developer-empty-state">
            <div style="font-size: 42px; line-height: 1; margin-bottom: 12px;">👥</div>
            <h3 class="font-heading mb-2" style="font-size: 18px; font-weight: 700;">No developers found</h3>
            <p class="text-secondary mb-4" style="font-size: 13.5px; max-width: 380px; margin: 0 auto 16px auto;">
              No developers matched your search ${search ? `for "<strong>${escapeHtml(search)}</strong>"` : ''} 
              ${skill && skill !== 'All Skills' ? `with skill "<strong>${escapeHtml(skill)}</strong>"` : ''}.
            </p>
            <button id="btnClearFilters" class="btn btn-primary btn-pill btn-sm">Clear Filters</button>
          </div>
        `;

        const clearBtn = document.getElementById('btnClearFilters');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (skillFilter) skillFilter.value = 'All Skills';
            renderDevelopers();
          });
        }
        return;
      }

      // 3. Render Developer Cards
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

        const profileUrl = `profile.html?user=${encodeURIComponent(dev.username)}`;
        const avatarSrc = dev.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';

        // Format skills safely
        const rawSkills = Array.isArray(dev.skills) ? dev.skills : [];
        const skillList = rawSkills.map(s => typeof s === 'string' ? s : (s?.name || '')).filter(Boolean);
        const topSkills = skillList.slice(0, 4);
        const remainingCount = skillList.length - 4;

        const skillsHtml = topSkills.map(s => `<span class="tag-label">${escapeHtml(s)}</span>`).join('') +
          (remainingCount > 0 ? `<span class="tag-label tag-more">+${remainingCount}</span>` : '');

        const isBusy = dev.collaborationStatusType === 'busy';
        const statusLabel = dev.collaborationStatus || (isBusy ? 'Busy' : 'Available for collaboration');

        return `
          <div class="developer-card" data-dev-id="${escapeHtml(dev.id || dev.username)}">
            <a href="${profileUrl}" style="text-decoration: none; display: block;" title="View ${escapeHtml(dev.name)}'s Profile">
              <img src="${avatarSrc}" alt="${escapeHtml(dev.name)}" class="dev-avatar-lg" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';" />
            </a>
            
            <a href="${profileUrl}" class="dev-name" style="text-decoration: none; color: inherit;">
              ${escapeHtml(dev.name)}
              ${dev.isVerified !== false ? '<span style="color: var(--color-primary); font-size: 13px;" title="Verified">&#10003;</span>' : ''}
            </a>
            
            <div class="dev-handle">@${escapeHtml(dev.username)}</div>

            <div style="font-size: 12px; font-weight: 600; color: var(--color-primary); margin-bottom: 6px;">
              ${escapeHtml(dev.role || 'Developer')}
            </div>

            <div class="dev-bio">
              ${escapeHtml(dev.headline || dev.bio || 'Building modern applications with DevSync.')}
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 12px;">
              <span class="badge-dot ${isBusy ? 'bg-danger' : 'bg-success'}"></span>
              <span style="font-size: 11.5px;">${escapeHtml(dev.location || statusLabel)}</span>
            </div>

            <div class="dev-skills-wrap">
              ${skillsHtml}
            </div>

            <div class="dev-actions">
              <a href="${profileUrl}" class="btn btn-outline btn-sm">Profile</a>
              <button class="btn btn-sm ${btnClass} btn-connect-state" data-state="${escapeHtml(dev.connectionState || 'Not Connected')}">${btnLabel}</button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      // 4. Handle Error State
      console.error('[DevelopersPage] Failed to render developers:', err);
      devGrid.innerHTML = `
        <div class="developer-error-state">
          <div style="font-size: 38px; line-height: 1; margin-bottom: 12px; color: var(--color-danger);">⚠️</div>
          <h3 class="font-heading mb-2" style="font-size: 18px; font-weight: 700;">Failed to load developers</h3>
          <p class="text-secondary mb-4" style="font-size: 13.5px; max-width: 400px; margin: 0 auto 16px auto;">
            ${escapeHtml(err.message || 'An error occurred while loading the developer directory.')}
          </p>
          <button id="btnRetryDevelopers" class="btn btn-primary btn-pill btn-sm">Try Again</button>
        </div>
      `;

      const retryBtn = document.getElementById('btnRetryDevelopers');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => renderDevelopers());
      }
    }
  }

  // Search input debouncing
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(renderDevelopers, 250);
    });
  }

  if (skillFilter) {
    skillFilter.addEventListener('change', renderDevelopers);
  }

  // Connection State Machine Interactions
  devGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-connect-state');
    if (!btn) return;
    const card = btn.closest('.developer-card');
    const devId = card?.getAttribute('data-dev-id');
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

    // Optimistically update button in DOM
    btn.setAttribute('data-state', nextState);
    if (nextState === 'Request Sent') {
      btn.innerHTML = 'Pending &bull; Cancel';
      btn.className = 'btn btn-sm btn-outline btn-connect-state';
    } else if (nextState === 'Connected') {
      btn.innerHTML = 'Connected &check;';
      btn.className = 'btn btn-sm btn-outline btn-connect-state';
    } else if (nextState === 'Not Connected') {
      btn.innerHTML = 'Connect';
      btn.className = 'btn btn-sm btn-primary btn-connect-state';
    }

    try {
      await ConnectionService.updateConnectionState(devId, nextState);
    } catch (err) {
      toastDanger('Failed to update connection. Reverting.');
      renderDevelopers();
    }
  });

  renderDevelopers();
}
