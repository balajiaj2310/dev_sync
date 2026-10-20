/**
 * DevSync Pull Request Service
 * Connects to live Django REST Backend endpoints
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const PullRequestService = {
  async getPullRequests(filters = {}) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getPullRequests(filters);
    }
    const cleanFilters = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'All' && v !== 'All Repositories' && v !== 'All Authors') {
        cleanFilters[k] = v;
      }
    }
    const params = new URLSearchParams(cleanFilters).toString();
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
  },

  async reviewPullRequest(id, action, comment = '') {
    return await apiClient.post(`/pull-requests/${id}/review/`, { action, comment });
  },

  async closePullRequest(id) {
    return await apiClient.post(`/pull-requests/${id}/close/`, {});
  },

  async mergePullRequest(id) {
    return await apiClient.post(`/pull-requests/${id}/merge/`, {});
  }
};
