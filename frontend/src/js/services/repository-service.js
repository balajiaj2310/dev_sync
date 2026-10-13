/**
 * DevSync Repository Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const RepositoryService = {
  async getRepositories(filters) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getRepositories(filters);
    }
    const params = new URLSearchParams(filters).toString();
    return await apiClient.get(`/repositories/?${params}`);
  },

  async getRepository(id) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getRepositoryById(id);
    }
    return await apiClient.get(`/repositories/${id}/`);
  },

  async createRepository(data) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.createRepository(data);
    }
    return await apiClient.post('/repositories/', data);
  }
};
