/**
 * DevSync Settings & Security Service
 * Handles Account Security, Sessions, Login History,
 * Protected Password Changes, RFC 6238 2FA (TOTP),
 * Preferences, Privacy, and Danger Zone Account Deletion.
 * Integrates end-to-end with the DevSync backend API.
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient } from '../core/api-client.js';

export const SettingsService = {
  // ==========================================
  // Security Overview & Re-authentication
  // ==========================================
  async getSecuritySettings() {
    return await apiClient.get('/auth/security/');
  },

  async getSecurityOverview() {
    return await apiClient.get('/auth/security/overview/');
  },

  async reauthenticate(currentPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to verify your identity.');
    }
    return await apiClient.post('/auth/security/reauthenticate/', {
      password: currentPassword
    });
  },

  // ==========================================
  // Email & Mobile Updates
  // ==========================================
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

  // ==========================================
  // Password Management (Standard & Protected)
  // ==========================================
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

  async changePasswordProtected({ reauthToken, currentPassword, newPassword, confirmPassword, revokeOtherSessions = true }) {
    if (!reauthToken) {
      throw new Error('Re-authentication authorization is required. Please verify your identity first.');
    }
    if (!currentPassword) {
      throw new Error('Current password is required.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    if (confirmPassword && confirmPassword !== newPassword) {
      throw new Error('New passwords do not match.');
    }

    return await apiClient.post('/auth/password/change-protected/', {
      reauth_token: reauthToken,
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
      revoke_other_sessions: revokeOtherSessions
    });
  },

  // ==========================================
  // Two-Factor Authentication (2FA) (TOTP)
  // ==========================================
  async getTwoFactorState() {
    try {
      const overview = await this.getSecurityOverview();
      return {
        enabled: overview.two_factor_enabled || false,
        type: overview.two_factor_type || 'Not Enabled',
        recoveryCodesRemaining: overview.recovery_codes_count || 0,
        status: overview.two_factor_enabled ? 'Active protection via Authenticator App (TOTP)' : 'Not enabled'
      };
    } catch (_) {
      return {
        enabled: false,
        type: 'Not Enabled',
        recoveryCodesRemaining: 0,
        status: 'Not enabled'
      };
    }
  },

  async setupTwoFactor({ reauthToken, password }) {
    return await apiClient.post('/auth/2fa/setup/', {
      reauth_token: reauthToken,
      password: password
    });
  },

  async enableTwoFactor({ code, secret }) {
    if (!code || code.trim().length !== 6) {
      throw new Error('Please enter a valid 6-digit verification code.');
    }
    return await apiClient.post('/auth/2fa/enable/', {
      code: code.trim(),
      secret: secret
    });
  },

  async disableTwoFactor({ password, reauthToken }) {
    return await apiClient.post('/auth/2fa/disable/', {
      password,
      reauth_token: reauthToken
    });
  },

  async regenerateRecoveryCodes({ password, reauthToken }) {
    return await apiClient.post('/auth/2fa/recovery-codes/regenerate/', {
      password,
      reauth_token: reauthToken
    });
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

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(APP_CONFIG.storageKeys.authToken);
      localStorage.removeItem(APP_CONFIG.storageKeys.userSession);
    }

    return res;
  }
};
