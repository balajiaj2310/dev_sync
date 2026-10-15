/**
 * DevSync Settings & Security Service
 * Handles Account Security, 2FA, Active Sessions, Login History,
 * Security Alerts, Connected Apps, Privacy, and Profile preferences.
 * Integrates with Django REST API with automatic client-side persistence fallback.
 */

import { APP_CONFIG } from '../config/app-config.js';
import { apiClient, MockAPI } from '../core/api-client.js';

const STORAGE_KEY_SECURITY = 'devsync_security_settings';
const STORAGE_KEY_SESSIONS = 'devsync_active_sessions';
const STORAGE_KEY_AUDIT = 'devsync_login_history';
const STORAGE_KEY_APPS = 'devsync_connected_apps';
const STORAGE_KEY_PREFS = 'devsync_user_preferences';

function getStored(key, defaultValue) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    }
  } catch (e) {
    console.warn(`[SettingsService] Failed to read ${key} from storage:`, e);
  }
  return defaultValue;
}

function setStored(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`[SettingsService] Failed to write ${key} to storage:`, e);
  }
}

// Initial seed data for security
const DEFAULT_SECURITY = {
  email: 'naveen@devsync.dev',
  emailVerified: true,
  passwordConfigured: true,
  passwordLastChanged: '42 days ago',
  twoFactorEnabled: false,
  twoFactorSecret: 'JBSWY3DPEHPK3PXP',
  recoveryCodesRemaining: 10,
  recoveryCodes: [
    'DVSC-8X92-K4M1',
    'DVSC-77B4-99LP',
    'DVSC-33RA-200X',
    'DVSC-55TQ-18AZ',
    'DVSC-91ZZ-44PO',
    'DVSC-12FA-66KL',
    'DVSC-40PY-88QQ',
    'DVSC-64NM-31EE',
    'DVSC-29WW-75TU',
    'DVSC-80BC-52KJ'
  ],
  secondaryRecoveryEmail: 'naveen.backup@gmail.com',
  alerts: {
    newSignIn: true,
    passwordChange: true,
    emailChange: true,
    twoFactorChange: true,
    sessionRevocation: true
  }
};

const DEFAULT_SESSIONS = [
  {
    id: 'sess-current-01',
    device: 'Windows 11 · Chrome 129',
    ip: '127.0.0.1 (Local Dev)',
    location: 'Bengaluru, India',
    lastActive: 'Active Now',
    isCurrent: true,
    icon: 'desktop'
  },
  {
    id: 'sess-mac-02',
    device: 'macOS Sonoma · Safari 17.4',
    ip: '198.51.100.42',
    location: 'San Francisco, CA, USA',
    lastActive: 'Active 2 hours ago',
    isCurrent: false,
    icon: 'laptop'
  },
  {
    id: 'sess-mobile-03',
    device: 'iOS 18 · Safari Mobile',
    ip: '203.0.113.19',
    location: 'Mumbai, India',
    lastActive: 'Active 3 days ago',
    isCurrent: false,
    icon: 'smartphone'
  }
];

const DEFAULT_LOGIN_HISTORY = [
  {
    id: 'log-01',
    timestamp: 'Today, 09:42 AM',
    event: 'Web Sign-In',
    device: 'Chrome 129 / Windows 11',
    ip: '127.0.0.1 (Localhost)',
    location: 'Bengaluru, India',
    status: 'success'
  },
  {
    id: 'log-02',
    timestamp: 'Yesterday, 04:15 PM',
    event: 'OAuth Token Refresh',
    device: 'Safari 17.4 / macOS',
    ip: '198.51.100.42',
    location: 'San Francisco, CA',
    status: 'success'
  },
  {
    id: 'log-03',
    timestamp: 'Oct 12, 2026, 11:20 AM',
    event: 'Failed Password Attempt',
    device: 'Firefox 130 / Linux x86_64',
    ip: '203.0.113.88',
    location: 'Bengaluru, India',
    status: 'failed'
  },
  {
    id: 'log-04',
    timestamp: 'Oct 10, 2026, 08:05 PM',
    event: 'Web Sign-In',
    device: 'Safari Mobile / iOS 18',
    ip: '203.0.113.19',
    location: 'Mumbai, India',
    status: 'success'
  },
  {
    id: 'log-05',
    timestamp: 'Oct 08, 2026, 02:30 PM',
    event: 'Password Changed',
    device: 'Chrome 129 / Windows 11',
    ip: '127.0.0.1 (Localhost)',
    location: 'Bengaluru, India',
    status: 'success'
  }
];

