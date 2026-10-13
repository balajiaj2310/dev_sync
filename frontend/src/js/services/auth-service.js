/**
 * DevSync Auth Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const AuthService = {
  async signIn({ email, password }) {
    if (APP_CONFIG.demoMode) {
      const user = await MockAPI.getCurrentUser();
      localStorage.setItem(APP_CONFIG.storageKeys.authToken, 'mock_jwt_token_demo_mode');
      localStorage.setItem(APP_CONFIG.storageKeys.userSession, JSON.stringify(user));
      return { success: true, user, token: 'mock_jwt_token_demo_mode' };
    }
    const res = await apiClient.post('/auth/token/', { email, password });
    localStorage.setItem(APP_CONFIG.storageKeys.authToken, res.access);
    return res;
  },

  async signUp(data) {
    if (APP_CONFIG.demoMode) {
      const user = await MockAPI.getCurrentUser();
      user.name = data.name || user.name;
      user.email = data.email || user.email;
      return { success: true, user };
    }
    return await apiClient.post('/auth/register/', data);
  },

  async signOut() {
    localStorage.removeItem(APP_CONFIG.storageKeys.authToken);
    localStorage.removeItem(APP_CONFIG.storageKeys.userSession);
    return { success: true };
  },

  async requestPasswordReset(email) {
    if (APP_CONFIG.demoMode) {
      return { success: true, message: `Password reset email dispatched to ${email}` };
    }
    return await apiClient.post('/auth/password/reset/', { email });
  },

  getCurrentUserSession() {
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.userSession);
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  }
};
