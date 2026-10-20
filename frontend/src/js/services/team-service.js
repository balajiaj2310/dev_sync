/**
 * DevSync Team Service
 * Connects to live Django REST Backend endpoints
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const TeamService = {
  async getTeams() {
    return await apiClient.get('/teams/');
  },

  async getMembers(filters = {}) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getTeamMembers();
    }
    const cleanFilters = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'all' && v !== 'All' && v !== 'All Projects' && v !== 'All Roles') {
        cleanFilters[k] = v;
      }
    }
    const params = new URLSearchParams(cleanFilters).toString();
    return await apiClient.get(`/teams/members/?${params}`);
  },

  async inviteMember(data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.inviteMember(data);
    }
    return await apiClient.post('/teams/members/invite/', data);
  },

  async updateMember(username, data) {
    return await apiClient.patch(`/teams/members/${username}/`, data);
  },

  async removeMember(username, project = null) {
    const params = project ? `?project=${encodeURIComponent(project)}` : '';
    return await apiClient.delete(`/teams/members/${username}/${params}`);
  }
};
