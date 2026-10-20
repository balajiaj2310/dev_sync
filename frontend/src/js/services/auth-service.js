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

  async signOut() {
    try {
      await apiClient.post('/auth/logout/', {});
    } catch (e) {}
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
