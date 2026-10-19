/**
 * DevSync Project Pulse Service
 * Real-time project activity graph, interval drilldown, project comparisons, and task progress.
 */

import { apiClient } from '../core/api-client.js';

export const PulseService = {
  async getPulse(username, range = '7d', project = 'all') {
    const params = new URLSearchParams({ range, project }).toString();
    return await apiClient.get(`/developers/${encodeURIComponent(username)}/pulse?${params}`);
  },

  async getEvents(username, range = '7d', project = 'all') {
    const params = new URLSearchParams({ range, project }).toString();
    return await apiClient.get(`/developers/${encodeURIComponent(username)}/pulse/events?${params}`);
  },

  async getComparison(username, range = '7d') {
    const params = new URLSearchParams({ range }).toString();
    return await apiClient.get(`/developers/${encodeURIComponent(username)}/pulse/comparison?${params}`);
  },

  async getProgress(username, project = null) {
    const params = project ? `?project=${encodeURIComponent(project)}` : '';
    return await apiClient.get(`/developers/${encodeURIComponent(username)}/pulse/progress${params}`);
  },

  async getTeamContributions(project = 'devsync-core') {
    const params = new URLSearchParams({ project }).toString();
    return await apiClient.get(`/developers/pulse/team-contributions?${params}`);
  }
};
