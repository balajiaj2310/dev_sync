/**
 * DevSync Teams Controller
 * Full Project-Based Team Allocation, Member Count, and Project Owner Authority System
 */

import { ROUTES } from '../core/route-config.js';
import { toastSuccess, toastDanger, toastInfo } from '../components/toast.js';

// Default Projects
export const DEFAULT_PROJECTS = [
  {
    id: 'devsync-core',
    name: 'devsync-core',
    title: 'DevSync Core Platform',
    description: 'Core backend services, authentication API, and real-time collaboration engine.',
    ownerUsername: 'Balajikumar',
    ownerName: 'Balaji',
    language: 'Python',
    visibility: 'Private'
  },
  {
    id: 'campus-connect',
    name: 'campus-connect',
    title: 'Campus Connect',
    description: 'Student community engagement portal and academic collaboration suite.',
    ownerUsername: 'naveen3438',
    ownerName: 'Naveen Kumar D',
    language: 'Django',
    visibility: 'Public'
  },
  {
    id: 'ai-tools',
    name: 'ai-tools',
    title: 'AI Coding Assistant',
    description: 'Autonomous multi-file refactoring, diff generation, and agentic workflows.',
    ownerUsername: 'Balajikumar',
    ownerName: 'Balaji',
    language: 'TypeScript',
    visibility: 'Private'
  },
  {
    id: 'chaturya-club',
    name: 'chaturya-club',
    title: 'Chaturya Tech Club',
    description: 'Event registration portals, club activities, and student project showcases.',
    ownerUsername: 'naveen3438',
    ownerName: 'Naveen Kumar D',
    language: 'Flask',
    visibility: 'Public'
  },
  {
    id: 'heavy-machinery',
    name: 'heavy-machinery',
    title: 'Heavy Machinery DevOps',
    description: 'Automated deployment pipelines, telemetry monitors, and cloud infrastructure.',
    ownerUsername: 'Balajikumar',
    ownerName: 'Balaji',
    language: 'Python',
    visibility: 'Private'
  }
];

// Default Team Members & Project Allocation
export const DEFAULT_MEMBERS = [
  {
    id: 'member-naveen',
    name: 'Naveen Kumar D',
    username: 'naveen3438',
    email: 'naveen@devsync.dev',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
    globalRole: 'Lead Maintainer',
    contributionsCount: 248,
    isOnline: true,
    joined: 'Jan 2024',
    projectRoles: {
      'devsync-core': 'Lead Maintainer',
      'campus-connect': 'Owner',
      'ai-tools': 'Lead Maintainer',
      'chaturya-club': 'Owner'
    }
  },
  {
    id: 'member-balaji',
    name: 'Balaji',
    username: 'Balajikumar',
    email: 'balaji@devsync.dev',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80',
    globalRole: 'Owner',
    contributionsCount: 245,
    isOnline: true,
    joined: 'Jan 2024',
    projectRoles: {
      'devsync-core': 'Owner',
      'ai-tools': 'Owner',
      'heavy-machinery': 'Owner'
    }
  },
  {
    id: 'member-priya',
    name: 'Priya S',
    username: 'priyas',
    email: 'priya@devsync.dev',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
    globalRole: 'Fullstack Developer',
    contributionsCount: 132,
    isOnline: true,
    joined: 'Feb 2024',
    projectRoles: {
      'devsync-core': 'Fullstack Developer',
      'campus-connect': 'Fullstack Developer',
      'chaturya-club': 'Fullstack Developer'
    }
  },
  {
    id: 'member-arjun',
    name: 'Arjun',
    username: 'arjun',
    email: 'arjun@devsync.dev',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
    globalRole: 'Frontend Developer',
    contributionsCount: 98,
    isOnline: false,
    joined: 'Mar 2024',
    projectRoles: {
      'campus-connect': 'Frontend Developer',
      'ai-tools': 'Frontend Developer'
    }
  },
  {
    id: 'member-sneha',
    name: 'Sneha',
    username: 'sneha',
    email: 'sneha@devsync.dev',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80',
    globalRole: 'Backend Developer',
    contributionsCount: 76,
    isOnline: true,
    joined: 'Mar 2024',
    projectRoles: {
      'devsync-core': 'Backend Developer',
      'chaturya-club': 'Backend Developer'
    }
  },
  {
    id: 'member-karthik',
    name: 'Karthik',
    username: 'karthik',
    email: 'karthik@devsync.dev',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
    globalRole: 'Systems Developer',
    contributionsCount: 114,
    isOnline: true,
    joined: 'Apr 2024',
    projectRoles: {
      'campus-connect': 'Systems Developer',
      'heavy-machinery': 'Systems Developer'
    }
  },
  {
    id: 'member-rohan',
    name: 'Rohan',
    username: 'rohan',
    email: 'rohan@devsync.dev',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=80&q=80',
    globalRole: 'UI/UX Designer',
    contributionsCount: 52,
    isOnline: false,
    joined: 'May 2024',
    projectRoles: {
      'campus-connect': 'UI/UX Designer',
      'chaturya-club': 'UI/UX Designer'
    }
  }
];

