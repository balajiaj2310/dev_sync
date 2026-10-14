/**
 * DevSync Mock API Adapter
 * Simulates asynchronous backend operations with in-memory state persistence
 */

import { INITIAL_MOCK_DATA } from './mock-data.js';

// Load persistent mock store from localStorage if available
function loadStore() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('devsync_mock_store');
      if (saved) return JSON.parse(saved);
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(INITIAL_MOCK_DATA));
}

let mockStore = loadStore();

export function saveStore() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('devsync_mock_store', JSON.stringify(mockStore));
    }
  } catch (e) {}
}

const delay = (ms = 180) => new Promise(resolve => setTimeout(resolve, ms));

export const MockAPI = {
  // Current User & Profile
  async getCurrentUser() {
    await delay();
    return { ...mockStore.currentUser };
  },

  async updateProfile(updates) {
    await delay();
    mockStore.currentUser = { ...mockStore.currentUser, ...updates };
    saveStore();
    return { ...mockStore.currentUser };
  },

  // Overview Metrics
  async getOverviewMetrics() {
    await delay();
    return { ...mockStore.overviewMetrics };
  },

  // Repositories
  async getRepositories({ search = '', language = '', visibility = '' } = {}) {
    await delay();
    let list = [...mockStore.repositories];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    }
    if (language && language !== 'All Languages') {
      list = list.filter(r => r.language.toLowerCase() === language.toLowerCase());
    }
    if (visibility && visibility !== 'All') {
      list = list.filter(r => r.visibility.toLowerCase() === visibility.toLowerCase());
    }
    return list;
  },

  async getRepositoryById(id) {
    await delay();
    return mockStore.repositories.find(r => r.id === id || r.name === id) || mockStore.repositories[0];
  },

  async createRepository(data) {
    await delay();
    const newRepo = {
      id: `repo-${Date.now()}`,
      name: data.name,
      description: data.description || 'No description provided.',
      language: data.language || 'Python',
      languageColor: '#3572A5',
      stars: 0,
      forks: 0,
      updated: 'just now',
      visibility: data.visibility || 'Public',
      defaultBranch: 'main',
      filesCount: data.initReadme ? 1 : 0,
      branchesCount: 1
    };
    mockStore.repositories.unshift(newRepo);
    mockStore.overviewMetrics.repositories.count += 1;
    return newRepo;
  },

  // Pull Requests
  async getPullRequests({ status = 'Open', search = '', repository = '' } = {}) {
    await delay();
    let list = [...mockStore.pullRequests];
    if (status && status !== 'All') {
      list = list.filter(p => p.status.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q));
    }
    if (repository && repository !== 'All Repositories') {
      list = list.filter(p => p.repository.toLowerCase() === repository.toLowerCase());
    }
    return list;
  },

  async getPullRequestById(id) {
    await delay();
    return mockStore.pullRequests.find(p => p.id === id || p.number === Number(id)) || mockStore.pullRequests[0];
  },

  async createPullRequest(data) {
    await delay();
    const newNumber = mockStore.pullRequests.length + 43;
    const newPR = {
      id: `pr-${newNumber}`,
      number: newNumber,
      title: data.title,
      description: data.description,
      author: mockStore.currentUser.name,
      authorAvatar: mockStore.currentUser.avatar,
      repository: data.repository || 'devsync-core',
      labels: data.labels || ['enhancement'],
      reviewers: [mockStore.currentUser.avatar],
      commentsCount: 0,
      status: 'Open',
      statusClass: 'badge-status-open',
      updated: 'just now',
      sourceBranch: data.sourceBranch || 'feature/update',
      targetBranch: data.targetBranch || 'main'
    };
    mockStore.pullRequests.unshift(newPR);
    mockStore.overviewMetrics.pullRequests.count += 1;
    return newPR;
  },

  // Issues
  async getIssues({ status = 'Open', search = '', label = '' } = {}) {
    await delay();
    let list = [...mockStore.issues];
    if (status && status !== 'All') {
      list = list.filter(i => i.status.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.repository.toLowerCase().includes(q));
    }
    if (label && label !== 'All Labels') {
      list = list.filter(i => i.labels.includes(label.toLowerCase()));
    }
    return list;
  },

  async createIssue(data) {
    await delay();
    const newNumber = mockStore.issues.length + 105;
    const newIssue = {
      id: `issue-${newNumber}`,
      number: newNumber,
      title: data.title,
      description: data.description,
      repository: data.repository || 'campus-connect',
      labels: data.labels || ['enhancement'],
      author: mockStore.currentUser.name,
      authorAvatar: mockStore.currentUser.avatar,
      commentsCount: 0,
      updated: 'just now',
      status: 'Open'
    };
    mockStore.issues.unshift(newIssue);
    mockStore.overviewMetrics.issues.count += 1;
    return newIssue;
  },

  // Team Members
  async getTeamMembers() {
    await delay();
    return [...mockStore.teamMembers];
  },

  async inviteMember(data) {
    await delay();
    const newMember = {
      id: `member-${Date.now()}`,
      name: data.name || data.email.split('@')[0],
      role: data.role || 'Developer',
      repositoriesCount: 0,
      contributionsCount: 0,
      isOnline: false,
      joined: 'Today',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80'
    };
    mockStore.teamMembers.push(newMember);
    mockStore.overviewMetrics.teamMembers.count += 1;
    return newMember;
  },

  // Developers & Connections
  async getDevelopers({ search = '', skill = '' } = {}) {
    await delay();
    let list = [...mockStore.developers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => (d.name || '').toLowerCase().includes(q) || (d.username || '').toLowerCase().includes(q));
    }
    if (skill && skill !== 'All Skills' && skill !== 'All') {
      const targetSkill = skill.toLowerCase();
      list = list.filter(d => (d.skills || []).some(s => {
        const sName = typeof s === 'string' ? s : (s?.name || '');
        return sName.toLowerCase() === targetSkill;
      }));
    }
    return list;
  },

  async updateConnectionState(developerId, newState) {
    await delay(120);
    const dev = mockStore.developers.find(d => d.id === developerId || d.username === developerId);
    if (dev) {
      dev.connectionState = newState;
      saveStore();
    }
    return dev;
  },

  async getDeveloperByUsername(username) {
    await delay();
    if (!username) {
      return { ...mockStore.currentUser };
    }
    const u = username.toLowerCase();
    if (u === mockStore.currentUser.username.toLowerCase()) {
      return { ...mockStore.currentUser };
    }
    const found = mockStore.developers.find(d => d.username.toLowerCase() === u || d.id === u);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        username: found.username,
        email: found.email || `${found.username}@devsync.dev`,
        role: found.role || 'Developer',
        isVerified: found.isVerified || false,
        avatar: found.avatar,
        headline: found.headline || '',
        bio: found.bio || '',
        location: found.location || '',
        collaborationStatus: found.collaborationStatus || 'Available for collaboration',
        collaborationStatusType: found.collaborationStatusType || 'available',
        openToInvitations: found.openToInvitations !== false,
        skills: (found.skills || []).map(s => typeof s === 'string' ? { name: s, category: 'General', color: 'blue' } : s),
        projects: found.projects || [],
        pinnedProjects: found.pinnedProjects || [],
        stats: found.stats || {
          followers: 0,
          following: 0,
          projects: (found.projects || []).length,
          teams: (found.teams || []).length,
          repositoriesCount: (found.projects || []).length,
          contributionsCount: 0,
          pullRequestsCount: 0,
          issuesCount: 0
        },
        ...found
      };
    }
    return null;
  },

  async updateDeveloperProfile(username, updates) {
    await delay();
    if (!username || username.toLowerCase() === mockStore.currentUser.username.toLowerCase()) {
      mockStore.currentUser = { ...mockStore.currentUser, ...updates };
      // Also sync into developers array if present
      const inDev = mockStore.developers.find(d => d.username.toLowerCase() === mockStore.currentUser.username.toLowerCase());
      if (inDev) Object.assign(inDev, updates);
      saveStore();
      return { ...mockStore.currentUser };
    }
    const target = mockStore.developers.find(d => d.username.toLowerCase() === username.toLowerCase());
    if (target) {
      Object.assign(target, updates);
      saveStore();
      return { ...target };
    }
    return null;
  },

  async togglePinnedProject(username, projectId) {
    await delay();
    const dev = await this.getDeveloperByUsername(username);
    if (!dev) return null;
    let pinned = dev.pinnedProjects || [];
    if (pinned.includes(projectId)) {
      pinned = pinned.filter(id => id !== projectId);
    } else {
      pinned = [...pinned, projectId];
    }
    return await this.updateDeveloperProfile(dev.username, { pinnedProjects: pinned });
  },

  async toggleFollow(username) {
    await delay();
    const dev = await this.getDeveloperByUsername(username);
    if (!dev) return null;
    const isFollowing = !dev.isFollowing;
    const currentFollowers = dev.stats?.followers || 24;
    const followers = isFollowing ? currentFollowers + 1 : Math.max(0, currentFollowers - 1);
    const updated = await this.updateDeveloperProfile(dev.username, {
      isFollowing,
      stats: { ...(dev.stats || {}), followers }
    });
    return { isFollowing, followers: updated.stats.followers };
  },

  // Community
  async getChannels() {
    await delay();
    return [...mockStore.channels];
  },

  async getMessages(channelId = 'ch-general') {
    await delay();
    return mockStore.communityMessages.filter(m => !channelId || m.channelId === channelId);
  },

  async postMessage(channelId, text) {
    await delay(100);
    const newMsg = {
      id: `msg-${Date.now()}`,
      channelId,
      author: mockStore.currentUser.name,
      avatar: mockStore.currentUser.avatar,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text
    };
    mockStore.communityMessages.push(newMsg);
    return newMsg;
  },

  // AI Assistant
  async getAssistantResponse(prompt) {
    await delay(350);
    const lower = prompt.toLowerCase();
    if (lower.includes('explain') || lower.includes('architecture')) {
      return {
        text: `Here is an architectural breakdown:\n\n` +
          `• **Presentation Layer**: Pure vanilla ES6 modules, CSS Custom Properties design system, and Django-ready HTML structures.\n` +
          `• **Service Boundary**: Clean decoupled abstractions (\`RepositoryService\`, \`AuthService\`) allowing zero-overhead swapping between Mock adapters and Django REST endpoints.\n` +
          `• **State & Reactive UX**: Safe DOM manipulation with accessible modals, toast alerts, and responsive drawer navigation.`,
        code: null
      };
    }
    if (lower.includes('debug') || lower.includes('csrf') || lower.includes('error')) {
      return {
        text: `To fix CSRF verification errors on Django REST Framework endpoints:\n\n1. Ensure your fetch calls include the \`X-CSRFToken\` header read from \`document.cookie\`.\n2. Or configure \`TokenAuthentication\` / \`SessionAuthentication\` in \`settings.py\` as shown below:`,
        code: `REST_FRAMEWORK = {\n    'DEFAULT_AUTHENTICATION_CLASSES': [\n        'rest_framework.authentication.SessionAuthentication',\n        'rest_framework.authentication.TokenAuthentication',\n    ],\n    'DEFAULT_PERMISSION_CLASSES': [\n        'rest_framework.permissions.IsAuthenticated',\n    ]\n}`
      };
    }
    if (lower.includes('test') || lower.includes('unit test')) {
      return {
        text: `Here are recommended unit tests for authentication and token validation:`,
        code: `import pytest\nfrom rest_framework.test import APIClient\n\n@pytest.mark.django_db\ndef test_token_verification_success():\n    client = APIClient()\n    response = client.get('/api/v1/user/profile/', HTTP_AUTHORIZATION='Bearer valid_token')\n    assert response.status_code == 200\n    assert response.data['username'] == 'Balajikumar'`
      };
    }
    return {
      text: `DevSync AI Assistant analyzed your request: "${prompt}".\n\nAll components are verified and operating within the designated tokens and layout parameters. Let me know if you would like me to generate code diffs or schema documentation!`,
      code: null
    };
  },

  // Notifications
  async getNotifications() {
    await delay();
    return [...mockStore.notifications];
  },

  async markAllNotificationsRead() {
    await delay(100);
    mockStore.notifications.forEach(n => n.unread = false);
    return mockStore.notifications;
  }
};