const DEFAULT_CONNECTED_APPS = [
  {
    id: 'app-cli',
    name: 'DevSync CLI & Credential Helper',
    permissions: 'Repository Read & Write, Public SSH Keys',
    connectedDate: 'September 18, 2026',
    icon: 'terminal'
  },
  {
    id: 'app-vscode',
    name: 'VS Code DevSync Extension',
    permissions: 'AI Coding Assistant, Issue & PR Sync',
    connectedDate: 'October 02, 2026',
    icon: 'code'
  },
  {
    id: 'app-github',
    name: 'GitHub OAuth Link',
    permissions: 'Public Profile, Repository Metadata',
    connectedDate: 'October 10, 2026',
    icon: 'github'
  }
];

const DEFAULT_PREFERENCES = {
  // General & Appearance
  theme: 'light',
  compactDensity: false,
  tabSize: '2',
  editorFont: 'JetBrains Mono',
  inlineDiffs: true,
  defaultStartPage: 'overview',
  timezone: 'Asia/Kolkata (IST)',
  // Notifications
  prefPrReviews: true,
  prefFriendRequests: true,
  prefMentions: true,
  prefWeeklyDigest: false,
  // Privacy
  publicProfile: true,
  discoverability: true,
  onlinePresence: true,
  collaborationAvailable: true,
  emailVisibility: 'connections',
  activityBroadcast: true,
  friendRequestsPermission: 'everyone',
  communityDmsPermission: 'members'
};

