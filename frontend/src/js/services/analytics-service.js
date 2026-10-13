/**
 * DevSync Analytics Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient } from '../core/api-client.js';

export const AnalyticsService = {
  async getCommitTrends(timeframe = '30d') {
    if (APP_CONFIG.demoMode) {
      return {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
          label: 'Commits',
          data: [42, 68, 55, 80],
          borderColor: '#111111',
          backgroundColor: '#A8F0D0',
          tension: 0.3
        }]
      };
    }
    return await apiClient.get(`/analytics/commits/?timeframe=${timeframe}`);
  },

  async getRepoActivity() {
    if (APP_CONFIG.demoMode) {
      return {
        labels: ['devsync-core', 'campus-connect', 'portfolio-site', 'ai-tools', 'chaturya-club'],
        datasets: [{
          label: 'Commits by Repo',
          data: [142, 95, 48, 36, 24],
          backgroundColor: ['#111111', '#86E7BC', '#21865B', '#3568A8', '#A66B14']
        }]
      };
    }
    return await apiClient.get('/analytics/repos/');
  }
};
