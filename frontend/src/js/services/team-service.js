/**
 * DevSync Team Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const TeamService = {
  async getMembers() {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getTeamMembers();
    }
    return await apiClient.get('/teams/members/');
  },

  async inviteMember(data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.inviteMember(data);
    }
    return await apiClient.post('/teams/members/invite/', data);
  }
};
