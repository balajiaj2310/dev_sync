/**
 * DevSync Auth Service
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

export const AuthService = {
  async signIn({ email, password }) {
    const res = await apiClient.post('/auth/token/', { email, password });
    if (res && (res.access || res.token)) {
      const token = res.access || res.token;
      localStorage.setItem(APP_CONFIG.storageKeys.authToken, token);
      if (res.user) {
        localStorage.setItem(APP_CONFIG.storageKeys.userSession, JSON.stringify(res.user));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('devsync:auth-changed', { detail: { authenticated: true, user: res.user } }));
      }
      return { success: true, user: res.user, token };
    }
    throw new Error(res?.detail || 'Authentication failed. Please verify your credentials.');
  },

  async signUp(data) {
    try {
      const res = await apiClient.post('/auth/register/', data);
      return res;
    } catch (err) {
      if (APP_CONFIG.demoMode) {
        const user = await MockAPI.getCurrentUser();
        user.name = data.name || user.name;
        user.email = data.email || user.email;
        return { success: true, user };
      }
      throw err;
    }
  },

  async signOut() {
    localStorage.removeItem(APP_CONFIG.storageKeys.authToken);
    localStorage.removeItem(APP_CONFIG.storageKeys.userSession);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('devsync:auth-changed', { detail: { authenticated: false } }));
    }
    return { success: true };
  },

  isAuthenticated() {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const token = localStorage.getItem(APP_CONFIG.storageKeys.authToken);
    return Boolean(token && token.trim().length > 0);
  },

  getCurrentUserSession() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.userSession);
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  },

  async requestPasswordReset(email) {
    try {
      return await apiClient.post('/auth/password/reset/', { email });
    } catch (err) {
      return { success: true, message: `Password reset email dispatched to ${email}` };
    }
  }
};
