/**
 * DevSync Issue Service
 * Connects to live Django REST Backend endpoints
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const IssueService = {
  async getIssues(filters = {}) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getIssues(filters);
    }
    const cleanFilters = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'All' && v !== 'All Labels' && v !== 'All Repositories') {
        cleanFilters[k] = v;
      }
    }
    const params = new URLSearchParams(cleanFilters).toString();
    return await apiClient.get(`/issues/?${params}`);
  },

  async getIssue(id) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getIssueById(id);
    }
    return await apiClient.get(`/issues/${id}/`);
  },

  async createIssue(data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.createIssue(data);
    }
    return await apiClient.post('/issues/', data);
  },

  async addComment(id, text) {
    return await apiClient.post(`/issues/${id}/comments/`, { text });
  },

  async closeIssue(id) {
    return await apiClient.post(`/issues/${id}/close/`, {});
  },

  async reopenIssue(id) {
    return await apiClient.post(`/issues/${id}/reopen/`, {});
  }
};
