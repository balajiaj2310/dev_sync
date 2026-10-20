/**
 * DevSync Settings & Security Page Controller
 * Complete interactive management of Account Security, 2FA, Active Sessions,
 * Login History, Security Alerts, Connected Apps, General Preferences, Privacy, and Profile.
 */

import { SettingsService } from '../services/settings-service.js';
import { ProfileService } from '../services/profile-service.js';
import { AuthService } from '../services/auth-service.js';
import { toastSuccess, toastDanger, toastInfo } from '../components/toast.js';
import { ModalManager } from '../core/modal-manager.js';
import { ROUTES } from '../core/route-config.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function initSettingsPage() {
  const container = document.querySelector('.settings-container');
  if (!container || container.dataset.initialized === 'true') return;
  container.dataset.initialized = 'true';

  // Track session and pending action IDs
  let pendingRevokeSessionId = null;
  let pendingRevokeAppId = null;

  // 1. Navigation / Section Switching
  const navButtons = document.querySelectorAll('.settings-nav-btn');
  const panels = document.querySelectorAll('.settings-panel');

  function switchSection(sectionId) {
    if (!sectionId) sectionId = 'security';

    navButtons.forEach(btn => {
      const target = btn.getAttribute('data-section');
      if (target === sectionId) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    panels.forEach(panel => {
      if (panel.id === `panel-${sectionId}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update URL query parameter without full reload
    try {
      const url = new URL(window.location);
      url.searchParams.set('section', sectionId);
      window.history.replaceState({}, '', url);
    } catch (e) {}
  }

  // Handle URL query or hash on boot
  const urlParams = new URLSearchParams(window.location.search);
  const initialSection = urlParams.get('section') || window.location.hash.replace('#', '') || 'security';
  switchSection(initialSection);

  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const section = btn.getAttribute('data-section');
      switchSection(section);
    });
  });

  // 2. Load and Hydrate All Settings
  await refreshAllSettings();

  async function refreshAllSettings() {
    try {
      const [security, twoFa, sessions, loginHistory, apps, prefs, user] = await Promise.all([
        SettingsService.getSecuritySettings(),
        SettingsService.getTwoFactorState(),
        SettingsService.getActiveSessions(),
        SettingsService.getLoginHistory(),
        SettingsService.getConnectedApps(),
        SettingsService.getPreferences(),
        ProfileService.getProfile()
      ]);

      renderSecurityOverview(security, twoFa, sessions);
      renderEmailCard(security);
      renderTwoFactorCard(twoFa);
      renderSessionsList(sessions);
      renderLoginHistory(loginHistory);
      renderConnectedApps(apps);
      renderSecurityAlerts(security.alerts || {});
      renderGeneralSettings(prefs, user);
      renderPrivacySettings(prefs);
      renderProfileSettings(user);
    } catch (err) {
      console.error('[Settings] Error refreshing settings:', err);
    }
  }

  // =========================================================================
  // SECTION: SECURITY OVERVIEW CARD
  // =========================================================================
  function renderSecurityOverview(security, twoFa, sessions) {
    // 1. Email Indicator
    const emailStatusEl = document.getElementById('overviewEmailStatus');
    const emailSubtextEl = document.getElementById('overviewEmailSubtext');
    if (emailStatusEl) {
      emailStatusEl.className = security.emailVerified ? 'indicator-status-pill pill-verified' : 'indicator-status-pill pill-warning';
      emailStatusEl.textContent = security.emailVerified ? 'Verified' : 'Unverified';
    }
    if (emailSubtextEl) {
      emailSubtextEl.textContent = security.email || 'Primary confirmed';
    }

    // 2. Password Indicator
    const passStatusEl = document.getElementById('overviewPasswordStatus');
    const passSubtextEl = document.getElementById('overviewPasswordSubtext');
    if (passStatusEl) {
      passStatusEl.className = 'indicator-status-pill pill-success';
      passStatusEl.textContent = 'Configured';
    }
    if (passSubtextEl) {
      passSubtextEl.textContent = `Changed ${security.passwordLastChanged || 'recently'}`;
    }

    // 3. 2FA Indicator
    const twoFaStatusEl = document.getElementById('overview2faStatus');
    const twoFaSubtextEl = document.getElementById('overview2faSubtext');
    const twoFaBanner = document.getElementById('overviewTwoFaBanner');
    if (twoFaStatusEl) {
      twoFaStatusEl.className = twoFa.enabled ? 'indicator-status-pill pill-success' : 'indicator-status-pill pill-warning';
      twoFaStatusEl.textContent = twoFa.enabled ? 'Enabled' : 'Not enabled';
    }
    if (twoFaSubtextEl) {
      twoFaSubtextEl.textContent = twoFa.enabled ? 'Authenticator app' : 'Needs attention';
    }
    if (twoFaBanner) {
      twoFaBanner.style.display = twoFa.enabled ? 'none' : 'flex';
    }

    // 4. Sessions Indicator
    const sessStatusEl = document.getElementById('overviewSessionsStatus');
    const sessSubtextEl = document.getElementById('overviewSessionsSubtext');
    if (sessStatusEl) {
      sessStatusEl.className = 'indicator-status-pill pill-info';
      sessStatusEl.textContent = `${sessions.length} active`;
    }
    if (sessSubtextEl) {
      sessSubtextEl.textContent = `Across ${sessions.length} device${sessions.length === 1 ? '' : 's'}`;
    }
  }

  // Quick action from banner
  const btnBannerEnable2fa = document.getElementById('btnBannerEnable2fa');
  if (btnBannerEnable2fa) {
    btnBannerEnable2fa.addEventListener('click', () => {
      ModalManager.open('modalSetup2FA');
    });
  }

  // =========================================================================
  // CARD A: EMAIL & ACCOUNT VERIFICATION
  // =========================================================================
  function renderEmailCard(security) {
    const currentEmailEl = document.getElementById('currentEmailDisplay');
    const emailBadgeEl = document.getElementById('currentEmailBadge');
    if (currentEmailEl) {
      currentEmailEl.textContent = security.email || 'No email set';
    }
    if (emailBadgeEl) {
      emailBadgeEl.className = security.emailVerified ? 'indicator-status-pill pill-verified' : 'indicator-status-pill pill-warning';
      emailBadgeEl.textContent = security.emailVerified ? 'Verified' : 'Unverified';
    }
  }

  // Resend verification email
  const btnResendVerification = document.getElementById('btnResendVerification');
  if (btnResendVerification) {
    btnResendVerification.addEventListener('click', async () => {
      btnResendVerification.disabled = true;
      btnResendVerification.textContent = 'Sending...';

      try {
        const res = await SettingsService.resendVerificationEmail();
        toastSuccess(res.message || 'Verification link sent to your email.');

        // Cooldown timer
        let seconds = 60;
        const interval = setInterval(() => {
          seconds--;
          if (seconds > 0) {
            btnResendVerification.textContent = `Resend in ${seconds}s`;
          } else {
            clearInterval(interval);
            btnResendVerification.disabled = false;
            btnResendVerification.textContent = 'Resend Verification Email';
          }
        }, 1000);
      } catch (err) {
        toastDanger(err.message || 'Failed to send verification email.');
        btnResendVerification.disabled = false;
        btnResendVerification.textContent = 'Resend Verification Email';
      }
    });
  }

  // Update email modal form
  const formUpdateEmail = document.getElementById('formUpdateEmail');
  if (formUpdateEmail) {
    formUpdateEmail.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newEmailInput = document.getElementById('newEmailInput');
      const emailPasswordInput = document.getElementById('emailPasswordConfirm');
      const submitBtn = formUpdateEmail.querySelector('button[type="submit"]');

      if (!newEmailInput || !emailPasswordInput) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      try {
        const res = await SettingsService.updateEmail(newEmailInput.value.trim(), emailPasswordInput.value);
        toastSuccess(`Primary email updated to ${res.email}. Verification sent.`);
        ModalManager.close('modalUpdateEmail');
        formUpdateEmail.reset();
        await refreshAllSettings();
      } catch (err) {
        toastDanger(err.message || 'Failed to update email address.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Email';
      }
    });
  }

  // =========================================================================
  // CARD B: PASSWORD & AUTHENTICATION
  // =========================================================================
  const formChangePassword = document.getElementById('formChangePassword');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const currentPasswordInput = document.getElementById('currentPasswordInput');

  // Eye toggle handlers
  document.querySelectorAll('.password-eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      } else {
        input.type = 'password';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      }
    });
  });

  // Real-time password requirements validation
  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', () => {
      const val = newPasswordInput.value;
      const reqLen = document.getElementById('reqLen');
      const reqUpper = document.getElementById('reqUpper');
      const reqNum = document.getElementById('reqNum');
      const reqSymbol = document.getElementById('reqSymbol');

      if (reqLen) reqLen.classList.toggle('met', val.length >= 8);
      if (reqUpper) reqUpper.classList.toggle('met', /[A-Z]/.test(val));
      if (reqNum) reqNum.classList.toggle('met', /[0-9]/.test(val));
      if (reqSymbol) reqSymbol.classList.toggle('met', /[^A-Za-z0-9]/.test(val));
    });
  }

  if (formChangePassword) {
    formChangePassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentVal = currentPasswordInput?.value || '';
      const newVal = newPasswordInput?.value || '';
      const confirmVal = confirmPasswordInput?.value || '';

      if (!currentVal) {
        toastDanger('Current password is required.');
        return;
      }
      if (newVal !== confirmVal) {
        toastDanger('New password and confirmation do not match.');
        return;
      }
      if (newVal.length < 8 || !/[A-Z]/.test(newVal) || !/[0-9]/.test(newVal)) {
        toastDanger('Password does not meet all security requirements.');
        return;
      }

      const submitBtn = formChangePassword.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating Password...';

      try {
        await SettingsService.changePassword(currentVal, newVal);
        toastSuccess('Password updated successfully.');
        formChangePassword.reset();
        // Reset checklist
        ['reqLen', 'reqUpper', 'reqNum', 'reqSymbol'].forEach(id => {
          document.getElementById(id)?.classList.remove('met');
        });
        await refreshAllSettings();
      } catch (err) {
        toastDanger(err.message || 'Failed to update password.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
      }
    });
  }

  // =========================================================================
  // CARD C: TWO-FACTOR AUTHENTICATION (2FA)
  // =========================================================================
  function renderTwoFactorCard(twoFa) {
    const bannerDisabled = document.getElementById('twoFaCardDisabled');
    const bannerEnabled = document.getElementById('twoFaCardEnabled');
    const codesRemainingEl = document.getElementById('twoFaCodesRemaining');

    if (twoFa.enabled) {
      if (bannerDisabled) bannerDisabled.style.display = 'none';
      if (bannerEnabled) bannerEnabled.style.display = 'flex';
      if (codesRemainingEl) {
        codesRemainingEl.textContent = `${twoFa.recoveryCodesRemaining || 10} backup codes remaining`;
      }
    } else {
      if (bannerDisabled) bannerDisabled.style.display = 'flex';
      if (bannerEnabled) bannerEnabled.style.display = 'none';
    }
  }

  // Copy secret key
  const btnCopySecretKey = document.getElementById('btnCopySecretKey');
  if (btnCopySecretKey) {
    btnCopySecretKey.addEventListener('click', () => {
      const codeEl = document.getElementById('twoFaSecretCode');
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent.trim());
        toastInfo('Secret key copied to clipboard.');
      }
    });
  }

  // Submit 2FA verification code
  const formVerify2FA = document.getElementById('formVerify2FA');
  if (formVerify2FA) {
    formVerify2FA.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('totpVerificationCode');
      const submitBtn = formVerify2FA.querySelector('button[type="submit"]');

      if (!codeInput || codeInput.value.trim().length !== 6) {
        toastDanger('Please enter the 6-digit verification code.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        const res = await SettingsService.verifyAndEnable2FA(codeInput.value.trim());
        toastSuccess('Two-factor authentication is now active!');
        ModalManager.close('modalSetup2FA');
        formVerify2FA.reset();

        // Render recovery codes in modal and open
        renderRecoveryCodesInModal(res.recoveryCodes);
        ModalManager.open('modalRecoveryCodes');

        await refreshAllSettings();
      } catch (err) {
        toastDanger(err.message || 'Invalid verification code.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify & Activate';
      }
    });
  }

  // Disable 2FA Form
  const formDisable2FA = document.getElementById('formDisable2FA');
  if (formDisable2FA) {
    formDisable2FA.addEventListener('submit', async (e) => {
      e.preventDefault();
      const passwordInput = document.getElementById('disable2FaPassword');
      const submitBtn = formDisable2FA.querySelector('button[type="submit"]');

      if (!passwordInput || !passwordInput.value) {
        toastDanger('Password is required to disable 2FA.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Disabling...';

      try {
        await SettingsService.disable2FA(passwordInput.value);
        toastSuccess('Two-factor authentication disabled.');
        ModalManager.close('modalDisable2FA');
        formDisable2FA.reset();
        await refreshAllSettings();
      } catch (err) {
        toastDanger(err.message || 'Failed to disable 2FA.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Disable 2FA';
      }
    });
  }

  // View / Regenerate Recovery Codes
  function renderRecoveryCodesInModal(codes) {
    const grid = document.getElementById('modalRecoveryCodesGrid');
    if (!grid || !Array.isArray(codes)) return;

    grid.innerHTML = codes.map(c => `
      <div class="recovery-code-item">${escapeHtml(c)}</div>
    `).join('');

    // Wire copy all
    const btnCopyAll = document.getElementById('btnCopyAllRecoveryCodes');
    if (btnCopyAll) {
      btnCopyAll.onclick = () => {
        navigator.clipboard.writeText(codes.join('\n'));
        toastInfo('All 10 backup codes copied to clipboard.');
      };
    }

    // Wire download
    const btnDownload = document.getElementById('btnDownloadRecoveryCodes');
    if (btnDownload) {
      btnDownload.onclick = () => {
        const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'devsync-recovery-codes.txt';
        a.click();
        URL.revokeObjectURL(a.href);
        toastInfo('Backup codes downloaded.');
      };
    }
  }

  const btnViewRecoveryCodes = document.getElementById('btnViewRecoveryCodes');
  if (btnViewRecoveryCodes) {
    btnViewRecoveryCodes.addEventListener('click', async () => {
      const twoFa = await SettingsService.getTwoFactorState();
      renderRecoveryCodesInModal(twoFa.recoveryCodes);
      ModalManager.open('modalRecoveryCodes');
    });
  }

  // Regenerate codes confirmation form
  const formRegenerateCodes = document.getElementById('formRegenerateCodes');
  if (formRegenerateCodes) {
    formRegenerateCodes.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = document.getElementById('regenCodesPassword')?.value || '';
      const submitBtn = formRegenerateCodes.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Regenerating...';

      try {
        const res = await SettingsService.regenerateRecoveryCodes(pass);
        toastSuccess('10 new recovery codes generated.');
        ModalManager.close('modalRegenCodesConfirm');
        formRegenerateCodes.reset();

        renderRecoveryCodesInModal(res.recoveryCodes);
        ModalManager.open('modalRecoveryCodes');

        await refreshAllSettings();
      } catch (err) {
        toastDanger(err.message || 'Failed to regenerate recovery codes.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Regenerate Codes';
      }
    });
  }

  // =========================================================================
  // CARD D: ACTIVE SESSIONS AND DEVICES
  // =========================================================================
  function renderSessionsList(sessions) {
    const container = document.getElementById('sessionsListContainer');
    if (!container) return;

    if (!sessions || sessions.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-secondary" style="font-size: 13px;">
          No active sessions detected.
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(s => {
      let iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
      if (s.icon === 'laptop') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`;
      } else if (s.icon === 'smartphone') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
      }

      return `
        <div class="session-item-row" data-session-id="${escapeHtml(s.id)}">
          <div class="session-item-left">
            <div class="session-device-icon ${s.isCurrent ? 'current' : ''}">
              ${iconSvg}
            </div>
            <div class="session-device-info">
              <div class="session-device-name">
                ${escapeHtml(s.device)}
                ${s.isCurrent ? '<span class="session-current-badge">Active Now · Current Session</span>' : ''}
              </div>
              <p class="session-device-meta">
                ${escapeHtml(s.location)} &bull; IP: ${escapeHtml(s.ip)} &bull; ${escapeHtml(s.lastActive)}
              </p>
            </div>
          </div>
          <div>
            ${s.isCurrent ? `
              <span class="text-secondary" style="font-size: 11.5px; font-weight: 500;">This Device</span>
            ` : `
              <button type="button" class="btn btn-outline btn-sm btn-revoke-session" data-session-id="${escapeHtml(s.id)}">
                Revoke
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Bind revoke buttons
    container.querySelectorAll('.btn-revoke-session').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingRevokeSessionId = btn.getAttribute('data-session-id');
        ModalManager.open('modalRevokeSessionConfirm');
      });
    });
  }

  // Revoke single session confirm
  const btnConfirmRevokeSession = document.getElementById('btnConfirmRevokeSession');
  if (btnConfirmRevokeSession) {
    btnConfirmRevokeSession.addEventListener('click', async () => {
      if (!pendingRevokeSessionId) return;

      btnConfirmRevokeSession.disabled = true;
      btnConfirmRevokeSession.textContent = 'Revoking...';

      try {
        await SettingsService.revokeSession(pendingRevokeSessionId);
        toastSuccess('Session revoked.');
        ModalManager.close('modalRevokeSessionConfirm');
        pendingRevokeSessionId = null;
        await refreshAllSettings();
      } catch (err) {
        toastDanger('Failed to revoke session.');
      } finally {
        btnConfirmRevokeSession.disabled = false;
        btnConfirmRevokeSession.textContent = 'Revoke Session';
      }
    });
  }

  // Revoke all other sessions
  const btnRevokeAllOtherSessions = document.getElementById('btnRevokeAllOtherSessions');
  const btnConfirmRevokeAllOthers = document.getElementById('btnConfirmRevokeAllOthers');

  if (btnRevokeAllOtherSessions) {
    btnRevokeAllOtherSessions.addEventListener('click', () => {
      ModalManager.open('modalRevokeAllOthersConfirm');
    });
  }

  if (btnConfirmRevokeAllOthers) {
    btnConfirmRevokeAllOthers.addEventListener('click', async () => {
      btnConfirmRevokeAllOthers.disabled = true;
      btnConfirmRevokeAllOthers.textContent = 'Signing out...';

      try {
        await SettingsService.revokeAllOtherSessions();
        toastSuccess('All other sessions signed out.');
        ModalManager.close('modalRevokeAllOthersConfirm');
        await refreshAllSettings();
      } catch (err) {
        toastDanger('Failed to revoke sessions.');
      } finally {
        btnConfirmRevokeAllOthers.disabled = false;
        btnConfirmRevokeAllOthers.textContent = 'Sign Out Other Sessions';
      }
    });
  }

  // =========================================================================
  // CARD E: LOGIN ACTIVITY AUDIT TABLE
  // =========================================================================
  function renderLoginHistory(history) {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    if (!history || history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-secondary">No authentication logs found.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = history.map(item => `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(item.timestamp)}</td>
        <td>
          <span style="font-weight: 600; color: var(--color-text-primary);">${escapeHtml(item.event)}</span>
        </td>
        <td class="text-secondary">${escapeHtml(item.device)}</td>
        <td class="text-secondary">${escapeHtml(item.ip)} &bull; ${escapeHtml(item.location)}</td>
        <td>
          <span class="audit-status-badge ${item.status === 'success' ? 'success' : 'failed'}">
            ${item.status === 'success' ? '&check; Success' : '&times; Failed'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // =========================================================================
  // CARD G: SECURITY ALERTS
  // =========================================================================
  function renderSecurityAlerts(alerts) {
    const mapping = {
      'alertNewSignIn': alerts.newSignIn ?? true,
      'alertPasswordChange': alerts.passwordChange ?? true,
      'alertEmailChange': alerts.emailChange ?? true,
      'alert2FAChange': alerts.twoFactorChange ?? true,
      'alertSessionRevocation': alerts.sessionRevocation ?? true
    };

    Object.entries(mapping).forEach(([id, checked]) => {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    });
  }

  // Listen to alert toggles
  document.querySelectorAll('.alert-pref-toggle').forEach(toggle => {
    toggle.addEventListener('change', async () => {
      const payload = {
        newSignIn: document.getElementById('alertNewSignIn')?.checked ?? true,
        passwordChange: document.getElementById('alertPasswordChange')?.checked ?? true,
        emailChange: document.getElementById('alertEmailChange')?.checked ?? true,
        twoFactorChange: document.getElementById('alert2FAChange')?.checked ?? true,
        sessionRevocation: document.getElementById('alertSessionRevocation')?.checked ?? true
      };

      try {
        await SettingsService.updateSecurityAlerts(payload);
        toastInfo('Security alert preferences updated.');
      } catch (e) {
        toastDanger('Failed to update alert preferences.');
      }
    });
  });

  // =========================================================================
  // CARD H: CONNECTED APPLICATIONS
  // =========================================================================
  function renderConnectedApps(apps) {
    const container = document.getElementById('connectedAppsContainer');
    if (!container) return;

    if (!apps || apps.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-secondary" style="font-size: 13px;">
          No connected applications.
        </div>
      `;
      return;
    }

    container.innerHTML = apps.map(app => {
      let iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
      if (app.icon === 'terminal') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`;
      } else if (app.icon === 'github') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;
      }

      return `
        <div class="connected-app-item" data-app-id="${escapeHtml(app.id)}">
          <div class="connected-app-left">
            <div class="connected-app-icon">
              ${iconSvg}
            </div>
            <div>
              <div class="connected-app-name">${escapeHtml(app.name)}</div>
              <p class="connected-app-desc">
                ${escapeHtml(app.permissions)} &bull; Connected ${escapeHtml(app.connectedDate)}
              </p>
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-sm btn-revoke-app" data-app-id="${escapeHtml(app.id)}">
            Revoke Access
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-revoke-app').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingRevokeAppId = btn.getAttribute('data-app-id');
        ModalManager.open('modalRevokeAppConfirm');
      });
    });
  }

  // Revoke app confirm
  const btnConfirmRevokeApp = document.getElementById('btnConfirmRevokeApp');
  if (btnConfirmRevokeApp) {
    btnConfirmRevokeApp.addEventListener('click', async () => {
      if (!pendingRevokeAppId) return;

      btnConfirmRevokeApp.disabled = true;
      btnConfirmRevokeApp.textContent = 'Revoking...';

      try {
        await SettingsService.revokeConnectedApp(pendingRevokeAppId);
        toastSuccess('Application access revoked.');
        ModalManager.close('modalRevokeAppConfirm');
        pendingRevokeAppId = null;
        await refreshAllSettings();
      } catch (err) {
        toastDanger('Failed to revoke app access.');
      } finally {
        btnConfirmRevokeApp.disabled = false;
        btnConfirmRevokeApp.textContent = 'Revoke Access';
      }
    });
  }

  // =========================================================================
  // DANGER ZONE: DELETE ACCOUNT
  // =========================================================================
  const btnOpenDeleteModal = document.getElementById('btnOpenDeleteModal');
  if (btnOpenDeleteModal) {
    btnOpenDeleteModal.addEventListener('click', () => {
      ModalManager.open('modalDeleteAccountConfirm');
    });
  }

  const formDeleteAccount = document.getElementById('formDeleteAccount');
  if (formDeleteAccount) {
    formDeleteAccount.addEventListener('submit', async (e) => {
      e.preventDefault();
      const confirmInput = document.getElementById('deleteConfirmationText');
      const passInput = document.getElementById('deleteAccountPassword');
      const submitBtn = formDeleteAccount.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Deleting Account...';

      try {
        await SettingsService.deleteAccount(passInput.value, confirmInput.value);
        toastSuccess('Account successfully deleted. Redirecting to home...');
        setTimeout(() => {
          window.location.href = ROUTES.HOME;
        }, 1200);
      } catch (err) {
        toastDanger(err.message || 'Failed to delete account.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Permanently Delete Account';
      }
    });
  }

  // =========================================================================
  // SECTION: GENERAL SETTINGS
  // =========================================================================
  function renderGeneralSettings(prefs, user) {
    // Summary info
    const summaryAvatar = document.getElementById('generalSummaryAvatar');
    const summaryName = document.getElementById('generalSummaryName');
    const summaryHandle = document.getElementById('generalSummaryHandle');
    const summaryRole = document.getElementById('generalSummaryRole');

    if (summaryAvatar && user.avatar) summaryAvatar.src = user.avatar;
    if (summaryName) summaryName.textContent = user.name || 'Developer';
    if (summaryHandle) summaryHandle.textContent = `@${user.username || 'user'}`;
    if (summaryRole) summaryRole.textContent = `${user.role || 'Developer'} &bull; Member`;

    // Profile links in summary
    const btnSummPub = document.getElementById('btnSummaryPublicProfile');
    const btnSummVis = document.getElementById('btnSummaryVisitorPreview');
    if (btnSummPub && user.username) btnSummPub.href = `/u/${user.username}`;
    if (btnSummVis && user.username) btnSummVis.href = `/u/${user.username}?preview=visitor`;

    // Preferences inputs
    const langEl = document.getElementById('genLanguage');
    const tzEl = document.getElementById('genTimezone');
    const compactDensityEl = document.getElementById('genCompactDensity');
    const tabSizeEl = document.getElementById('genTabSize');
    const editorFontEl = document.getElementById('genEditorFont');
    const inlineDiffsEl = document.getElementById('genInlineDiffs');
    const defaultPageEl = document.getElementById('genDefaultPage');

    const genPrefs = prefs.general || prefs;
    if (langEl) langEl.value = genPrefs.language || 'en';
    if (tzEl) tzEl.value = genPrefs.timezone || 'Asia/Kolkata';
    if (compactDensityEl) compactDensityEl.checked = Boolean(genPrefs.compactDensity || genPrefs.compact_density);
    if (tabSizeEl) tabSizeEl.value = String(genPrefs.tabSize || genPrefs.tab_size || '2');
    if (editorFontEl) editorFontEl.value = genPrefs.editorFont || genPrefs.editor_font || 'JetBrains Mono';
    if (inlineDiffsEl) inlineDiffsEl.checked = (genPrefs.inlineDiffs ?? genPrefs.inline_diffs) !== false;
    if (defaultPageEl) defaultPageEl.value = genPrefs.defaultStartPage || genPrefs.default_page || 'overview';

    // Notification Matrix (Event x Channel)
    const notifs = prefs.notifications || prefs;
    const dmInApp = document.getElementById('notif_dm_inapp');
    const dmEmail = document.getElementById('notif_dm_email');
    const menInApp = document.getElementById('notif_mentions_inapp');
    const menEmail = document.getElementById('notif_mentions_email');
    const invInApp = document.getElementById('notif_invites_inapp');
    const invEmail = document.getElementById('notif_invites_email');
    const taskInApp = document.getElementById('notif_tasks_inapp');
    const taskEmail = document.getElementById('notif_tasks_email');
    const deadInApp = document.getElementById('notif_deadlines_inapp');
    const deadEmail = document.getElementById('notif_deadlines_email');
    const digInApp = document.getElementById('notif_digest_inapp');
    const digEmail = document.getElementById('notif_digest_email');

    if (dmInApp) dmInApp.checked = notifs.direct_messages?.in_app ?? true;
    if (dmEmail) dmEmail.checked = notifs.direct_messages?.email ?? true;
    if (menInApp) menInApp.checked = notifs.mentions?.in_app ?? true;
    if (menEmail) menEmail.checked = notifs.mentions?.email ?? true;
    if (invInApp) invInApp.checked = notifs.team_invitations?.in_app ?? true;
    if (invEmail) invEmail.checked = notifs.team_invitations?.email ?? true;
    if (taskInApp) taskInApp.checked = notifs.task_assignments?.in_app ?? true;
    if (taskEmail) taskEmail.checked = notifs.task_assignments?.email ?? false;
    if (deadInApp) deadInApp.checked = notifs.task_deadlines?.in_app ?? true;
    if (deadEmail) deadEmail.checked = notifs.task_deadlines?.email ?? true;
    if (digInApp) digInApp.checked = notifs.weekly_digest?.in_app ?? false;
    if (digEmail) digEmail.checked = notifs.weekly_digest?.email ?? false;
  }

  const btnSaveGeneralSettings = document.getElementById('btnSaveGeneralSettings');
  if (btnSaveGeneralSettings) {
    btnSaveGeneralSettings.addEventListener('click', async () => {
      btnSaveGeneralSettings.disabled = true;
      btnSaveGeneralSettings.textContent = 'Saving...';

      const payload = {
        general: {
          language: document.getElementById('genLanguage')?.value || 'en',
          timezone: document.getElementById('genTimezone')?.value || 'Asia/Kolkata',
          compactDensity: document.getElementById('genCompactDensity')?.checked ?? false,
          tabSize: Number(document.getElementById('genTabSize')?.value || 2),
          editorFont: document.getElementById('genEditorFont')?.value || 'JetBrains Mono',
          inlineDiffs: document.getElementById('genInlineDiffs')?.checked ?? true,
          defaultStartPage: document.getElementById('genDefaultPage')?.value || 'overview'
        },
        notifications: {
          direct_messages: {
            in_app: document.getElementById('notif_dm_inapp')?.checked ?? true,
            email: document.getElementById('notif_dm_email')?.checked ?? true
          },
          mentions: {
            in_app: document.getElementById('notif_mentions_inapp')?.checked ?? true,
            email: document.getElementById('notif_mentions_email')?.checked ?? true
          },
          team_invitations: {
            in_app: document.getElementById('notif_invites_inapp')?.checked ?? true,
            email: document.getElementById('notif_invites_email')?.checked ?? true
          },
          task_assignments: {
            in_app: document.getElementById('notif_tasks_inapp')?.checked ?? true,
            email: document.getElementById('notif_tasks_email')?.checked ?? false
          },
          task_deadlines: {
            in_app: document.getElementById('notif_deadlines_inapp')?.checked ?? true,
            email: document.getElementById('notif_deadlines_email')?.checked ?? true
          },
          weekly_digest: {
            in_app: document.getElementById('notif_digest_inapp')?.checked ?? false,
            email: document.getElementById('notif_digest_email')?.checked ?? false
          }
        }
      };

      try {
        await SettingsService.updatePreferences(payload);
        toastSuccess('General preferences saved successfully.');
      } catch (err) {
        toastDanger('Failed to save general preferences.');
      } finally {
        btnSaveGeneralSettings.disabled = false;
        btnSaveGeneralSettings.textContent = 'Save General Settings';
      }
    });
  }

  // =========================================================================
  // SECTION: PRIVACY SETTINGS
  // =========================================================================
  function renderPrivacySettings(prefs) {
    const publicProfileEl = document.getElementById('privPublicProfile');
    const discoverabilityEl = document.getElementById('privDiscoverability');
    const onlinePresenceEl = document.getElementById('privOnlinePresence');
    const collaborationEl = document.getElementById('privCollaboration');
    const emailVisibilityEl = document.getElementById('privEmailVisibility');
    const activityBroadcastEl = document.getElementById('privActivityBroadcast');
    const friendRequestsEl = document.getElementById('privFriendRequests');
    const communityDmsEl = document.getElementById('privCommunityDms');

    if (publicProfileEl) publicProfileEl.checked = prefs.publicProfile !== false;
    if (discoverabilityEl) discoverabilityEl.checked = prefs.discoverability !== false;
    if (onlinePresenceEl) onlinePresenceEl.checked = prefs.onlinePresence !== false;
    if (collaborationEl) collaborationEl.checked = prefs.collaborationAvailable !== false;
    if (emailVisibilityEl) emailVisibilityEl.value = prefs.emailVisibility || 'connections';
    if (activityBroadcastEl) activityBroadcastEl.checked = prefs.activityBroadcast !== false;
    if (friendRequestsEl) friendRequestsEl.value = prefs.friendRequestsPermission || 'everyone';
    if (communityDmsEl) communityDmsEl.value = prefs.communityDmsPermission || 'members';
  }

  const btnSavePrivacySettings = document.getElementById('btnSavePrivacySettings');
  if (btnSavePrivacySettings) {
    btnSavePrivacySettings.addEventListener('click', async () => {
      btnSavePrivacySettings.disabled = true;
      btnSavePrivacySettings.textContent = 'Saving...';

      const payload = {
        publicProfile: document.getElementById('privPublicProfile')?.checked ?? true,
        discoverability: document.getElementById('privDiscoverability')?.checked ?? true,
        onlinePresence: document.getElementById('privOnlinePresence')?.checked ?? true,
        collaborationAvailable: document.getElementById('privCollaboration')?.checked ?? true,
        emailVisibility: document.getElementById('privEmailVisibility')?.value || 'connections',
        activityBroadcast: document.getElementById('privActivityBroadcast')?.checked ?? true,
        friendRequestsPermission: document.getElementById('privFriendRequests')?.value || 'everyone',
        communityDmsPermission: document.getElementById('privCommunityDms')?.value || 'members'
      };

      try {
        await SettingsService.updatePreferences(payload);
        toastSuccess('Privacy and access settings saved.');
      } catch (err) {
        toastDanger('Failed to save privacy settings.');
      } finally {
        btnSavePrivacySettings.disabled = false;
        btnSavePrivacySettings.textContent = 'Save Privacy Settings';
      }
    });
  }

  // =========================================================================
  // SECTION: PROFILE SETTINGS
  // =========================================================================
  function renderProfileSettings(user) {
    const avatarEl = document.getElementById('profileAvatarImg');
    const nameEl = document.getElementById('profileDisplayNameInput');
    const usernameEl = document.getElementById('profileUsernameInput');
    const headlineEl = document.getElementById('profileHeadlineInput');
    const bioEl = document.getElementById('profileBioInput');
    const locationEl = document.getElementById('profileLocationInput');
    const websiteEl = document.getElementById('profileWebsiteInput');
    const githubEl = document.getElementById('profileGithubInput');
    const linkedinEl = document.getElementById('profileLinkedinInput');
    const instagramEl = document.getElementById('profileInstagramInput');

    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
    if (nameEl) nameEl.value = user.name || '';
    if (usernameEl) usernameEl.value = user.username || '';
    if (headlineEl) headlineEl.value = user.headline || '';
    if (bioEl) bioEl.value = user.bio || '';
    if (locationEl) locationEl.value = user.location || '';
    if (websiteEl) websiteEl.value = user.website || '';
    if (githubEl) githubEl.value = user.social?.github || '';
    if (linkedinEl) linkedinEl.value = user.social?.linkedin || '';
    if (instagramEl) instagramEl.value = user.social?.instagram || '';
    const visitorBtn = document.getElementById('btnViewProfileVisitor');
    if (visitorBtn && user.username) {
      visitorBtn.href = `/u/${user.username}?preview=visitor`;
    }
  }

  // Profile avatar upload preview
  const avatarInput = document.getElementById('profileAvatarFileInput');
  const avatarImg = document.getElementById('profileAvatarImg');
  let pendingAvatarData = null;

  if (avatarInput && avatarImg) {
    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          avatarImg.src = evt.target.result;
          pendingAvatarData = evt.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const formProfileSettings = document.getElementById('formProfileSettings');
  if (formProfileSettings) {
    formProfileSettings.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = formProfileSettings.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Changes...';

      const payload = {
        name: document.getElementById('profileDisplayNameInput')?.value.trim() || '',
        headline: document.getElementById('profileHeadlineInput')?.value.trim() || '',
        bio: document.getElementById('profileBioInput')?.value.trim() || '',
        location: document.getElementById('profileLocationInput')?.value.trim() || '',
        website: document.getElementById('profileWebsiteInput')?.value.trim() || '',
        social: {
          github: document.getElementById('profileGithubInput')?.value.trim() || '',
          linkedin: document.getElementById('profileLinkedinInput')?.value.trim() || '',
          instagram: document.getElementById('profileInstagramInput')?.value.trim() || ''
        }
      };

      if (pendingAvatarData) {
        payload.avatar = pendingAvatarData;
      }

      try {
        const updated = await ProfileService.updateProfile(payload);
        toastSuccess('Profile updated successfully.');

        // Update active session in localStorage if present
        try {
          const raw = localStorage.getItem(APP_CONFIG.storageKeys.userSession);
          if (raw) {
            const current = JSON.parse(raw);
            localStorage.setItem(APP_CONFIG.storageKeys.userSession, JSON.stringify({ ...current, ...updated }));
          }
        } catch (e) {}

        // Update topbar header avatar
        document.querySelectorAll('.user-avatar').forEach(img => {
          if (updated.avatar) img.src = updated.avatar;
        });
        document.querySelectorAll('.user-name').forEach(el => {
          el.textContent = updated.name;
        });

        await refreshAllSettings();
      } catch (err) {
        toastDanger(err.message || 'Failed to update profile.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Profile Changes';
      }
    });
  }
}
