/**
 * DevSync Connection Service (Social Developer Network)
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const ConnectionService = {
  async getDevelopers(filters = {}) {
    try {
      const cleanFilters = {};
      if (filters.search) cleanFilters.search = filters.search;
      if (filters.skill && filters.skill !== 'All Skills' && filters.skill !== 'All') {
        cleanFilters.skill = filters.skill;
      }
      const params = new URLSearchParams(cleanFilters).toString();
      const endpoint = `/developers${params ? '?' + params : ''}`;
      const res = await apiClient.get(endpoint);
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.results)) return res.results;
    } catch (err) {
      console.warn('[ConnectionService] Real API endpoint failed or unreachable, falling back to mock:', err);
    }
    return await MockAPI.getDevelopers(filters);
  },

  async updateConnectionState(developerId, newState) {
    try {
      const res = await apiClient.post(`/developers/${developerId}/connection/`, { state: newState });
      if (res) return res;
    } catch (err) {
      console.warn('[ConnectionService] updateConnectionState API failed, falling back:', err);
    }
    return await MockAPI.updateConnectionState(developerId, newState);
  }
};
