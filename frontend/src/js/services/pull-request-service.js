/**
 * DevSync Pull Request Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const PullRequestService = {
  async getPullRequests(filters) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getPullRequests(filters);
    }
    const params = new URLSearchParams(filters).toString();
    return await apiClient.get(`/pull-requests/?${params}`);
  },

  async getPullRequest(id) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getPullRequestById(id);
    }
    return await apiClient.get(`/pull-requests/${id}/`);
  },

  async createPullRequest(data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.createPullRequest(data);
    }
    return await apiClient.post('/pull-requests/', data);
  }
};
