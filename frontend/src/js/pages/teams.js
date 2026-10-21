/**
 * DevSync Teams Controller
 * Restrained, clean developer workspace connecting to Django REST API
 */

import { TeamService } from '../services/team-service.js';
import { RepositoryService } from '../services/repository-service.js';
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

export async function initTeamsPage() {
  const memberTableBody = document.getElementById('teamMemberTableBody');
  const projectSquadsGrid = document.getElementById('projectSquadsGrid');
  const searchInput = document.getElementById('memberSearchInput');
  const topbarSearch = document.getElementById('topbarSearchInput');
  const projectFilter = document.getElementById('teamProjectFilter');
  const roleFilter = document.getElementById('teamRoleFilter');
  const btnShowAllSquads = document.getElementById('btnShowAllSquads');
  const filteredCountBadge = document.getElementById('filteredCountBadge');

  // Metrics
  const metricMemberCount = document.getElementById('metricMemberCount');
  const metricRepoCount = document.getElementById('metricRepoCount');
  const metricActiveToday = document.getElementById('metricActiveToday');
  const metricOpenAllocations = document.getElementById('metricOpenAllocations');

  // Modal elements
  const btnInvite = document.getElementById('btnInviteMember');
  const inviteModal = document.getElementById('inviteMemberModal');
  const closeInviteModalBtn = document.getElementById('closeInviteModalBtn');
  const cancelInviteBtn = document.getElementById('cancelInviteBtn');
  const inviteForm = document.getElementById('inviteMemberForm');
  const inviteProjectSelect = document.getElementById('inviteProjectSelect');
  const submitInviteBtn = document.getElementById('submitInviteBtn');

  const changeRoleModal = document.getElementById('changeRoleModal');
  const closeRoleModalBtn = document.getElementById('closeRoleModalBtn');
  const cancelRoleBtn = document.getElementById('cancelRoleBtn');
  const changeRoleForm = document.getElementById('changeRoleForm');
  const changeRoleMemberName = document.getElementById('changeRoleMemberName');
  const changeRoleProjectName = document.getElementById('changeRoleProjectName');
  const newRoleSelect = document.getElementById('newRoleSelect');

  const removeMemberModal = document.getElementById('removeMemberModal');
  const closeRemoveModalBtn = document.getElementById('closeRemoveModalBtn');
  const cancelRemoveBtn = document.getElementById('cancelRemoveBtn');
  const removeMemberName = document.getElementById('removeMemberName');
  const removeProjectName = document.getElementById('removeProjectName');
  const confirmRemoveBtn = document.getElementById('confirmRemoveBtn');

  let teams = [];
  let members = [];
  let activeProject = 'All Projects';
  let targetMemberForAction = null;
  let targetProjectForAction = null;

  async function loadData() {
    if (memberTableBody) {
      memberTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-6 text-secondary">
            <span class="btn-spinner"></span> Loading team members...
          </td>
        </tr>`;
    }

    try {
      const [teamsRes, membersRes] = await Promise.all([
        TeamService.getTeams(),
        TeamService.getMembers()
      ]);

      teams = Array.isArray(teamsRes) ? teamsRes : [];
      members = Array.isArray(membersRes) ? membersRes : [];

      updateMetrics();
      renderSquads();
      renderMembers();
      populateProjectDropdowns();
    } catch (err) {
      console.error('Error loading team data:', err);
      if (memberTableBody) {
        memberTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-6 text-danger">
              <p style="margin-bottom: 6px; font-weight: 600;">Failed to load collaborators</p>
              <button id="retryTeamsBtn" class="btn btn-outline btn-sm btn-pill">Retry</button>
            </td>
          </tr>`;
        const retryBtn = document.getElementById('retryTeamsBtn');
        if (retryBtn) retryBtn.onclick = loadData;
      }
    }
  }

  function updateMetrics() {
    if (metricMemberCount) metricMemberCount.textContent = members.length;
    if (metricRepoCount) metricRepoCount.textContent = teams.length;
    const onlineCount = members.filter(m => m.isOnline).length;
    if (metricActiveToday) metricActiveToday.textContent = onlineCount;
    if (metricOpenAllocations) metricOpenAllocations.textContent = '2';
  }

  function populateProjectDropdowns() {
    if (projectFilter && teams.length > 0) {
      const currentVal = projectFilter.value;
      projectFilter.innerHTML = '<option value="All Projects">All Projects</option>' +
        teams.map(t => `<option value="${escapeHtml(t.id || t.name)}">${escapeHtml(t.name || t.id)}</option>`).join('');
      if (currentVal) projectFilter.value = currentVal;
    }

    if (inviteProjectSelect && teams.length > 0) {
      inviteProjectSelect.innerHTML = teams.map(t =>
        `<option value="${escapeHtml(t.id || t.name)}">${escapeHtml(t.name || t.id)}</option>`
      ).join('');
    }
  }

  function renderSquads() {
    if (!projectSquadsGrid) return;

    if (teams.length === 0) {
      projectSquadsGrid.innerHTML = `<div class="text-secondary p-4">No team squads configured yet.</div>`;
      return;
    }

    projectSquadsGrid.innerHTML = teams.map(team => {
      const isSelected = activeProject === (team.id || team.name);
      const avatars = team.members ? team.members.slice(0, 4) : [];
      const memberCount = team.memberCount || (team.members ? team.members.length : 0);

      return `
        <div class="project-squad-card ${isSelected ? 'active-squad' : ''}" data-squad-id="${escapeHtml(team.id || team.name)}" style="${isSelected ? 'border-color: var(--color-primary-green); background: rgba(5, 150, 105, 0.03);' : ''}">
          <div>
            <div class="squad-card-top">
              <div class="squad-card-name">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                <span>${escapeHtml(team.name || team.id)}</span>
              </div>
              <span class="badge ${team.visibility === 'Public' ? 'badge-public' : 'badge-private'}">${escapeHtml(team.visibility || 'Private')}</span>
            </div>
            <div class="squad-card-owner mb-2">
              Owner: <strong>${escapeHtml(team.ownerName || team.owner || 'Maintainer')}</strong>
              ${team.language ? `&bull; <span class="badge badge-neutral" style="font-size: 10.5px;">${escapeHtml(team.language)}</span>` : ''}
            </div>
            <p class="squad-card-desc">${escapeHtml(team.description || 'Repository collaborative project workspace.')}</p>
          </div>
          <div class="squad-card-footer">
            <div class="squad-members-info">
              <div class="avatar-stack">
                ${avatars.map(av => `<img src="${av}" alt="Member" class="avatar-stack-item" style="border-radius: 50%; width: 22px; height: 22px; margin-left: -6px; border: 2px solid var(--color-surface);" />`).join('')}
              </div>
              <span class="text-secondary" style="font-size: 12px; font-weight: 500;">${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
            </div>
            <button class="btn btn-outline btn-sm btn-pill" style="font-size: 11px; padding: 2px 8px;">
              ${isSelected ? 'Active Filter' : 'Filter Squad'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire squad card clicks
    projectSquadsGrid.querySelectorAll('.project-squad-card').forEach(card => {
      card.addEventListener('click', () => {
        const squadId = card.getAttribute('data-squad-id');
        activeProject = (activeProject === squadId) ? 'All Projects' : squadId;
        if (projectFilter) projectFilter.value = activeProject;
        renderSquads();
        renderMembers();
      });
    });
  }

  function renderMembers() {
    if (!memberTableBody) return;

    const query = (searchInput ? searchInput.value.trim() : (topbarSearch ? topbarSearch.value.trim() : '')).toLowerCase();
    const role = roleFilter ? roleFilter.value : 'All Roles';

    const filtered = members.filter(m => {
      // 1. Text Search
      const name = (m.name || '').toLowerCase();
      const uname = (m.username || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const gRole = (m.globalRole || m.role || '').toLowerCase();
      const matchesQuery = !query || name.includes(query) || uname.includes(query) || email.includes(query) || gRole.includes(query);

      // 2. Project Filter
      let matchesProject = true;
      if (activeProject && activeProject !== 'All Projects') {
        const projRoles = m.projectRoles || {};
        matchesProject = Boolean(projRoles[activeProject]);
      }

      // 3. Role Filter
      let matchesRole = true;
      if (role && role !== 'All Roles') {
        const memberRole = (m.globalRole || m.role || '');
        matchesRole = memberRole.toLowerCase().includes(role.toLowerCase());
      }

      return matchesQuery && matchesProject && matchesRole;
    });

    if (filteredCountBadge) {
      filteredCountBadge.textContent = `${filtered.length} Member${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
      memberTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-6">
            <div class="empty-state" style="padding: 24px;">
              <div class="empty-state-title" style="font-size: 14.5px; font-weight: 700;">No collaborators match your filter</div>
              <div class="empty-state-desc text-secondary" style="font-size: 13px;">Try clearing search or selecting a different project squad.</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    memberTableBody.innerHTML = filtered.map(member => {
      const projectRoles = member.projectRoles || {};
      const projectEntries = Object.entries(projectRoles);
      const isOnline = Boolean(member.isOnline);
      const displayRole = member.globalRole || member.role || 'Contributor';

      const projectBadges = projectEntries.map(([proj, r]) => `
        <span class="badge badge-neutral" style="font-size: 11px; cursor: pointer;" title="${escapeHtml(r)}" data-filter-proj="${escapeHtml(proj)}">
          ${escapeHtml(proj)}: <strong style="color: var(--color-primary-green);">${escapeHtml(r)}</strong>
        </span>
      `).join(' ');

      return `
        <tr>
          <td>
            <div class="member-user-cell">
              <div style="position: relative; flex-shrink: 0;">
                <img src="${member.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'}" alt="${escapeHtml(member.name)}" class="member-avatar" />
                <span style="position: absolute; bottom: 0; right: 0; width: 9px; height: 9px; border-radius: 50%; background: ${isOnline ? 'var(--color-primary-green)' : '#9CA3AF'}; border: 1.5px solid var(--color-surface);"></span>
              </div>
              <div>
                <div class="member-name">${escapeHtml(member.name)}</div>
                <div class="text-secondary" style="font-size: 11.5px;">@${escapeHtml(member.username || '')} &bull; ${escapeHtml(member.email || '')}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge ${displayRole.includes('Owner') ? 'badge-primary' : (displayRole.includes('Lead') ? 'badge-success' : 'badge-neutral')}">
              ${escapeHtml(displayRole)}
            </span>
          </td>
          <td>
            <div class="d-flex align-items-center gap-1 flex-wrap">
              ${projectBadges || '<span class="text-secondary" style="font-size: 12px;">Unassigned</span>'}
            </div>
          </td>
          <td>
            <span class="stat-group">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${member.contributionsCount || 0}
            </span>
          </td>
          <td>
            <div class="d-flex align-items-center gap-1">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${isOnline ? 'var(--color-primary-green)' : '#9CA3AF'};"></span>
              <span class="text-secondary" style="font-size: 12px;">${isOnline ? 'Active Now' : 'Offline'}</span>
            </div>
          </td>
          <td style="text-align: right;">
            <div class="d-flex align-items-center justify-content-end gap-1">
              <button class="btn btn-outline btn-sm btn-pill action-change-role" data-username="${escapeHtml(member.username)}" data-name="${escapeHtml(member.name)}" style="font-size: 11px; padding: 2px 7px;" title="Update Role">
                Role
              </button>
              <button class="btn btn-outline btn-sm btn-pill text-danger action-remove-member" data-username="${escapeHtml(member.username)}" data-name="${escapeHtml(member.name)}" style="font-size: 11px; padding: 2px 7px;" title="Remove Member">
                &times;
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire badges click-to-filter
    memberTableBody.querySelectorAll('[data-filter-proj]').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = badge.getAttribute('data-filter-proj');
        if (p) {
          activeProject = p;
          if (projectFilter) projectFilter.value = p;
          renderSquads();
          renderMembers();
        }
      });
    });

    // Wire Change Role buttons
    memberTableBody.querySelectorAll('.action-change-role').forEach(btn => {
      btn.addEventListener('click', () => {
        const uname = btn.getAttribute('data-username');
        const name = btn.getAttribute('data-name');
        openChangeRoleModal(uname, name);
      });
    });

    // Wire Remove Member buttons
    memberTableBody.querySelectorAll('.action-remove-member').forEach(btn => {
      btn.addEventListener('click', () => {
        const uname = btn.getAttribute('data-username');
        const name = btn.getAttribute('data-name');
        openRemoveModal(uname, name);
      });
    });
  }

  // Filter Listeners
  if (searchInput) searchInput.addEventListener('input', debounce(renderMembers, 200));
  if (topbarSearch) topbarSearch.addEventListener('input', debounce(renderMembers, 200));
  if (projectFilter) {
    projectFilter.addEventListener('change', () => {
      activeProject = projectFilter.value;
      renderSquads();
      renderMembers();
    });
  }
  if (roleFilter) roleFilter.addEventListener('change', renderMembers);
  if (btnShowAllSquads) {
    btnShowAllSquads.addEventListener('click', () => {
      activeProject = 'All Projects';
      if (projectFilter) projectFilter.value = 'All Projects';
      renderSquads();
      renderMembers();
    });
  }

  // 1. Invite Member Modal Handlers
  function openInviteModal() {
    if (inviteModal) {
      inviteModal.style.display = 'flex';
      inviteModal.classList.add('show');
      document.body.style.overflow = 'hidden';
      const input = inviteModal.querySelector('input, select');
      if (input) input.focus();
    }
  }
  function closeInviteModal() {
    if (inviteModal) {
      inviteModal.classList.remove('show');
      inviteModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  if (btnInvite) btnInvite.addEventListener('click', openInviteModal);
  if (closeInviteModalBtn) closeInviteModalBtn.addEventListener('click', closeInviteModal);
  if (cancelInviteBtn) cancelInviteBtn.addEventListener('click', closeInviteModal);

  // Check URL query parameters for ?action=invite
  const teamUrlParams = new URLSearchParams(window.location.search);
  if (teamUrlParams.get('action') === 'invite') {
    setTimeout(openInviteModal, 150);
  }

  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const project = document.getElementById('inviteProjectSelect').value;
      const name = document.getElementById('inviteNameInput').value.trim();
      const email = document.getElementById('inviteEmailInput').value.trim();
      const role = document.getElementById('inviteRoleSelect').value;

      if (!name || !email) {
        toastDanger('Please enter name and valid email.');
        return;
      }

      if (submitInviteBtn) {
        submitInviteBtn.disabled = true;
        submitInviteBtn.innerHTML = '<span class="btn-spinner"></span> Inviting...';
      }

      try {
        await TeamService.inviteMember({
          project,
          name,
          email,
          role
        });
        toastSuccess(`Invitation sent to ${name} for ${project}!`, 'Member Invited');
        closeInviteModal();
        inviteForm.reset();
        loadData();
      } catch (err) {
        toastDanger(err.message || 'Failed to send team invitation.');
      } finally {
        if (submitInviteBtn) {
          submitInviteBtn.disabled = false;
          submitInviteBtn.innerHTML = 'Send Invitation &rarr;';
        }
      }
    });
  }

  // 2. Change Role Modal Handlers
  function openChangeRoleModal(username, name) {
    targetMemberForAction = username;
    targetProjectForAction = (activeProject !== 'All Projects') ? activeProject : 'devsync-core';
    if (changeRoleMemberName) changeRoleMemberName.textContent = name;
    if (changeRoleProjectName) changeRoleProjectName.textContent = targetProjectForAction;
    if (changeRoleModal) {
      changeRoleModal.style.display = 'flex';
      changeRoleModal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }
  function closeChangeRoleModal() {
    if (changeRoleModal) {
      changeRoleModal.classList.remove('show');
      changeRoleModal.style.display = 'none';
      document.body.style.overflow = '';
    }
    targetMemberForAction = null;
  }

  if (closeRoleModalBtn) closeRoleModalBtn.addEventListener('click', closeChangeRoleModal);
  if (cancelRoleBtn) cancelRoleBtn.addEventListener('click', closeChangeRoleModal);

  if (changeRoleForm) {
    changeRoleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!targetMemberForAction) return;
      const newRole = newRoleSelect ? newRoleSelect.value : 'Fullstack Developer';

      try {
        await TeamService.updateMember(targetMemberForAction, {
          role: newRole,
          project: targetProjectForAction
        });
        toastSuccess(`Updated ${targetMemberForAction}'s role to ${newRole}`, 'Role Updated');
        closeChangeRoleModal();
        loadData();
      } catch (err) {
        toastDanger(err.message || 'Failed to update member role.');
      }
    });
  }

  // 3. Remove Member Modal Handlers
  function openRemoveModal(username, name) {
    targetMemberForAction = username;
    targetProjectForAction = (activeProject !== 'All Projects') ? activeProject : null;
    if (removeMemberName) removeMemberName.textContent = name;
    if (removeProjectName) removeProjectName.textContent = targetProjectForAction || 'all squads';
    if (removeMemberModal) {
      removeMemberModal.style.display = 'flex';
      removeMemberModal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }
  function closeRemoveModal() {
    if (removeMemberModal) {
      removeMemberModal.classList.remove('show');
      removeMemberModal.style.display = 'none';
      document.body.style.overflow = '';
    }
    targetMemberForAction = null;
  }

  if (closeRemoveModalBtn) closeRemoveModalBtn.addEventListener('click', closeRemoveModal);
  if (cancelRemoveBtn) cancelRemoveBtn.addEventListener('click', closeRemoveModal);

  if (confirmRemoveBtn) {
    confirmRemoveBtn.addEventListener('click', async () => {
      if (!targetMemberForAction) return;
      confirmRemoveBtn.disabled = true;
      confirmRemoveBtn.innerHTML = '<span class="btn-spinner"></span> Removing...';

      try {
        await TeamService.removeMember(targetMemberForAction, targetProjectForAction);
        toastSuccess(`Collaborator removed successfully`, 'Collaborator Removed');
        closeRemoveModal();
        loadData();
      } catch (err) {
        toastDanger(err.message || 'Failed to remove collaborator.');
      } finally {
        confirmRemoveBtn.disabled = false;
        confirmRemoveBtn.innerHTML = 'Yes, Remove Collaborator';
      }
    });
  }

  // Initial Data Fetch
  loadData();
}