// Registered Developers available to be added to projects
export const REGISTERED_CANDIDATES = [
  {
    name: 'Ananya Roy',
    username: 'ananyaroy',
    email: 'ananya@devsync.dev',
    role: 'Data Scientist',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'
  },
  {
    name: 'Vikram Rao',
    username: 'vikramrao',
    email: 'vikram@devsync.dev',
    role: 'DevOps Specialist',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80'
  },
  {
    name: 'Tara Patel',
    username: 'tarapatel',
    email: 'tara@devsync.dev',
    role: 'Mobile Developer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80'
  },
  {
    name: 'Rahul Dev',
    username: 'rahuldev',
    email: 'rahul@devsync.dev',
    role: 'Systems Developer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80'
  },
  {
    name: 'Aarav Mehta',
    username: 'aaravmehta',
    email: 'aarav@devsync.dev',
    role: 'Cloud Architect',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=80&q=80'
  }
];

const STORAGE_KEY = 'devsync_teams_store_v2';

// State Management
class TeamsStore {
  constructor() {
    this.projects = DEFAULT_PROJECTS;
    this.members = DEFAULT_MEMBERS;
    this.activeProjectId = 'all'; // 'all' or projectId
    this.activePersona = 'Balajikumar'; // Default viewing as Balaji (Owner)
    this.searchQuery = '';
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.projects && parsed.projects.length) this.projects = parsed.projects;
        if (parsed.members && parsed.members.length) this.members = parsed.members;
        if (parsed.activePersona) this.activePersona = parsed.activePersona;
      }
    } catch (e) {
      console.warn('Failed to parse teams store from localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        projects: this.projects,
        members: this.members,
        activePersona: this.activePersona
      }));
    } catch (e) {
      console.error('Failed to save teams store to localStorage:', e);
    }
  }

  getProject(projectId) {
    return this.projects.find(p => p.id === projectId);
  }

  getProjectMembers(projectId) {
    if (projectId === 'all') {
      return [...this.members];
    }
    return this.members.filter(m => m.projectRoles && m.projectRoles[projectId]);
  }

  getProjectMemberCount(projectId) {
    if (projectId === 'all') {
      return this.members.length;
    }
    return this.members.filter(m => m.projectRoles && m.projectRoles[projectId]).length;
  }

  isProjectOwner(projectId, username) {
    if (!username) return false;
    const u = username.toLowerCase();
    if (projectId === 'all') {
      // In all view, user is owner if they own any project
      return this.projects.some(p => p.ownerUsername.toLowerCase() === u);
    }
    const project = this.getProject(projectId);
    return project && project.ownerUsername.toLowerCase() === u;
  }

  addMemberToProject(projectId, memberData, role) {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!this.isProjectOwner(projectId, this.activePersona)) {
      throw new Error(`Access Denied: Only the project owner (${project.ownerName}) has the authority to add people to ${project.name}.`);
    }

    const username = (memberData.username || memberData.name.toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
    let member = this.members.find(m => m.username.toLowerCase() === username);

    if (member) {
      member.projectRoles = member.projectRoles || {};
      member.projectRoles[projectId] = role;
    } else {
      member = {
        id: `member-${Date.now()}`,
        name: memberData.name || 'New Contributor',
        username: username,
        email: memberData.email || `${username}@devsync.dev`,
        avatar: memberData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80',
        globalRole: role,
        contributionsCount: 1,
        isOnline: true,
        joined: 'Just now',
        projectRoles: {
          [projectId]: role
        }
      };
      this.members.push(member);
    }

    this.saveToStorage();
    return member;
  }

  changeRole(projectId, username, newRole) {
    const project = this.getProject(projectId);
    if (projectId !== 'all' && !project) {
      throw new Error('Project not found');
    }

    const checkProject = projectId === 'all' ? 'devsync-core' : projectId;
    const targetProject = this.getProject(checkProject);

    if (!this.isProjectOwner(checkProject, this.activePersona)) {
      throw new Error(`Access Denied: Only the project owner (${targetProject.ownerName}) has the authority to assign or change roles in ${targetProject.name}.`);
    }

    const member = this.members.find(m => m.username.toLowerCase() === username.toLowerCase());
    if (!member) {
      throw new Error('Member not found');
    }

    if (projectId === 'all') {
      member.globalRole = newRole;
      // Also update any projects where they have a role
      Object.keys(member.projectRoles || {}).forEach(pId => {
        if (this.isProjectOwner(pId, this.activePersona)) {
          member.projectRoles[pId] = newRole;
        }
      });
    } else {
      member.projectRoles = member.projectRoles || {};
      member.projectRoles[projectId] = newRole;
    }

    this.saveToStorage();
    return member;
  }

  removeMemberFromProject(projectId, username) {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.ownerUsername.toLowerCase() === username.toLowerCase()) {
      throw new Error(`Cannot remove ${project.ownerName}: The owner cannot be removed from their own project.`);
    }

    if (!this.isProjectOwner(projectId, this.activePersona)) {
      throw new Error(`Access Denied: Only the project owner (${project.ownerName}) has authority to remove people from ${project.name}.`);
    }

    const member = this.members.find(m => m.username.toLowerCase() === username.toLowerCase());
    if (!member) {
      throw new Error('Member not found');
    }

    if (member.projectRoles) {
      delete member.projectRoles[projectId];
    }

    // If member has no more projects, keep in team or keep profile
    this.saveToStorage();
    return true;
  }

  resetDefaults() {
    this.projects = JSON.parse(JSON.stringify(DEFAULT_PROJECTS));
    this.members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
    this.activeProjectId = 'all';
    this.activePersona = 'Balajikumar';
    this.saveToStorage();
  }
}

