/**
 * DevSync Issue Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const IssueService = {
  async getIssues(filters) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getIssues(filters);
    }
    const params = new URLSearchParams(filters).toString();
    return await apiClient.get(`/issues/?${params}`);
  },

  async createIssue(data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.createIssue(data);
    }
    return await apiClient.post('/issues/', data);
  }
};
