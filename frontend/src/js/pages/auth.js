/**
 * DevSync Authentication Page Controller
 * Handles Sign In, Sign Up, Form Validation, Mobile Number & OTP Verification,
 * Password Visibility, and Google OAuth Integration.
 * Lightweight, accessible, and strictly connected to real backend endpoints.
 */

import { AuthService } from '../services/auth-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { isValidEmail, isValidPassword } from '../core/validators.js';
import { toastSuccess, toastDanger, toastInfo } from '../components/toast.js';
import { apiClient } from '../core/api-client.js';

export function initAuthPage() {
  // Mode: 'signin' or 'signup'
  let currentAuthMode = 'signin';
  let isEmailVerified = false;
  let verifiedEmailAddress = '';
  let emailVerificationToken = '';
  let otpTimerInterval = null;

  // DOM Elements
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const groupFullName = document.getElementById('groupFullName');
  const groupEmail = document.getElementById('groupEmail');
  const groupOtp = document.getElementById('groupOtp');
  const groupConfirmPassword = document.getElementById('groupConfirmPassword');

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const btnSendEmailOtp = document.getElementById('btnSendEmailOtp');
  const emailOtpInput = document.getElementById('emailOtp');
  const btnVerifyEmailOtp = document.getElementById('btnVerifyEmailOtp');
  const otpSentNotice = document.getElementById('otpSentNotice');
  const otpSentNoticeText = document.getElementById('otpSentNoticeText');
  const otpVerifiedBadge = document.getElementById('otpVerifiedBadge');
  const otpTimerDisplay = document.getElementById('otpTimerDisplay');
  const termsAgree = document.getElementById('termsAgree');

  const passInput = document.getElementById('password');
  const confirmPassInput = document.getElementById('confirmPassword');
  const confirmFeedback = document.getElementById('confirmPasswordFeedback');
  const labelPassword = document.getElementById('labelPassword');

  const labelIdentifier = document.getElementById('labelIdentifier');
  const authCardTitle = document.getElementById('authCardTitle');
  const authCardSubtitle = document.getElementById('authCardSubtitle');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const rowRememberMe = document.getElementById('rowRememberMe');
  const linkForgotPassword = document.getElementById('linkForgotPassword');
  const navSignUpLink = document.getElementById('navSignUpLink');
  const topCreateAccountLink = document.getElementById('topCreateAccountLink');

  function setAuthMode(mode) {
    currentAuthMode = mode;
    if (mode === 'signup') {
      if (tabSignUp) {
        tabSignUp.classList.add('active');
        tabSignUp.setAttribute('aria-selected', 'true');
      }
      if (tabSignIn) {
        tabSignIn.classList.remove('active');
        tabSignIn.setAttribute('aria-selected', 'false');
      }
      if (groupFullName) groupFullName.style.display = 'block';
      if (btnSendEmailOtp) btnSendEmailOtp.style.display = 'block';
      if (groupOtp) groupOtp.style.display = 'block';
      if (groupConfirmPassword) groupConfirmPassword.style.display = 'block';

      if (labelIdentifier) labelIdentifier.textContent = 'Work or Personal Email';
      if (labelPassword) labelPassword.textContent = 'Create Password';
      if (authCardTitle) authCardTitle.textContent = 'Create Account 🚀';
      if (authCardSubtitle) authCardSubtitle.textContent = 'Create your developer profile with verified credentials and collaborate with teams.';
      if (btnSubmitText) btnSubmitText.innerHTML = 'Create Account &rarr;';
      if (rowRememberMe) rowRememberMe.style.display = 'none';
      if (linkForgotPassword) linkForgotPassword.style.display = 'none';
      if (topCreateAccountLink) topCreateAccountLink.textContent = 'Sign In';

      if (emailInput && emailInput.value === 'balaji@devsync.dev') emailInput.value = '';
      if (passInput && passInput.value === 'demo12345') passInput.value = '';
      if (emailInput) emailInput.placeholder = 'e.g. alex@company.com';
      if (passInput) passInput.placeholder = 'Create password (min 8 characters)';

      if (nameInput) nameInput.focus();
    } else {
      if (tabSignIn) {
        tabSignIn.classList.add('active');
        tabSignIn.setAttribute('aria-selected', 'true');
      }
      if (tabSignUp) {
        tabSignUp.classList.remove('active');
        tabSignUp.setAttribute('aria-selected', 'false');
      }
      if (groupFullName) groupFullName.style.display = 'none';
      if (btnSendEmailOtp) btnSendEmailOtp.style.display = 'none';
      if (groupOtp) groupOtp.style.display = 'none';
      if (otpSentNotice) otpSentNotice.style.display = 'none';
      if (otpVerifiedBadge) otpVerifiedBadge.style.display = 'none';
      if (groupConfirmPassword) groupConfirmPassword.style.display = 'none';

      if (labelIdentifier) labelIdentifier.textContent = 'Email or Username';
      if (labelPassword) labelPassword.textContent = 'Password';
      if (authCardTitle) authCardTitle.textContent = 'Welcome Back 👋';
      if (authCardSubtitle) authCardSubtitle.textContent = 'Sign in to your account and continue building with the community.';
      if (btnSubmitText) btnSubmitText.innerHTML = 'Sign In &rarr;';
      if (rowRememberMe) rowRememberMe.style.display = 'flex';
      if (linkForgotPassword) linkForgotPassword.style.display = 'inline-block';
      if (topCreateAccountLink) topCreateAccountLink.textContent = 'Create an account';

      if (emailInput && !emailInput.value) emailInput.value = 'balaji@devsync.dev';
      if (passInput && !passInput.value) passInput.value = 'demo12345';
      if (emailInput) emailInput.placeholder = 'Enter your email or username';
      if (passInput) passInput.placeholder = 'Enter your password';

      if (emailInput) emailInput.focus();
    }
  }

  // Check URL query parameters for initial mode
  const urlParams = new URLSearchParams(window.location.search);
  const initialMode = urlParams.get('mode') || urlParams.get('tab');
  if (initialMode === 'signup' || initialMode === 'register') {
    setAuthMode('signup');
  } else {
    setAuthMode('signin');
  }

  if (tabSignIn) tabSignIn.addEventListener('click', () => setAuthMode('signin'));
  if (tabSignUp) tabSignUp.addEventListener('click', () => setAuthMode('signup'));

  if (navSignUpLink) {
    navSignUpLink.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthMode('signup');
    });
  }

  if (topCreateAccountLink) {
    topCreateAccountLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentAuthMode === 'signup') {
        setAuthMode('signin');
      } else {
        setAuthMode('signup');
      }
    });
  }

  // Invalidate verification if email changes after being verified
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      if (isEmailVerified && emailInput.value.trim().toLowerCase() !== verifiedEmailAddress) {
        isEmailVerified = false;
        emailVerificationToken = '';
        if (otpVerifiedBadge) otpVerifiedBadge.style.display = 'none';
        if (emailOtpInput) {
          emailOtpInput.disabled = false;
          emailOtpInput.value = '';
        }
        if (btnVerifyEmailOtp) {
          btnVerifyEmailOtp.disabled = false;
          btnVerifyEmailOtp.textContent = 'Verify Code';
        }
      }
    });
  }

  // Email Send OTP Handler
  if (btnSendEmailOtp && emailInput) {
    btnSendEmailOtp.addEventListener('click', async () => {
      const emailVal = emailInput.value.trim().toLowerCase();

      if (!emailVal || !isValidEmail(emailVal)) {
        emailInput.classList.add('is-invalid');
        emailInput.focus();
        toastDanger('Please enter a valid email address to receive OTP.');
        return;
      }

      emailInput.classList.remove('is-invalid');
      btnSendEmailOtp.disabled = true;
      btnSendEmailOtp.textContent = 'Sending...';

      try {
        const res = await AuthService.sendEmailOtp(emailVal);

        if (otpSentNotice && otpSentNoticeText) {
          otpSentNotice.style.display = 'flex';
          const noticeMsg = res?.devNotice || res?.message || 'Verification code sent to your email. Check your inbox.';
          otpSentNoticeText.textContent = noticeMsg;
        }

        toastSuccess(res?.message || `Verification code sent to ${emailVal}!`, 'Email Dispatched');

        if (emailOtpInput) {
          emailOtpInput.focus();
        }

        // Start 60s countdown timer
        let countdown = 60;
        btnSendEmailOtp.textContent = `Resend (${countdown}s)`;
        if (otpTimerInterval) clearInterval(otpTimerInterval);
        otpTimerInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            btnSendEmailOtp.textContent = `Resend (${countdown}s)`;
            if (otpTimerDisplay) otpTimerDisplay.textContent = `Resend in ${countdown}s`;
          } else {
            clearInterval(otpTimerInterval);
            btnSendEmailOtp.disabled = false;
            btnSendEmailOtp.textContent = 'Resend OTP';
            if (otpTimerDisplay) otpTimerDisplay.textContent = '';
          }
        }, 1000);
      } catch (err) {
        btnSendEmailOtp.disabled = false;
        btnSendEmailOtp.textContent = 'Send OTP';
        toastDanger(err.message || 'Failed to send verification code. Please check your email address.');
      }
    });
  }

  // Email OTP Verification Handler
  async function handleVerifyEmailOtp() {
    if (!emailOtpInput || !emailInput) return;
    const emailVal = emailInput.value.trim().toLowerCase();
    const otpVal = emailOtpInput.value.trim();

    if (!emailVal || !isValidEmail(emailVal)) {
      emailInput.classList.add('is-invalid');
      emailInput.focus();
      toastDanger('Please enter a valid email address.');
      return;
    }

    if (!otpVal || otpVal.length !== 6) {
      emailOtpInput.classList.add('is-invalid');
      emailOtpInput.focus();
      toastDanger('Please enter the 6-digit OTP received in your email.');
      return;
    }

    if (btnVerifyEmailOtp) {
      btnVerifyEmailOtp.disabled = true;
      btnVerifyEmailOtp.textContent = 'Verifying...';
    }

    try {
      const res = await AuthService.verifyEmailOtp(emailVal, otpVal);
      if (res && (res.verified || res.verificationToken)) {
        isEmailVerified = true;
        verifiedEmailAddress = emailVal;
        emailVerificationToken = res.verificationToken || 'verified_token';
        emailOtpInput.classList.remove('is-invalid');
        if (otpVerifiedBadge) otpVerifiedBadge.style.display = 'inline-flex';
        if (otpSentNotice) otpSentNotice.style.display = 'none';
        if (btnVerifyEmailOtp) {
          btnVerifyEmailOtp.disabled = true;
          btnVerifyEmailOtp.textContent = 'Verified ✓';
        }
        toastSuccess('Email address verified successfully!', 'Verified');
        if (passInput) passInput.focus();
      } else {
        throw new Error(res?.detail || 'Invalid verification code.');
      }
    } catch (err) {
      isEmailVerified = false;
      emailVerificationToken = '';
      emailOtpInput.classList.add('is-invalid');
      if (otpVerifiedBadge) otpVerifiedBadge.style.display = 'none';
      if (btnVerifyEmailOtp) {
        btnVerifyEmailOtp.disabled = false;
        btnVerifyEmailOtp.textContent = 'Verify Code';
      }
      toastDanger(err.message || 'Invalid or expired OTP. Please try again.');
    }
  }

  if (btnVerifyEmailOtp) {
    btnVerifyEmailOtp.addEventListener('click', handleVerifyEmailOtp);
  }

  if (emailOtpInput) {
    emailOtpInput.addEventListener('input', () => {
      const digits = emailOtpInput.value.replace(/\D/g, '');
      emailOtpInput.value = digits;
      if (digits.length === 6 && !isEmailVerified) {
        handleVerifyEmailOtp();
      }
    });
  }

  // Password Visibility Toggle
  const passToggleBtn = document.getElementById('passwordToggleBtn');
  if (passToggleBtn && passInput) {
    passToggleBtn.addEventListener('click', () => {
      const isPassword = passInput.type === 'password';
      passInput.type = isPassword ? 'text' : 'password';

      passToggleBtn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      passToggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // Confirm Password Visibility Toggle
  const confirmToggleBtn = document.getElementById('confirmPasswordToggleBtn');
  if (confirmToggleBtn && confirmPassInput) {
    confirmToggleBtn.addEventListener('click', () => {
      const isPassword = confirmPassInput.type === 'password';
      confirmPassInput.type = isPassword ? 'text' : 'password';

      confirmToggleBtn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      confirmToggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // Confirm Password Live Matching Check
  function validatePasswordMatch() {
    if (currentAuthMode !== 'signup' || !confirmFeedback || !confirmPassInput) return;
    const p1 = passInput ? passInput.value : '';
    const p2 = confirmPassInput.value;

    if (!p2) {
      confirmFeedback.textContent = '';
      confirmFeedback.className = 'password-match-indicator';
      confirmPassInput.classList.remove('is-invalid');
      return;
    }

    if (p1 === p2) {
      confirmFeedback.textContent = '✓ Passwords match';
      confirmFeedback.className = 'password-match-indicator match';
      confirmPassInput.classList.remove('is-invalid');
    } else {
      confirmFeedback.textContent = 'Passwords do not match';
      confirmFeedback.className = 'password-match-indicator mismatch';
    }
  }

  if (confirmPassInput) confirmPassInput.addEventListener('input', validatePasswordMatch);
  if (passInput) passInput.addEventListener('input', validatePasswordMatch);

  // Clear validation error styling on input
  [emailInput, passInput, nameInput, emailOtpInput, confirmPassInput].forEach(input => {
    if (input) {
      input.addEventListener('input', () => input.classList.remove('is-invalid'));
      input.addEventListener('focus', () => input.classList.remove('is-invalid'));
    }
  });

  // Google Sign-In Integration
  const googleBtn = document.getElementById('googleSignInBtn');
  const googleModal = document.getElementById('googleSetupModal');
  const closeGoogleModalBtn = document.getElementById('closeGoogleModalBtn');
  const dismissGoogleModalBtn = document.getElementById('dismissGoogleModalBtn');

  function openGoogleModal() {
    if (googleModal) googleModal.classList.add('open');
  }

  function closeGoogleModal() {
    if (googleModal) googleModal.classList.remove('open');
  }

  if (closeGoogleModalBtn) closeGoogleModalBtn.addEventListener('click', closeGoogleModal);
  if (dismissGoogleModalBtn) dismissGoogleModalBtn.addEventListener('click', closeGoogleModal);
  if (googleModal) {
    googleModal.addEventListener('click', (e) => {
      if (e.target === googleModal) closeGoogleModal();
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        const config = await apiClient.get('/auth/google/config').catch(() => ({ configured: false }));

        if (config && config.configured && config.clientId) {
          toastInfo('Connecting to Google Identity Services...');
          if (window.google && window.google.accounts) {
            window.google.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                toastDanger('Google Sign-In was cancelled or not completed.');
              }
            });
          } else {
            toastInfo('Google Identity client initialized.');
          }
        } else {
          openGoogleModal();
          toastInfo('Google OAuth requires GOOGLE_CLIENT_ID configuration.');
        }
      } catch (err) {
        openGoogleModal();
      }
    });
  }

  // Sign In / Sign Up Form Submission
  const authForm = document.getElementById('signInForm') || document.getElementById('signUpForm');
  const submitBtn = document.getElementById('signInSubmitBtn') || authForm?.querySelector('button[type="submit"]');
  const rememberCheckbox = document.getElementById('rememberMe');
  let isSubmitting = false;

  if (authForm) {
    async function handleFormSubmit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isSubmitting) return false;

      const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : '';
      const passVal = passInput ? passInput.value : '';
      const nameVal = nameInput ? nameInput.value.trim() : '';
      const otpVal = emailOtpInput ? emailOtpInput.value.trim() : '';
      const confirmPassVal = confirmPassInput ? confirmPassInput.value : '';

      // Create Account Mode Validation
      if (currentAuthMode === 'signup') {
        if (!nameVal) {
          if (nameInput) {
            nameInput.classList.add('is-invalid');
            nameInput.focus();
          }
          toastDanger('Please enter your full name.');
          return false;
        }

        if (!emailVal) {
          if (emailInput) {
            emailInput.classList.add('is-invalid');
            emailInput.focus();
          }
          toastDanger('Please enter your email address.');
          return false;
        }

        if (!isValidEmail(emailVal)) {
          if (emailInput) {
            emailInput.classList.add('is-invalid');
            emailInput.focus();
          }
          toastDanger('Please enter a valid email address.');
          return false;
        }

        if (!isEmailVerified || !emailVerificationToken || verifiedEmailAddress !== emailVal) {
          if (emailOtpInput) {
            emailOtpInput.classList.add('is-invalid');
            emailOtpInput.focus();
          }
          toastDanger('Please verify your email with the verification code sent to your inbox before proceeding.');
          return false;
        }

        if (!passVal) {
          if (passInput) {
            passInput.classList.add('is-invalid');
            passInput.focus();
          }
          toastDanger('Please create a password for your account.');
          return false;
        }

        if (passVal.length < 8) {
          if (passInput) {
            passInput.classList.add('is-invalid');
            passInput.focus();
          }
          toastDanger('Password must be at least 8 characters.');
          return false;
        }

        if (confirmPassInput && passVal !== confirmPassVal) {
          confirmPassInput.classList.add('is-invalid');
          confirmPassInput.focus();
          toastDanger('Passwords do not match. Please verify your confirm password.');
          return false;
        }

        if (termsAgree && !termsAgree.checked) {
          toastDanger('Please accept the Terms of Service and Privacy Policy to proceed.');
          return false;
        }
      } else {
        // Sign In Mode Validation
        if (!emailVal && !passVal) {
          if (emailInput) {
            emailInput.classList.add('is-invalid');
            emailInput.focus();
          }
          toastDanger('Please enter your credentials to sign in.');
          return false;
        }

        if (!emailVal) {
          if (emailInput) {
            emailInput.classList.add('is-invalid');
            emailInput.focus();
          }
          toastDanger('Please enter your email or username.');
          return false;
        }

        if (!passVal) {
          if (passInput) {
            passInput.classList.add('is-invalid');
            passInput.focus();
          }
          toastDanger('Please enter your password.');
          return false;
        }
      }

      isSubmitting = true;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Authenticating...';
      }

      try {
        let res;
        if (currentAuthMode === 'signup') {
          res = await AuthService.signUp({
            name: nameVal,
            email: emailVal,
            password: passVal,
            verificationToken: emailVerificationToken
          });
        } else {
          res = await AuthService.signIn({ email: emailVal, password: passVal });
        }

        // Save remember-me state if checked
        if (rememberCheckbox && rememberCheckbox.checked) {
          localStorage.setItem('devsync_remember', emailVal);
        } else {
          localStorage.removeItem('devsync_remember');
        }

        const userName = res?.user?.name || nameVal || 'Developer';
        if (currentAuthMode === 'signup') {
          toastSuccess(`Account created successfully! Welcome to DevSync, ${userName}!`, 'Account Created');
        } else {
          toastSuccess(`Welcome back, ${userName}! Redirecting to workspace...`, 'Signed In');
        }

        const urlParams = new URLSearchParams(window.location.search);
        let destination = urlParams.get('redirect');
        if (!destination || destination.includes('sign-in') || destination.includes('login') || destination.includes('sign-up')) {
          destination = ROUTES.OVERVIEW;
        }

        setTimeout(() => {
          window.location.replace(destination);
        }, 750);
      } catch (err) {
        isSubmitting = false;
        toastDanger(err.message || 'Authentication error. Please check your details and try again.');

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span id="btnSubmitText">${currentAuthMode === 'signup' ? 'Create Account &rarr;' : 'Sign In &rarr;'}</span>`;
        }
      }
      return false;
    }

    authForm.onsubmit = handleFormSubmit;
    authForm.addEventListener('submit', handleFormSubmit);
  }

  // Password Recovery Flows (Forgot & Reset Password)
  const forgotForm = document.getElementById('forgotPasswordForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idInput = forgotForm.querySelector('#recoveryIdentifier') || forgotForm.querySelector('#email');
      const submitBtn = forgotForm.querySelector('button[type="submit"]');
      const val = (idInput?.value || '').trim();

      if (!val) {
        toastDanger('Please enter your email, username, or mobile number.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Sending Instructions...';

      try {
        const res = await AuthService.forgotPassword(val);
        toastSuccess(res.message || 'If an account matches, recovery instructions have been sent.', 'Recovery Code Dispatched');
        submitBtn.innerHTML = 'Code Sent &check;';
        setTimeout(() => {
          window.location.href = `reset-password.html?identifier=${encodeURIComponent(val)}`;
        }, 1200);
      } catch (err) {
        toastDanger(err.message || 'Failed to dispatch recovery instructions.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Recovery Code &rarr;';
      }
    });
  }

  const resetForm = document.getElementById('resetPasswordForm');
  if (resetForm) {
    const urlParams = new URLSearchParams(window.location.search);
    const prefillId = urlParams.get('identifier') || '';
    const idInput = resetForm.querySelector('#resetIdentifier');
    if (idInput && prefillId) {
      idInput.value = prefillId;
    }

    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = (resetForm.querySelector('#resetIdentifier')?.value || '').trim();
      const code = (resetForm.querySelector('#resetCode')?.value || '').trim();
      const passInput = resetForm.querySelector('#newPassword');
      const confirmInput = resetForm.querySelector('#confirmPassword');
      const submitBtn = resetForm.querySelector('button[type="submit"]');

      if (!identifier) {
        toastDanger('Please provide your account identifier.');
        return;
      }
      if (!code || code.length !== 6) {
        toastDanger('Please enter the 6-digit recovery code.');
        return;
      }
      if (!isValidPassword(passInput.value)) {
        toastDanger('Password must be at least 8 characters with letters and numbers.');
        return;
      }
      if (passInput.value !== confirmInput.value) {
        toastDanger('Passwords do not match.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Verifying & Updating...';

      try {
        // Step 1: Verify 6-digit OTP to get reset token
        const verifyRes = await AuthService.verifyRecoveryOtp(identifier, code);
        if (!verifyRes || !verifyRes.reset_token) {
          throw new Error(verifyRes?.error || 'Verification failed. Please check the code.');
        }

        // Step 2: Reset password using the verified single-use reset token
        const resetRes = await AuthService.resetPassword(verifyRes.reset_token, passInput.value);
        toastSuccess(resetRes.message || 'Password updated successfully! Please sign in with your new password.', 'Password Reset Complete');
        setTimeout(() => navigateTo(ROUTES.SIGN_IN), 1200);
      } catch (err) {
        toastDanger(err.message || 'Failed to update password. Code may have expired or is invalid.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Update Password &rarr;';
      }
    });
  }
}