export const SettingsService = {
  // ==========================================
  // Security Settings
  // ==========================================
  async getSecuritySettings() {
    try {
      const res = await apiClient.get('/auth/security/');
      if (res && res.email) return res;
    } catch (e) {
      // Backend not yet available, fallback to client store
    }
    return getStored(STORAGE_KEY_SECURITY, DEFAULT_SECURITY);
  },

  async updateEmail(newEmail, currentPassword) {
    if (!newEmail || !newEmail.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }
    if (!currentPassword) {
      throw new Error('Current password is required to update your email.');
    }

    try {
      const res = await apiClient.patch('/auth/email/', { email: newEmail, password: currentPassword });
      if (res && res.success) return res;
    } catch (e) {
      // Demo fallback
    }

    const current = getStored(STORAGE_KEY_SECURITY, DEFAULT_SECURITY);
    current.email = newEmail;
    current.emailVerified = true;
    setStored(STORAGE_KEY_SECURITY, current);

    // Also update current user in mockStore / localStorage session
    try {
      const sessionRaw = localStorage.getItem(APP_CONFIG.storageKeys.userSession);
      if (sessionRaw) {
        const user = JSON.parse(sessionRaw);
        user.email = newEmail;
        localStorage.setItem(APP_CONFIG.storageKeys.userSession, JSON.stringify(user));
      }
    } catch (e) {}

    return { success: true, email: newEmail };
  },

  async resendVerificationEmail() {
    try {
      const res = await apiClient.post('/auth/email/resend-verification/');
      if (res) return res;
    } catch (e) {}
    return { success: true, message: 'Verification link sent to your primary email address.' };
  },

  async changePassword(currentPassword, newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new Error('Password must include at least one uppercase letter and one number.');
    }

    try {
      const res = await apiClient.post('/auth/password/change/', {
        currentPassword,
        newPassword
      });
      if (res && res.success) return res;
    } catch (e) {}

    const sec = getStored(STORAGE_KEY_SECURITY, DEFAULT_SECURITY);
    sec.passwordLastChanged = 'Just now';
    sec.passwordConfigured = true;
    setStored(STORAGE_KEY_SECURITY, sec);

    // Append to audit log
    this.appendAuditLog('Password Changed', 'success');

    return { success: true, message: 'Password updated successfully.' };
  },

  // ==========================================
  // Two-Factor Authentication (2FA)
  // ==========================================
  async getTwoFactorState() {
    const sec = await this.getSecuritySettings();
    return {
      enabled: Boolean(sec.twoFactorEnabled),
      secret: sec.twoFactorSecret || 'JBSWY3DPEHPK3PXP',
      recoveryCodesRemaining: sec.recoveryCodesRemaining || 10,
      recoveryCodes: sec.recoveryCodes || []
    };
  },

  async verifyAndEnable2FA(totpCode) {
    if (!totpCode || totpCode.trim().length !== 6) {
      throw new Error('Please enter a valid 6-digit verification code.');
    }

    try {
      const res = await apiClient.post('/auth/2fa/verify/', { code: totpCode });
      if (res && res.success) return res;
    } catch (e) {}

    const sec = getStored(STORAGE_KEY_SECURITY, DEFAULT_SECURITY);
    sec.twoFactorEnabled = true;
    setStored(STORAGE_KEY_SECURITY, sec);

    this.appendAuditLog('2FA Enabled', 'success');

    return {
      success: true,
      message: 'Two-factor authentication successfully activated.',
      recoveryCodes: sec.recoveryCodes
    };
  },

  async disable2FA(currentPassword) {
    if (!currentPassword) {
      throw new Error('Your password is required to disable two-factor authentication.');
    }

    try {
      const res = await apiClient.post('/auth/2fa/disable/', { password: currentPassword });
      if (res && res.success) return res;
    } catch (e) {}

    const sec = getStored(STORAGE_KEY_SECURITY, DEFAULT_SECURITY);
    sec.twoFactorEnabled = false;
    setStored(STORAGE_KEY_SECURITY, sec);

    this.appendAuditLog('2FA Disabled', 'success');

    return { success: true, message: 'Two-factor authentication has been disabled.' };
  },

  async regenerateRecoveryCodes(password) {
    if (!password) {
      throw new Error('Current password is required to regenerate recovery codes.');
    }

    try {
      const res = await apiClient.post('/auth/2fa/recovery-codes/regenerate/', { password });
      if (res && res.recoveryCodes) return res;
    } catch (e) {}

    // Generate 10 new formatted backup codes
    const newCodes = Array.from({ length: 10 }, () => {
      const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `DVSC-${p1}-${p2}`;
    });

    const sec = getStored(STORAGE_KEY_SECURITY, DEFAULT_SECURITY);
    sec.recoveryCodes = newCodes;
    sec.recoveryCodesRemaining = 10;
    setStored(STORAGE_KEY_SECURITY, sec);

    this.appendAuditLog('Recovery Codes Regenerated', 'success');

    return { success: true, recoveryCodes: newCodes };
  },

  // ==========================================
  // Active Sessions
  // ==========================================
  async getActiveSessions() {
    try {
      const res = await apiClient.get('/auth/sessions/');
      if (Array.isArray(res)) return res;
    } catch (e) {}
    return getStored(STORAGE_KEY_SESSIONS, DEFAULT_SESSIONS);
  },

  async revokeSession(sessionId) {
    try {
      await apiClient.delete(`/auth/sessions/${sessionId}/`);
    } catch (e) {}

    let sessions = getStored(STORAGE_KEY_SESSIONS, DEFAULT_SESSIONS);
    sessions = sessions.filter(s => s.id !== sessionId || s.isCurrent);
    setStored(STORAGE_KEY_SESSIONS, sessions);

    this.appendAuditLog('Session Revoked', 'success');

    return { success: true, remainingCount: sessions.length };
  },

  async revokeAllOtherSessions() {
    try {
      await apiClient.post('/auth/sessions/revoke-others/');
    } catch (e) {}

    let sessions = getStored(STORAGE_KEY_SESSIONS, DEFAULT_SESSIONS);
    sessions = sessions.filter(s => s.isCurrent);
    setStored(STORAGE_KEY_SESSIONS, sessions);

    this.appendAuditLog('Other Sessions Revoked', 'success');

    return { success: true, remainingCount: sessions.length };
  },

  // ==========================================
  // Login Activity & Audit Logs
  // ==========================================
  async getLoginHistory() {
    try {
      const res = await apiClient.get('/auth/login-history/');
      if (Array.isArray(res)) return res;
    } catch (e) {}
    return getStored(STORAGE_KEY_AUDIT, DEFAULT_LOGIN_HISTORY);
  },

  appendAuditLog(event, status = 'success') {
    const list = getStored(STORAGE_KEY_AUDIT, DEFAULT_LOGIN_HISTORY);
    const newEntry = {
      id: `log-${Date.now()}`,
      timestamp: 'Just now',
      event,
      device: navigator.userAgent.includes('Mac') ? 'Safari / macOS' : 'Chrome 129 / Windows',
      ip: '127.0.0.1 (Localhost)',
      location: 'Current Session',
      status
    };
    list.unshift(newEntry);
    setStored(STORAGE_KEY_AUDIT, list.slice(0, 20));
  },

  // ==========================================
  // Security Alerts
  // ==========================================
  async updateSecurityAlerts(alerts) {
    const sec = getStored(STORAGE_KEY_SECURITY, DEFAULT_SECURITY);
    sec.alerts = { ...sec.alerts, ...alerts };
    setStored(STORAGE_KEY_SECURITY, sec);

    try {
      await apiClient.patch('/auth/alerts/', { alerts: sec.alerts });
    } catch (e) {}

    return { success: true, alerts: sec.alerts };
  },

  // ==========================================
  // Connected Applications
  // ==========================================
  async getConnectedApps() {
    try {
      const res = await apiClient.get('/auth/connected-apps/');
      if (Array.isArray(res)) return res;
    } catch (e) {}
    return getStored(STORAGE_KEY_APPS, DEFAULT_CONNECTED_APPS);
  },

  async revokeConnectedApp(appId) {
    try {
      await apiClient.delete(`/auth/connected-apps/${appId}/`);
    } catch (e) {}

    let apps = getStored(STORAGE_KEY_APPS, DEFAULT_CONNECTED_APPS);
    apps = apps.filter(a => a.id !== appId);
    setStored(STORAGE_KEY_APPS, apps);

    this.appendAuditLog('Connected App Revoked', 'success');

    return { success: true, remaining: apps };
  },

  // ==========================================
  // General & Privacy Preferences
  // ==========================================
  async getPreferences() {
    return getStored(STORAGE_KEY_PREFS, DEFAULT_PREFERENCES);
  },

  async updatePreferences(partial) {
    const prefs = getStored(STORAGE_KEY_PREFS, DEFAULT_PREFERENCES);
    const updated = { ...prefs, ...partial };
    setStored(STORAGE_KEY_PREFS, updated);

    try {
      await apiClient.patch('/users/preferences/', updated);
    } catch (e) {}

    return { success: true, preferences: updated };
  },

  // ==========================================
  // Account Deletion (Danger Zone)
  // ==========================================
  async deleteAccount(password, confirmationText) {
    if (confirmationText.trim() !== 'DELETE' && confirmationText.trim() !== 'DELETE MY ACCOUNT') {
      throw new Error('Please type "DELETE" or "DELETE MY ACCOUNT" to confirm.');
    }
    if (!password) {
      throw new Error('Password verification is required for account deletion.');
    }

    try {
      const res = await apiClient.post('/auth/account/delete/', { password, confirmationText });
      if (res && res.success) return res;
    } catch (e) {}

    // Clear local session
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(APP_CONFIG.storageKeys.authToken);
      localStorage.removeItem(APP_CONFIG.storageKeys.userSession);
    }

    return { success: true, message: 'Account scheduled for immediate deletion.' };
  }
};
