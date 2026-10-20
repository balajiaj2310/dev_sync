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

  // =========================================================================
  // PASSWORD RECOVERY FLOW (STEPS A, B, C, & D)
  // =========================================================================

  // -------------------------------------------------------------
  // STEP A: FORGOT PASSWORD (REQUEST RECOVERY CODE)
  // -------------------------------------------------------------
  const forgotForm = document.getElementById('forgotPasswordForm');
  if (forgotForm) {
    const idInput = forgotForm.querySelector('#recoveryIdentifier') || forgotForm.querySelector('#email');
    const submitBtn = forgotForm.querySelector('button[type="submit"]') || document.getElementById('btnSendRecovery');
    const errorMsg = document.getElementById('identifierError');

    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = (idInput?.value || '').trim();

      if (!val) {
        if (errorMsg) {
          errorMsg.textContent = 'Please enter your registered email address or username.';
          errorMsg.style.display = 'block';
        }
        idInput?.classList.add('is-invalid');
        idInput?.focus();
        return;
      }

      if (errorMsg) errorMsg.style.display = 'none';
      idInput?.classList.remove('is-invalid');

      submitBtn.disabled = true;
      const originalBtnHTML = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Sending Code...';

      try {
        const res = await AuthService.forgotPassword(val);
        // Store identifier in sessionStorage without leaking into URL query string
        sessionStorage.setItem('devsync_recovery_identifier', val);
        sessionStorage.setItem('devsync_otp_sent_at', Date.now().toString());

        toastSuccess(res.message || 'If an account matches, a recovery code has been sent.', 'Recovery Code Dispatched');
        submitBtn.innerHTML = 'Code Sent &check;';
        
        setTimeout(() => {
          navigateTo(ROUTES.VERIFY_CODE || 'verify-code.html');
        }, 800);
      } catch (err) {
        toastDanger(err.message || 'Failed to dispatch recovery code.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    });

    idInput?.addEventListener('input', () => {
      if (errorMsg) errorMsg.style.display = 'none';
      idInput.classList.remove('is-invalid');
    });
  }

  // -------------------------------------------------------------
  // STEP B: VERIFY RECOVERY CODE (6-DIGIT OTP & COOLDOWN TIMERS)
  // -------------------------------------------------------------
  const verifyCodeForm = document.getElementById('verifyCodeForm');
  if (verifyCodeForm) {
    const recoveryIdentifier = sessionStorage.getItem('devsync_recovery_identifier') || '';
    const targetSummary = document.getElementById('targetSummaryNotice');
    const targetText = document.getElementById('targetSummaryText');
    const otpBoxes = Array.from(verifyCodeForm.querySelectorAll('.recovery-otp-box'));
    const masterOtpInput = document.getElementById('otpInputMaster');
    const countdownEl = document.getElementById('recoveryCountdown');
    const resendBtn = document.getElementById('btnResendCode');
    const resendSecEl = document.getElementById('resendSeconds');
    const statusMsg = document.getElementById('verifyStatusMsg');
    const submitBtn = verifyCodeForm.querySelector('button[type="submit"]') || document.getElementById('btnVerifyCode');

    if (recoveryIdentifier && targetSummary && targetText) {
      targetSummary.style.display = 'flex';
      // Mask identifier slightly for privacy
      let masked = recoveryIdentifier;
      if (recoveryIdentifier.includes('@')) {
        const parts = recoveryIdentifier.split('@');
        masked = `${parts[0].slice(0, 2)}***@${parts[1]}`;
      }
      targetText.textContent = `A 6-digit verification code was sent to ${masked}.`;
    }

    // 10-Minute Expiration Countdown
    let expiryRemaining = 600; // 10 minutes
    const expiryInterval = setInterval(() => {
      expiryRemaining--;
      if (expiryRemaining <= 0) {
        clearInterval(expiryInterval);
        if (countdownEl) countdownEl.textContent = 'Expired';
        if (statusMsg) {
          statusMsg.textContent = 'Your recovery code has expired. Please request a new code.';
          statusMsg.style.display = 'block';
        }
        submitBtn.disabled = true;
      } else {
        const mins = Math.floor(expiryRemaining / 60);
        const secs = expiryRemaining % 60;
        if (countdownEl) {
          countdownEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
      }
    }, 1000);

    // 60-Second Resend Cooldown Timer
    let cooldownRemaining = 60;
    const cooldownInterval = setInterval(() => {
      cooldownRemaining--;
      if (cooldownRemaining <= 0) {
        clearInterval(cooldownInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend Code';
        }
      } else {
        if (resendSecEl) resendSecEl.textContent = cooldownRemaining.toString();
      }
    }, 1000);

    // Resend Action Click
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        if (!recoveryIdentifier) {
          toastDanger('No recovery identifier found. Please return to step 1.');
          return;
        }
        resendBtn.disabled = true;
        resendBtn.textContent = 'Resending...';
        try {
          const res = await AuthService.forgotPassword(recoveryIdentifier);
          toastSuccess(res.message || 'Fresh recovery code dispatched.', 'Code Sent');
          // Reset cooldown
          cooldownRemaining = 60;
          resendBtn.innerHTML = 'Resend in <span id="resendSeconds">60</span>s';
          // Clear current OTP boxes
          otpBoxes.forEach(b => { b.value = ''; });
          otpBoxes[0]?.focus();
          if (statusMsg) statusMsg.style.display = 'none';
        } catch (err) {
          toastDanger(err.message || 'Failed to resend code.');
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend Code';
        }
      });
    }

    // Accessible 6-Digit Segmented Box Behavior (Type, Paste, Arrows, Backspace)
    function updateMasterCode() {
      const fullCode = otpBoxes.map(b => b.value.trim()).join('');
      if (masterOtpInput) masterOtpInput.value = fullCode;
      return fullCode;
    }

    otpBoxes.forEach((box, idx) => {
      box.addEventListener('input', (e) => {
        const val = box.value.replace(/[^0-9]/g, '');
        box.value = val ? val[0] : '';
        if (box.value && idx < otpBoxes.length - 1) {
          otpBoxes[idx + 1].focus();
        }
        updateMasterCode();
        if (statusMsg) statusMsg.style.display = 'none';
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          otpBoxes[idx - 1].focus();
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          otpBoxes[idx - 1].focus();
        } else if (e.key === 'ArrowRight' && idx < otpBoxes.length - 1) {
          otpBoxes[idx + 1].focus();
        }
      });

      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
        if (pasted) {
          for (let i = 0; i < otpBoxes.length; i++) {
            otpBoxes[i].value = pasted[i] || '';
          }
          const nextFocus = Math.min(pasted.length, otpBoxes.length - 1);
          otpBoxes[nextFocus]?.focus();
          updateMasterCode();
          if (statusMsg) statusMsg.style.display = 'none';
        }
      });
    });

    // Form Submission
    verifyCodeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = updateMasterCode();

      if (!code || code.length !== 6) {
        if (statusMsg) {
          statusMsg.textContent = 'Please enter the complete 6-digit verification code.';
          statusMsg.style.display = 'block';
        }
        const firstEmpty = otpBoxes.find(b => !b.value.trim()) || otpBoxes[0];
        firstEmpty?.focus();
        return;
      }

      submitBtn.disabled = true;
      const origBtnHTML = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Verifying Code...';

      try {
        const idToVerify = recoveryIdentifier || sessionStorage.getItem('devsync_recovery_identifier') || '';
        const verifyRes = await AuthService.verifyRecoveryOtp(idToVerify, code);

        if (!verifyRes || !verifyRes.reset_token) {
          throw new Error(verifyRes?.error || 'Verification failed. Please check the code.');
        }

        clearInterval(expiryInterval);
        // Save verified reset_token safely in sessionStorage
        sessionStorage.setItem('devsync_reset_token', verifyRes.reset_token);
        toastSuccess('Code verified successfully! You may now set your new password.', 'Identity Verified');
        submitBtn.innerHTML = 'Verified &check;';

        setTimeout(() => {
          navigateTo(ROUTES.RESET_PASSWORD || 'reset-password.html');
        }, 700);
      } catch (err) {
        if (statusMsg) {
          statusMsg.textContent = err.message || 'Invalid verification code. Please check the code and try again.';
          statusMsg.style.display = 'block';
        }
        toastDanger(err.message || 'Verification failed.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHTML;
      }
    });
  }

  // -------------------------------------------------------------
  // STEP C & D: SET NEW PASSWORD & SUCCESS CONFIRMATION
  // -------------------------------------------------------------
  const resetForm = document.getElementById('resetPasswordForm');
  if (resetForm) {
    const sectionSetNewPassword = document.getElementById('sectionSetNewPassword');
    const sectionSuccessState = document.getElementById('sectionSuccessState');
    const passInput = resetForm.querySelector('#newPassword');
    const confirmInput = resetForm.querySelector('#confirmPassword');
    const mismatchError = document.getElementById('passwordMismatchError');
    const strengthFill = document.getElementById('strengthFill');
    const strengthLabel = document.getElementById('strengthLabel');
    const strengthCriteria = document.getElementById('strengthCriteria');
    const submitBtn = resetForm.querySelector('button[type="submit"]') || document.getElementById('btnSubmitReset');
    const fallbackGroup = document.getElementById('fallbackCodeGroup');

    // Show/Hide Password Controls
    const toggleBtns = resetForm.querySelectorAll('.recovery-password-toggle');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetInput = document.getElementById(targetId);
        if (!targetInput) return;
        const isPass = targetInput.type === 'password';
        targetInput.type = isPass ? 'text' : 'password';
        btn.innerHTML = isPass
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      });
    });

    // Genuine Password Strength Calculator
    function calculateStrength(pwd) {
      if (!pwd) return { score: 0, label: 'Enter password', fillClass: '', criteria: 'Min. 8 chars' };
      let score = 0;
      if (pwd.length >= 8) score++;
      if (pwd.length >= 10) score++;
      if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
      if (/[0-9]/.test(pwd)) score++;
      if (/[^a-zA-Z0-9]/.test(pwd)) score++;

      if (score < 2 || pwd.length < 8) {
        return { score: 1, label: 'Weak', fillClass: 'strength-weak', criteria: 'Needs 8+ chars & numbers' };
      } else if (score < 4) {
        return { score: 2, label: 'Good', fillClass: 'strength-medium', criteria: 'Add symbols for strong' };
      } else {
        return { score: 3, label: 'Strong', fillClass: 'strength-strong', criteria: 'Excellent security' };
      }
    }

    passInput?.addEventListener('input', () => {
      const res = calculateStrength(passInput.value);
      if (strengthFill) {
        strengthFill.className = `recovery-strength-fill ${res.fillClass}`;
      }
      if (strengthLabel) {
        strengthLabel.textContent = res.label;
      }
      if (strengthCriteria) {
        strengthCriteria.textContent = res.criteria;
      }
      checkMismatch();
    });

    function checkMismatch() {
      if (!confirmInput || !passInput) return true;
      if (confirmInput.value && passInput.value !== confirmInput.value) {
        if (mismatchError) mismatchError.style.display = 'block';
        confirmInput.classList.add('is-invalid');
        return false;
      } else {
        if (mismatchError) mismatchError.style.display = 'none';
        confirmInput.classList.remove('is-invalid');
        return true;
      }
    }

    confirmInput?.addEventListener('input', checkMismatch);

    // If user arrived directly without verified token in sessionStorage:
    const activeResetToken = sessionStorage.getItem('devsync_reset_token');
    const urlParams = new URLSearchParams(window.location.search);
    const directCode = urlParams.get('code');
    const directId = urlParams.get('identifier');

    if (!activeResetToken && (directCode || directId)) {
      if (fallbackGroup) fallbackGroup.style.display = 'block';
      const idFld = document.getElementById('resetIdentifier');
      const codeFld = document.getElementById('resetCode');
      if (idFld && directId) idFld.value = directId;
      if (codeFld && directCode) codeFld.value = directCode;
    }

    // Submit Password Reset
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = (passInput?.value || '').trim();
      const confirmPass = (confirmInput?.value || '').trim();

      if (!newPass || newPass.length < 8) {
        toastDanger('Password must be at least 8 characters with letters and numbers.');
        passInput?.focus();
        return;
      }

      if (newPass !== confirmPass) {
        if (mismatchError) mismatchError.style.display = 'block';
        confirmInput?.focus();
        return;
      }

      let rToken = sessionStorage.getItem('devsync_reset_token');

      // If no token in session, check fallback verification
      if (!rToken) {
        const idFld = document.getElementById('resetIdentifier');
        const codeFld = document.getElementById('resetCode');
        const fallbackId = (idFld?.value || '').trim();
        const fallbackCode = (codeFld?.value || '').trim();

        if (fallbackId && fallbackCode) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="btn-spinner"></span> Verifying Code...';
          try {
            const vRes = await AuthService.verifyRecoveryOtp(fallbackId, fallbackCode);
            rToken = vRes?.reset_token;
          } catch (vErr) {
            toastDanger(vErr.message || 'Code verification failed.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Reset Password &rarr;';
            return;
          }
        } else {
          toastDanger('No verified recovery session found. Please request a verification code first.');
          setTimeout(() => {
            navigateTo(ROUTES.FORGOT_PASSWORD || 'forgot-password.html');
          }, 1200);
          return;
        }
      }

      submitBtn.disabled = true;
      const origBtnHTML = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Updating Password...';

      try {
        const resetRes = await AuthService.resetPassword(rToken, newPass);
        
        // Clear sensitive session tokens
        sessionStorage.removeItem('devsync_reset_token');
        sessionStorage.removeItem('devsync_recovery_identifier');

        // STEP D: SHOW CLEAN SUCCESS STATE (NEVER AUTO-SIGN IN)
        if (sectionSetNewPassword && sectionSuccessState) {
          sectionSetNewPassword.style.display = 'none';
          sectionSuccessState.style.display = 'block';
        } else {
          toastSuccess(resetRes.message || 'Password reset successfully! Please sign in with your new password.', 'Password Reset Complete');
          setTimeout(() => navigateTo(ROUTES.SIGN_IN), 1500);
        }
      } catch (err) {
        toastDanger(err.message || 'Failed to reset password. Token may have expired or new password matches current password.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHTML;
      }
    });
  }
}
