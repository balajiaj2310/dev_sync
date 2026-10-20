/**
 * DevSync Analytics Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const AnalyticsService = {
  async getOverview() {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getAnalyticsOverview();
    }
    return await apiClient.get('/analytics/overview/');
  },

  async getVelocityMetrics(period = '30d') {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getVelocityMetrics(period);
    }
    return await apiClient.get(`/analytics/velocity/?period=${period}`);
  },

  async getRepositoryDistribution() {
    if (APP_CONFIG.demoMode) {
      return {
        labels: ['devsync-core', 'auth-service', 'ui-kit', 'docs', 'infra'],
        datasets: [{
          label: 'Commits by Repo',
          data: [142, 95, 48, 36, 24],
          backgroundColor: ['#111111', '#86E7BC', '#21865B', '#3568A8', '#A66B14']
        }]
      };
    }
    return await apiClient.get('/analytics/repos/');
  },

  async getContributionIntelligence(range = '30d', project = 'all', user = null) {
    const params = new URLSearchParams({ range, project });
    if (user) params.append('user', user);
    return await apiClient.get(`/analytics/contribution-intelligence?${params.toString()}`);
  }
};
