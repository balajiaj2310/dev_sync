/**
 * DevSync Settings & Security Service
 * Handles Account Security, Sessions, Login History,
 * Preferences, Privacy, and Danger Zone Account Deletion.
 * Integrates end-to-end with the DevSync backend API.
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient } from '../core/api-client.js';

export const SettingsService = {
  // ==========================================
  // Security Settings
  // ==========================================
  async getSecuritySettings() {
    return await apiClient.get('/auth/security/');
  },

  async updateEmail(newEmail, currentPassword) {
    if (!newEmail || !newEmail.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }
    if (!currentPassword) {
      throw new Error('Current password is required to update your email.');
    }

    return await apiClient.post('/auth/email/request-change/', {
      new_email: newEmail,
      password: currentPassword
    });
  },

  async confirmEmailChange(newEmail, otpCode) {
    if (!newEmail || !otpCode) {
      throw new Error('New email and confirmation code are required.');
    }

    const res = await apiClient.post('/auth/email/confirm-change/', {
      new_email: newEmail,
      otp: otpCode
    });

    // Update local user session if cached
    try {
      const sessionRaw = localStorage.getItem(APP_CONFIG.storageKeys.userSession);
      if (sessionRaw) {
        const user = JSON.parse(sessionRaw);
        user.email = newEmail;
        user.emailVerified = true;
        localStorage.setItem(APP_CONFIG.storageKeys.userSession, JSON.stringify(user));
      }
    } catch (e) {}

    return res;
  },

  async updateMobile(mobile, currentPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to change mobile number.');
    }
    return await apiClient.post('/auth/mobile/request-change/', {
      mobile,
      password: currentPassword
    });
  },

  async resendVerificationEmail() {
    return await apiClient.post('/auth/email/resend-verification/');
  },

  async changePassword(currentPassword, newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new Error('Password must include at least one letter and one number.');
    }

    return await apiClient.post('/auth/password/change/', {
      currentPassword,
      newPassword
    });
  },

  // ==========================================
  // Two-Factor Authentication (2FA) [LATER]
  // ==========================================
  async getTwoFactorState() {
    return {
      enabled: false,
      secret: 'DVSC-2FA-COMING-SOON',
      recoveryCodesRemaining: 0,
      recoveryCodes: [],
      status: 'Two-factor authentication (TOTP) is tagged [LATER] and coming in v2.0.'
    };
  },

  // ==========================================
  // Active Sessions
  // ==========================================
  async getActiveSessions() {
    const res = await apiClient.get('/auth/sessions/');
    return Array.isArray(res) ? res : [];
  },

  async revokeSession(sessionId) {
    return await apiClient.post('/auth/sessions/revoke/', { sessionId });
  },

  async revokeAllOtherSessions(password = '') {
    return await apiClient.post('/auth/sessions/revoke-others/', { password });
  },

  // ==========================================
  // Login Activity & Audit Logs
  // ==========================================
  async getLoginHistory() {
    const res = await apiClient.get('/auth/login-history/');
    return Array.isArray(res) ? res : [];
  },

  // ==========================================
  // Security Alerts
  // ==========================================
  async updateSecurityAlerts(alerts) {
    return await apiClient.patch('/auth/alerts/', { alerts });
  },

  // ==========================================
  // Connected Applications
  // ==========================================
  async getConnectedApps() {
    const res = await apiClient.get('/auth/connected-apps/');
    return Array.isArray(res) ? res : [];
  },

  async revokeConnectedApp(appId) {
    return await apiClient.delete(`/auth/connected-apps/${appId}/`);
  },

  // ==========================================
  // General & Privacy Preferences
  // ==========================================
  async getPreferences() {
    return await apiClient.get('/auth/preferences/');
  },

  async updatePreferences(partial) {
    return await apiClient.patch('/auth/preferences/', partial);
  },

  // ==========================================
  // Account Deletion (Danger Zone)
  // ==========================================
  async deleteAccount(password, confirmationText) {
    if (!password) {
      throw new Error('Password verification is required for account deletion.');
    }
    if (!confirmationText || !confirmationText.trim()) {
      throw new Error('Please type your username or "DELETE" to confirm.');
    }

    const res = await apiClient.post('/auth/account/delete/', {
      password,
      confirmation: confirmationText.trim()
    });

    // Clear local session and tokens
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(APP_CONFIG.storageKeys.authToken);
      localStorage.removeItem(APP_CONFIG.storageKeys.userSession);
    }

    return res;
  }
};
