/**
 * DevSync Teams Controller
 * Exact reproduction of Reference Image 1 Team Members UI
 */

import { TeamService } from '../services/team-service.js';
import { ModalManager } from '../core/modal-manager.js';
import { toastSuccess } from '../components/toast.js';

export async function initTeamsPage() {
  const memberTableBody = document.getElementById('teamMemberTableBody');

  async function renderMembers() {
    if (!memberTableBody) return;
    const members = await TeamService.getMembers();

    memberTableBody.innerHTML = members.map(m => `
      <tr>
        <td>
          <div class="member-user-cell">
            <img src="${m.avatar}" alt="${m.name}" class="member-avatar" />
            <span class="member-name">${m.name}</span>
          </div>
        </td>
        <td>
          <span class="badge ${m.role === 'Owner' ? 'badge-public' : 'badge-private'}">${m.role}</span>
        </td>
        <td>${m.repositoriesCount}</td>
        <td>${m.contributionsCount}</td>
        <td>
          <span class="status-indicator ${m.isOnline ? 'online' : 'offline'}">
            ${m.isOnline ? 'Online' : 'Offline'}
          </span>
        </td>
        <td class="text-secondary">${m.joined}</td>
        <td>
          <button class="row-action-btn" title="Manage member">&bull;&bull;&bull;</button>
        </td>
      </tr>
    `).join('');
  }

  renderMembers();

  // Invite member trigger
  document.getElementById('btnInviteMember')?.addEventListener('click', () => {
    ModalManager.open('inviteTeamModal');
  });

  const inviteForm = document.getElementById('inviteTeamForm');
  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = inviteForm.querySelector('#inviteEmail').value;
      const role = inviteForm.querySelector('#inviteRole').value;
      await TeamService.inviteMember({ email, role });
      ModalManager.close('inviteTeamModal');
      toastSuccess(`Invitation sent to ${email}!`, 'Member Invited');
      inviteForm.reset();
      renderMembers();
    });
  }
}
