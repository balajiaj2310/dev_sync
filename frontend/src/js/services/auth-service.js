/**
 * DevSync Auth Service
 * Authentication, Session Persistence, Registration, and Password Recovery.
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

  async sendEmailOtp(email) {
    return await apiClient.post('/auth/send-email-otp/', { email });
  },

  async verifyEmailOtp(email, otp) {
    return await apiClient.post('/auth/verify-email-otp/', { email, otp });
  },

  async signUp(data) {
    const res = await apiClient.post('/auth/register/', data);
    if (res && (res.access || res.token)) {
      const token = res.access || res.token;
      localStorage.setItem(APP_CONFIG.storageKeys.authToken, token);
      if (res.user) {
        localStorage.setItem(APP_CONFIG.storageKeys.userSession, JSON.stringify(res.user));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('devsync:auth-changed', { detail: { authenticated: true, user: res.user } }));
      }
    }
    return res;
  },

  setSession(token, user) {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(APP_CONFIG.storageKeys.authToken, token);
      localStorage.setItem('devsync_auth_token', token);
      if (user) {
        localStorage.setItem(APP_CONFIG.storageKeys.userSession, JSON.stringify(user));
        localStorage.setItem('devsync_auth_user', JSON.stringify(user));
        localStorage.setItem('devsync_user', JSON.stringify(user));
      }
      document.cookie = 'devsync_session=' + encodeURIComponent(token) + '; path=/; max-age=2592000; SameSite=Lax';
      window.dispatchEvent(new CustomEvent('devsync:auth-changed', { detail: { authenticated: true, user } }));
    }
  },

  async signOut() {
    try {
      await apiClient.post('/auth/logout/', {});
    } catch (e) {}
    localStorage.removeItem(APP_CONFIG.storageKeys.authToken);
    localStorage.removeItem(APP_CONFIG.storageKeys.userSession);
    localStorage.removeItem('devsync_auth_token');
    localStorage.removeItem('devsync_auth_user');
    localStorage.removeItem('devsync_user');
    document.cookie = 'devsync_session=; path=/; max-age=0; SameSite=Lax';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('devsync:auth-changed', { detail: { authenticated: false } }));
    }
    return { success: true };
  },

  isAuthenticated() {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const token = localStorage.getItem(APP_CONFIG.storageKeys.authToken) || localStorage.getItem('devsync_auth_token');
    return Boolean(token && token.trim().length > 0);
  },

  getCurrentUserSession() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = localStorage.getItem(APP_CONFIG.storageKeys.userSession) ||
                localStorage.getItem('devsync_auth_user') ||
                localStorage.getItem('devsync_user');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  },

  // --------------------------------------------------------
  // Password Recovery Flow (Forgot Password -> OTP -> Reset)
  // --------------------------------------------------------
  async forgotPassword(identifier) {
    return await apiClient.post('/auth/password/forgot/', { identifier });
  },

  async verifyRecoveryOtp(identifier, code) {
    return await apiClient.post('/auth/password/verify-recovery-otp/', { identifier, code });
  },

  async resetPassword(resetToken, newPassword) {
    return await apiClient.post('/auth/password/reset/', {
      reset_token: resetToken,
      new_password: newPassword
    });
  },

  async requestPasswordReset(email) {
    return this.forgotPassword(email);
  }
};
