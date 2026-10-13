/**
 * DevSync AI Assistant Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const AssistantService = {
  async sendMessage(prompt, context = {}) {
    if (APP_CONFIG.demoMode) {
      return await MockAPI.getAssistantResponse(prompt);
    }
    return await apiClient.post('/assistant/chat/', { prompt, context });
  }
};
