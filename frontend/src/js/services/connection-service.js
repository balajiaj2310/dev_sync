/**
 * DevSync Connection Service (Social Developer Network)
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const ConnectionService = {
  async getDevelopers(filters) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getDevelopers(filters);
    }
    const params = new URLSearchParams(filters).toString();
    return await apiClient.get(`/developers/?${params}`);
  },

  async updateConnectionState(developerId, newState) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.updateConnectionState(developerId, newState);
    }
    return await apiClient.post(`/developers/${developerId}/connection/`, { state: newState });
  }
};