// Global Single Instance
export const store = new TeamsStore();

// Utility for role badge color
export function getRoleBadgeClass(role = '') {
  const r = role.toLowerCase();
  if (r.includes('owner')) return 'role-badge-owner';
  if (r.includes('lead')) return 'role-badge-lead';
  if (r.includes('fullstack')) return 'role-badge-fullstack';
  if (r.includes('frontend')) return 'role-badge-frontend';
  if (r.includes('backend')) return 'role-badge-backend';
  if (r.includes('system')) return 'role-badge-systems';
  if (r.includes('design') || r.includes('ui')) return 'role-badge-designer';
  if (r.includes('devops') || r.includes('cloud')) return 'role-badge-devops';
  return 'role-badge-contributor';
}

let isTeamsPageInitialized = false;

// Controller Initialization
export function initTeamsPage() {
  if (isTeamsPageInitialized) return;
  isTeamsPageInitialized = true;

  const tableBody = document.getElementById('teamMemberTableBody');
  const projectTabsContainer = document.getElementById('projectFilterTabs');
  const projectContextBanner = document.getElementById('projectContextBanner');
  const projectSquadsGrid = document.getElementById('projectSquadsGrid');
  const projectSquadsContainer = document.getElementById('projectSquadsContainer');
  const searchInput = document.getElementById('memberSearchInput');
  const personaSelect = document.getElementById('personaSelect');
  const personaAvatar = document.getElementById('personaAvatar');
  const btnInvite = document.getElementById('btnInviteMember');
  const filteredBadge = document.getElementById('filteredCountBadge');
  const metricMemberCount = document.getElementById('metricMemberCount');
  const metricActiveToday = document.getElementById('metricActiveToday');
  const metricRepoCount = document.getElementById('metricRepoCount');

  // Modals
  const addMemberModal = document.getElementById('addMemberModal');
  const addMemberForm = document.getElementById('addMemberForm');
  const changeRoleModal = document.getElementById('changeRoleModal');
  const changeRoleForm = document.getElementById('changeRoleForm');
  const removeMemberModal = document.getElementById('removeMemberModal');
  const confirmRemoveBtn = document.getElementById('confirmRemoveBtn');

  // Target member tracking for modals
  let roleChangeTarget = { username: '', projectId: '', memberName: '' };
  let removeTarget = { username: '', projectId: '', memberName: '' };

  function renderMetrics() {
    const totalMembers = store.members.length;
    const activeCount = store.members.filter(m => m.isOnline).length;
    const repoCount = store.projects.length;

    if (metricMemberCount) metricMemberCount.textContent = totalMembers;
    if (metricActiveToday) metricActiveToday.textContent = activeCount;
    if (metricRepoCount) metricRepoCount.textContent = repoCount;
  }

  function renderProjectTabs() {
    if (!projectTabsContainer) return;

    const totalCount = store.members.length;

    let html = `
      <button class="project-tab-btn ${store.activeProjectId === 'all' ? 'active' : ''}" data-project-id="all">
        <span>All Projects</span>
        <span class="tab-count">${totalCount} members</span>
      </button>
    `;

    store.projects.forEach(p => {
      const count = store.getProjectMemberCount(p.id);
      const isOwner = store.isProjectOwner(p.id, store.activePersona);
      html += `
        <button class="project-tab-btn ${store.activeProjectId === p.id ? 'active' : ''}" data-project-id="${p.id}" title="${p.title} • Owner: ${p.ownerName}">
          ${isOwner ? '<span title="You are the owner of this project">👑</span>' : ''}
          <span>${p.name}</span>
          <span class="tab-count">${count} members</span>
        </button>
      `;
    });

    projectTabsContainer.innerHTML = html;

    projectTabsContainer.querySelectorAll('.project-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        store.activeProjectId = btn.getAttribute('data-project-id');
        renderAll();
      });
    });
  }

  function renderContextBanner() {
    if (!projectContextBanner) return;

    if (store.activeProjectId === 'all') {
      projectContextBanner.style.display = 'none';
      if (projectSquadsContainer) projectSquadsContainer.style.display = 'block';
      renderSquadsCards();
      return;
    }

    projectContextBanner.style.display = 'flex';
    if (projectSquadsContainer) projectSquadsContainer.style.display = 'none';

    const project = store.getProject(store.activeProjectId);
    if (!project) return;

    const memberCount = store.getProjectMemberCount(project.id);
    const isOwner = store.isProjectOwner(project.id, store.activePersona);

    const bannerTitle = document.getElementById('projectBannerTitle');
    const bannerDesc = document.getElementById('projectBannerDesc');
    const bannerOwner = document.getElementById('projectBannerOwner');
    const bannerCount = document.getElementById('projectMemberCountBadge');
    const bannerAuthority = document.getElementById('ownerAuthorityBadge');

    if (bannerTitle) {
      bannerTitle.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        ${project.name}
        <span class="badge ${project.visibility === 'Public' ? 'badge-public' : 'badge-private'}" style="font-size: 11px; margin-left: 6px;">${project.visibility}</span>
      `;
    }

    if (bannerDesc) bannerDesc.textContent = project.description;
    if (bannerOwner) bannerOwner.textContent = `${project.ownerName} (@${project.ownerUsername})`;
    if (bannerCount) bannerCount.textContent = `${memberCount} Collaborators`;

    if (bannerAuthority) {
      if (isOwner) {
        bannerAuthority.className = 'project-meta-pill authority-pill-active';
        bannerAuthority.innerHTML = `
          <span>👑</span>
          <span><strong>Owner Authority:</strong> You own this project. You have authority to assign roles, add, & remove collaborators.</span>
        `;
      } else {
        bannerAuthority.className = 'project-meta-pill authority-pill-restricted';
        bannerAuthority.innerHTML = `
          <span>🔒</span>
          <span><strong>View Only:</strong> Only project owner (${project.ownerName}) can assign roles, add, or remove collaborators.</span>
        `;
      }
    }
  }

  function renderSquadsCards() {
    if (!projectSquadsGrid) return;

    let html = '';
    store.projects.forEach(p => {
      const members = store.getProjectMembers(p.id);
      const isOwner = store.isProjectOwner(p.id, store.activePersona);

      const avatarStack = members.slice(0, 4).map(m => `
        <img src="${m.avatar}" alt="${m.name}" title="${m.name} (${m.projectRoles[p.id]})" class="avatar-stack-item" />
      `).join('');

      const moreCount = members.length > 4 ? `+${members.length - 4}` : '';

      html += `
        <div class="project-squad-card" data-project-id="${p.id}">
          <div>
            <div class="squad-card-top">
              <div>
                <div class="squad-card-name">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  ${p.name}
                  ${isOwner ? '<span title="You own this project" style="font-size: 13px;">👑</span>' : ''}
                </div>
                <div class="squad-card-owner">Project Owner: <strong>${p.ownerName}</strong></div>
              </div>
              <span class="badge ${p.visibility === 'Public' ? 'badge-public' : 'badge-private'}" style="font-size: 10px;">${p.language}</span>
            </div>
            <p class="squad-card-desc">${p.description}</p>
          </div>
          <div class="squad-card-footer">
            <div class="squad-members-info">
              <div class="avatar-stack">
                ${avatarStack}
              </div>
              <span class="squad-count-badge">${members.length} ${members.length === 1 ? 'member' : 'members'}</span>
              ${moreCount ? `<span class="text-secondary" style="font-size: 11px;">${moreCount}</span>` : ''}
            </div>
            <span class="text-primary" style="font-size: 12px; font-weight: 600; text-decoration: none;">View Squad &rarr;</span>
          </div>
        </div>
      `;
    });

    projectSquadsGrid.innerHTML = html;

    projectSquadsGrid.querySelectorAll('.project-squad-card').forEach(card => {
      card.addEventListener('click', () => {
        store.activeProjectId = card.getAttribute('data-project-id');
        renderAll();
      });
    });
  }

  function renderTable() {
    if (!tableBody) return;

    let members = store.getProjectMembers(store.activeProjectId);

    if (store.searchQuery) {
      const q = store.searchQuery.toLowerCase();
      members = members.filter(m => {
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const userMatch = (m.username || '').toLowerCase().includes(q);
        const roleMatch = (m.globalRole || '').toLowerCase().includes(q);
        const projectsMatch = Object.keys(m.projectRoles || {}).some(pid => pid.toLowerCase().includes(q));
        return nameMatch || userMatch || roleMatch || projectsMatch;
      });
    }

    if (filteredBadge) {
      const label = store.activeProjectId === 'all' ? 'All Squad' : store.getProject(store.activeProjectId)?.name;
      filteredBadge.textContent = `${members.length} Members in ${label}`;
    }

    if (members.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--color-text-secondary);">
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px;">No collaborators found</div>
            <p style="font-size: 13px; margin: 0;">Try adjusting your search or add a team member to this project.</p>
          </td>
        </tr>
      `;
      return;
    }

    const currentProjectId = store.activeProjectId;
    const activeProject = currentProjectId !== 'all' ? store.getProject(currentProjectId) : null;
    const isOwnerOfCurrentProject = currentProjectId !== 'all' ? store.isProjectOwner(currentProjectId, store.activePersona) : false;

    tableBody.innerHTML = members.map(m => {
      // Determine role in current context
      let displayRole = m.globalRole;
      let effectiveProjectId = currentProjectId;

      if (currentProjectId !== 'all') {
        displayRole = m.projectRoles[currentProjectId] || m.globalRole;
      }

      const roleBadgeClass = getRoleBadgeClass(displayRole);

      // Projects working on pills
      const projectKeys = Object.keys(m.projectRoles || {});
      const projectPills = projectKeys.map(pKey => {
        const roleInThisProj = m.projectRoles[pKey];
        const isActiveThis = pKey === currentProjectId;
        return `
          <button class="project-tag-pill ${isActiveThis ? 'active-filter' : ''}" data-nav-project="${pKey}" title="${pKey} • Role: ${roleInThisProj}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>${pKey}</span>
            <span class="tag-role">${roleInThisProj}</span>
          </button>
        `;
      }).join('');

      // Owner authority permissions for this row
      const isRowMemberOwnerOfThisProj = activeProject && activeProject.ownerUsername.toLowerCase() === m.username.toLowerCase();
      const canManageRole = isOwnerOfCurrentProject || (currentProjectId === 'all' && store.isProjectOwner('devsync-core', store.activePersona));
      const canRemove = isOwnerOfCurrentProject && !isRowMemberOwnerOfThisProj;

      return `
        <tr data-member-username="${m.username}">
          <td>
            <a href="${ROUTES.DEVELOPER_PROFILE}?user=${encodeURIComponent(m.username)}" class="member-user-cell" style="text-decoration: none; color: inherit;">
              <img src="${m.avatar}" alt="${m.name}" class="member-avatar" />
              <div>
                <div class="member-name">
                  ${m.name}
                  ${displayRole === 'Owner' || isRowMemberOwnerOfThisProj ? '<span class="member-you-badge" style="color: #B45309; font-weight: 600;">(Owner)</span>' : ''}
                  ${m.username.toLowerCase() === store.activePersona.toLowerCase() ? '<span class="member-you-badge">(You)</span>' : ''}
                </div>
                <div class="text-secondary" style="font-size: 11.5px;">@${m.username}</div>
              </div>
            </a>
          </td>
          <td>
            <div class="role-badge-wrapper">
              <span class="role-badge ${roleBadgeClass}">${displayRole}</span>
              ${canManageRole ? `
                <button class="btn-change-role-icon btn-open-role-modal" data-username="${m.username}" data-name="${m.name}" data-current-role="${displayRole}" title="Owner Authority: Change Role in this project">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
              ` : ''}
            </div>
          </td>
          <td>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 320px;">
              ${projectPills || '<span class="text-secondary" style="font-size: 12px;">No active projects</span>'}
            </div>
          </td>
          <td><strong>${m.contributionsCount}</strong></td>
          <td>
            <span class="status-indicator ${m.isOnline ? 'online' : 'offline'}">
              ${m.isOnline ? 'Online' : 'Offline'}
            </span>
          </td>
          <td class="text-secondary" style="font-size: 12.5px;">${m.joined}</td>
          <td class="action-cell">
            <button class="row-action-btn btn-table-menu-toggle" data-username="${m.username}" title="Manage member actions">&bull;&bull;&bull;</button>
            <div class="table-action-menu" id="menu-${m.username}">
              <a href="${ROUTES.DEVELOPER_PROFILE}?user=${encodeURIComponent(m.username)}" class="table-action-menu-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                View Profile
              </a>
              ${canManageRole ? `
                <button type="button" class="table-action-menu-item btn-open-role-modal" data-username="${m.username}" data-name="${m.name}" data-current-role="${displayRole}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
                  Assign / Change Role
                </button>
              ` : `
                <button type="button" class="table-action-menu-item" disabled style="opacity: 0.5; cursor: not-allowed;" title="Only project owner has authority to assign roles">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Role (Owner Only)
                </button>
              `}
              ${canRemove ? `
                <div class="table-action-menu-divider"></div>
                <button type="button" class="table-action-menu-item text-danger btn-open-remove-modal" data-username="${m.username}" data-name="${m.name}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Remove from Project
                </button>
              ` : isRowMemberOwnerOfThisProj ? `
                <div class="table-action-menu-divider"></div>
                <div style="padding: 6px 14px; font-size: 11px; color: var(--color-text-secondary);">Project Owner (Cannot remove)</div>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners for row actions
    tableBody.querySelectorAll('[data-nav-project]').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        store.activeProjectId = pill.getAttribute('data-nav-project');
        renderAll();
      });
    });

    // Toggle row action menu
    tableBody.querySelectorAll('.btn-table-menu-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const username = btn.getAttribute('data-username');
        const menu = document.getElementById(`menu-${username}`);
        const allMenus = document.querySelectorAll('.table-action-menu');
        allMenus.forEach(m => {
          if (m !== menu) m.classList.remove('show');
        });
        if (menu) menu.classList.toggle('show');
      });
    });

    // Change role buttons
    tableBody.querySelectorAll('.btn-open-role-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllActionMenus();
        const username = btn.getAttribute('data-username');
        const name = btn.getAttribute('data-name');
        const currentRole = btn.getAttribute('data-current-role');
        openChangeRoleModal(username, name, currentRole);
      });
    });

    // Remove buttons
    tableBody.querySelectorAll('.btn-open-remove-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllActionMenus();
        const username = btn.getAttribute('data-username');
        const name = btn.getAttribute('data-name');
        openRemoveModal(username, name);
      });
    });
  }

  function closeAllActionMenus() {
    document.querySelectorAll('.table-action-menu').forEach(m => m.classList.remove('show'));
  }

  document.addEventListener('click', () => {
    closeAllActionMenus();
  });

  // Modal Openers
  function openAddMemberModal() {
    if (!addMemberModal) return;

    // Check authority if a specific project is selected
    if (store.activeProjectId !== 'all') {
      const proj = store.getProject(store.activeProjectId);
      if (!store.isProjectOwner(store.activeProjectId, store.activePersona)) {
        toastDanger(`Access Denied: Only ${proj.ownerName} (the project owner) has the authority to add people to ${proj.name}.`, 'Owner Authority Required');
        return;
      }
    }

    // Populate Project Select
    const projectSelect = document.getElementById('modalProjectSelect');
    if (projectSelect) {
      projectSelect.innerHTML = store.projects.map(p => {
        const isOwner = store.isProjectOwner(p.id, store.activePersona);
        return `
          <option value="${p.id}" ${store.activeProjectId === p.id ? 'selected' : ''}>
            ${p.name} (${p.ownerName} Owner) ${isOwner ? '👑 (You own)' : ''}
          </option>
        `;
      }).join('');
    }

    // Populate Developer Select
    const devSelect = document.getElementById('modalCandidateSelect');
    if (devSelect) {
      // Show registered devs not yet in selected project
      devSelect.innerHTML = `
        <option value="">-- Choose from Registered Developers --</option>
        ${REGISTERED_CANDIDATES.map(c => `
          <option value="${c.username}" data-name="${c.name}" data-role="${c.role}" data-email="${c.email}" data-avatar="${c.avatar}">
            ${c.name} (@${c.username}) — ${c.role}
          </option>
        `).join('')}
        ${store.members.map(m => `
          <option value="${m.username}" data-name="${m.name}" data-role="${m.globalRole}" data-email="${m.email}" data-avatar="${m.avatar}">
            ${m.name} (@${m.username}) — Current Team
          </option>
        `).join('')}
      `;
    }

    addMemberModal.style.display = 'flex';
    addMemberModal.classList.add('show');
  }

  function openChangeRoleModal(username, name, currentRole) {
    if (!changeRoleModal) return;

    const projectId = store.activeProjectId === 'all' ? 'devsync-core' : store.activeProjectId;
    const proj = store.getProject(projectId);

    if (!store.isProjectOwner(projectId, store.activePersona)) {
      toastDanger(`Access Denied: Only ${proj.ownerName} (the project owner) has authority to assign roles in ${proj.name}.`, 'Owner Authority Required');
      return;
    }

    roleChangeTarget = { username, projectId, memberName: name };

    const modalNameEl = document.getElementById('changeRoleMemberName');
    const modalProjEl = document.getElementById('changeRoleProjectName');
    const selectRoleEl = document.getElementById('newRoleSelect');

    if (modalNameEl) modalNameEl.textContent = name;
    if (modalProjEl) modalProjEl.textContent = proj.name;
    if (selectRoleEl) {
      for (let i = 0; i < selectRoleEl.options.length; i++) {
        if (selectRoleEl.options[i].value === currentRole) {
          selectRoleEl.selectedIndex = i;
          break;
        }
      }
    }

    changeRoleModal.style.display = 'flex';
    changeRoleModal.classList.add('show');
  }

  function openRemoveModal(username, name) {
    if (!removeMemberModal) return;

    const projectId = store.activeProjectId === 'all' ? 'devsync-core' : store.activeProjectId;
    const proj = store.getProject(projectId);

    if (!store.isProjectOwner(projectId, store.activePersona)) {
      toastDanger(`Access Denied: Only ${proj.ownerName} (the project owner) has authority to remove people from ${proj.name}.`, 'Owner Authority Required');
      return;
    }

    removeTarget = { username, projectId, memberName: name };

    const modalNameEl = document.getElementById('removeMemberName');
    const modalProjEl = document.getElementById('removeProjectName');

    if (modalNameEl) modalNameEl.textContent = name;
    if (modalProjEl) modalProjEl.textContent = proj.name;

    removeMemberModal.style.display = 'flex';
    removeMemberModal.classList.add('show');
  }

  function closeModal(modal) {
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('show');
    }
  }

  // Bind Modals & Forms
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(addMemberModal);
      closeModal(changeRoleModal);
      closeModal(removeMemberModal);
    });
  });

  if (btnInvite) {
    btnInvite.addEventListener('click', openAddMemberModal);
  }

  // Developer Candidate selection auto-fills name/email
  const candidateSelect = document.getElementById('modalCandidateSelect');
  if (candidateSelect) {
    candidateSelect.addEventListener('change', () => {
      const selectedOpt = candidateSelect.options[candidateSelect.selectedIndex];
      const nameInput = document.getElementById('addMemberNameInput');
      const emailInput = document.getElementById('addMemberEmailInput');
      const roleSelect = document.getElementById('addMemberRoleSelect');

      if (selectedOpt && selectedOpt.value) {
        if (nameInput) nameInput.value = selectedOpt.getAttribute('data-name') || '';
        if (emailInput) emailInput.value = selectedOpt.getAttribute('data-email') || '';
        const suggestedRole = selectedOpt.getAttribute('data-role');
        if (suggestedRole && roleSelect) {
          for (let i = 0; i < roleSelect.options.length; i++) {
            if (roleSelect.options[i].value === suggestedRole) {
              roleSelect.selectedIndex = i;
              break;
            }
          }
        }
      }
    });
  }

  // Handle Add Member Submit
  if (addMemberForm) {
    addMemberForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const projId = document.getElementById('modalProjectSelect').value;
      const candVal = document.getElementById('modalCandidateSelect')?.value;
      const name = document.getElementById('addMemberNameInput').value.trim();
      const email = document.getElementById('addMemberEmailInput').value.trim();
      const role = document.getElementById('addMemberRoleSelect').value;

      try {
        const username = candVal || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const cand = REGISTERED_CANDIDATES.find(c => c.username === candVal);
        const avatar = cand?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80';

        store.addMemberToProject(projId, { name, username, email, avatar }, role);
        closeModal(addMemberModal);
        addMemberForm.reset();
        renderAll();
        toastSuccess(`Successfully added ${name} as ${role} to ${projId}!`, 'Collaborator Added');
      } catch (err) {
        toastDanger(err.message, 'Authority Error');
      }
    });
  }

  // Handle Change Role Submit
  if (changeRoleForm) {
    changeRoleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newRole = document.getElementById('newRoleSelect').value;
      try {
        store.changeRole(roleChangeTarget.projectId, roleChangeTarget.username, newRole);
        closeModal(changeRoleModal);
        renderAll();
        toastSuccess(`Updated role for ${roleChangeTarget.memberName} to "${newRole}" in ${roleChangeTarget.projectId}!`, 'Role Assigned');
      } catch (err) {
        toastDanger(err.message, 'Authority Error');
      }
    });
  }

  // Handle Remove Member Submit
  if (confirmRemoveBtn) {
    confirmRemoveBtn.addEventListener('click', () => {
      try {
        store.removeMemberFromProject(removeTarget.projectId, removeTarget.username);
        closeModal(removeMemberModal);
        renderAll();
        toastSuccess(`Removed ${removeTarget.memberName} from ${removeTarget.projectId}.`, 'Collaborator Removed');
      } catch (err) {
        toastDanger(err.message, 'Authority Error');
      }
    });
  }

  // Persona Switcher Handler
  if (personaSelect) {
    personaSelect.value = store.activePersona;
    personaSelect.addEventListener('change', () => {
      store.activePersona = personaSelect.value;
      store.saveToStorage();

      // Update persona avatar
      const persona = store.members.find(m => m.username.toLowerCase() === store.activePersona.toLowerCase());
      if (persona && personaAvatar) {
        personaAvatar.src = persona.avatar;
      }

      toastInfo(`Now viewing as ${persona ? persona.name : store.activePersona}. Owner permissions updated for projects they own.`, 'Persona Switched');
      renderAll();
    });
  }

  // Live search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      store.searchQuery = (e.target.value || '').trim();
      renderTable();
    });
  }

  // Reset to Defaults Trigger
  const btnResetDefaults = document.getElementById('btnResetTeamDefaults');
  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Reset team projects and member allocations back to initial defaults?')) {
        store.resetDefaults();
        renderAll();
        toastInfo('Team data has been reset to defaults.', 'Reset Complete');
      }
    });
  }

  function renderAll() {
    renderMetrics();
    renderProjectTabs();
    renderContextBanner();
    renderTable();
  }

  renderAll();
}
