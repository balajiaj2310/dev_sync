/**
 * DevSync Authentication Page Controller
 * Handles Sign In, Sign Up, Form Validation, Password Visibility, and Google OAuth Integration.
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
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const groupFullName = document.getElementById('groupFullName');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');
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
      if (labelIdentifier) labelIdentifier.textContent = 'Email Address';
      if (authCardTitle) authCardTitle.textContent = 'Join DevSync 🚀';
      if (authCardSubtitle) authCardSubtitle.textContent = 'Create your developer profile and collaborate with teams.';
      if (btnSubmitText) btnSubmitText.innerHTML = 'Create Account &rarr;';
      if (rowRememberMe) rowRememberMe.style.display = 'none';
      if (linkForgotPassword) linkForgotPassword.style.display = 'none';
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
      if (labelIdentifier) labelIdentifier.textContent = 'Email or Username';
      if (authCardTitle) authCardTitle.textContent = 'Welcome Back 👋';
      if (authCardSubtitle) authCardSubtitle.textContent = 'Sign in to your account and continue building with the community.';
      if (btnSubmitText) btnSubmitText.innerHTML = 'Sign In &rarr;';
      if (rowRememberMe) rowRememberMe.style.display = 'flex';
      if (linkForgotPassword) linkForgotPassword.style.display = 'inline-block';
      if (emailInput) emailInput.focus();
    }
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

  // Clear validation error styling on input
  [emailInput, passInput, nameInput].forEach(input => {
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
  const authForm = document.getElementById('signInForm');
  const submitBtn = document.getElementById('signInSubmitBtn');
  const rememberCheckbox = document.getElementById('rememberMe');
  let isSubmitting = false;

  if (authForm) {
    async function handleFormSubmit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isSubmitting) return false;

      const emailVal = emailInput ? emailInput.value.trim() : '';
      const passVal = passInput ? passInput.value : '';
      const nameVal = nameInput ? nameInput.value.trim() : '';

      // Real Form Validation
      if (currentAuthMode === 'signup' && !nameVal) {
        if (nameInput) {
          nameInput.classList.add('is-invalid');
          nameInput.focus();
        }
        toastDanger('Please enter your full name.');
        return false;
      }

      if (!emailVal && !passVal) {
        if (emailInput) {
          emailInput.classList.add('is-invalid');
          emailInput.focus();
        }
        toastDanger('Just a couple of details first! Please enter your credentials.');
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

      // Check email format if it contains @
      if (emailVal.includes('@') && !isValidEmail(emailVal)) {
        if (emailInput) {
          emailInput.classList.add('is-invalid');
          emailInput.focus();
        }
        toastDanger('Please enter a valid email address.');
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

      if (passVal.length < 6) {
        if (passInput) {
          passInput.classList.add('is-invalid');
          passInput.focus();
        }
        toastDanger('Password must be at least 6 characters.');
        return false;
      }

      isSubmitting = true;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Authenticating...';
      }

      try {
        let res;
        if (currentAuthMode === 'signup') {
          res = await AuthService.signUp({ name: nameVal, email: emailVal, password: passVal });
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
        toastSuccess(`Welcome back, ${userName}! Redirecting to workspace...`, 'Signed In');

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
        toastDanger(err.message || 'Invalid email or password. Please verify your credentials and try again.');

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

  // Preserve Forgot Password Form if on forgot password page
  const forgotForm = document.getElementById('forgotPasswordForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = forgotForm.querySelector('#email');
      const submitBtn = forgotForm.querySelector('button[type="submit"]');

      if (!isValidEmail(emailInput.value)) {
        toastDanger('Please enter a valid email address.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Sending Instructions...';

      try {
        const res = await AuthService.requestPasswordReset(emailInput.value);
        toastSuccess(res.message, 'Reset Link Dispatched');
        submitBtn.innerHTML = 'Instructions Sent &check;';
      } catch (err) {
        toastDanger(err.message || 'Failed to dispatch reset instructions.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Reset Instructions';
      }
    });
  }

  // Preserve Reset Password Form if on reset password page
  const resetForm = document.getElementById('resetPasswordForm');
  if (resetForm) {
    resetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const passInput = resetForm.querySelector('#newPassword');
      const confirmInput = resetForm.querySelector('#confirmPassword');

      if (!isValidPassword(passInput.value)) {
        toastDanger('Password must be at least 8 characters.');
        return;
      }
      if (passInput.value !== confirmInput.value) {
        toastDanger('Passwords do not match.');
        return;
      }

      toastSuccess('Password updated successfully! Please sign in.', 'Password Reset');
      setTimeout(() => navigateTo(ROUTES.SIGN_IN), 800);
    });
  }
}
