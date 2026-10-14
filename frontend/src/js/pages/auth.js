/**
 * DevSync Authentication Page Controller
 */

import { AuthService } from '../services/auth-service.js';
import { ROUTES, navigateTo } from '../core/route-config.js';
import { isValidEmail, isValidPassword } from '../core/validators.js';
import { toastSuccess, toastDanger } from '../components/toast.js';

export function initAuthPage() {
  // If already authenticated, redirect to overview immediately
  if (AuthService.isAuthenticated()) {
    const urlParams = new URLSearchParams(window.location.search);
    let destination = urlParams.get('redirect');
    if (!destination || destination.includes('sign-in') || destination.includes('login') || destination.includes('sign-up')) {
      destination = ROUTES.OVERVIEW;
    }
    window.location.replace(destination);
    return;
  }

  // Password Visibility Toggle
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.password-input-wrapper');
      const input = wrapper?.querySelector('input');
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
        } else {
          input.type = 'password';
          btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      }
    });
  });

  // Sign In Form
  const signInForm = document.getElementById('signInForm');
  if (signInForm && !signInForm.dataset.initialized) {
    signInForm.dataset.initialized = 'true';

    const submitBtn = document.getElementById('signInSubmitBtn') || signInForm.querySelector('button[type="submit"]');
    let isSubmitting = false;

    async function handleSignIn(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (isSubmitting) return false;

      const emailInput = signInForm.querySelector('#email');
      const passInput = signInForm.querySelector('#password');

      if (!emailInput || !passInput) return false;

      const emailVal = emailInput.value.trim();
      const passVal = passInput.value;

      if (!emailVal) {
        toastDanger('Please enter your email address.');
        emailInput.focus();
        return false;
      }

      if (!passVal) {
        toastDanger('Please enter your password.');
        passInput.focus();
        return false;
      }

      if (passVal.length < 6) {
        toastDanger('Password must be at least 6 characters.');
        passInput.focus();
        return false;
      }

      isSubmitting = true;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Signing In...';
      }

      try {
        const res = await AuthService.signIn({ email: emailVal, password: passVal });
        const userName = res.user?.name || 'Developer';
        toastSuccess(`Welcome back, ${userName}! Redirecting to workspace...`, 'Signed In');

        // Honor ?redirect= parameter or default to Overview
        const urlParams = new URLSearchParams(window.location.search);
        let destination = urlParams.get('redirect');
        if (!destination || destination.includes('sign-in') || destination.includes('login') || destination.includes('sign-up')) {
          destination = ROUTES.OVERVIEW;
        }

        setTimeout(() => {
          window.location.replace(destination);
        }, 150);
      } catch (err) {
        isSubmitting = false;
        toastDanger(err.message || 'Invalid email or password. Please verify your credentials and try again.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Sign In &rarr;';
        }
      }
      return false;
    }

    function onSubmitWrapper(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      handleSignIn(e);
      return false;
    }

    signInForm.onsubmit = onSubmitWrapper;
    signInForm.addEventListener('submit', onSubmitWrapper);
    if (submitBtn) {
      submitBtn.addEventListener('click', onSubmitWrapper);
    }
  }

  // Sign Up Form
  const signUpForm = document.getElementById('signUpForm');
  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = signUpForm.querySelector('#name');
      const emailInput = signUpForm.querySelector('#email');
      const passInput = signUpForm.querySelector('#password');
      const submitBtn = signUpForm.querySelector('button[type="submit"]');

      if (!nameInput.value.trim()) {
        toastDanger('Please enter your full name.');
        return;
      }
      if (!isValidEmail(emailInput.value)) {
        toastDanger('Please enter a valid email address.');
        return;
      }
      if (!isValidPassword(passInput.value)) {
        toastDanger('Password must be at least 8 characters.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Creating Account...';

      try {
        await AuthService.signUp({ name: nameInput.value, email: emailInput.value });
        toastSuccess('Account created successfully! Taking you to your dashboard...', 'Welcome to DevSync');
        setTimeout(() => navigateTo(ROUTES.OVERVIEW), 700);
      } catch (err) {
        toastDanger(err.message || 'Registration failed.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Account';
      }
    });
  }

  // Forgot Password Form
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

  // Reset Password Form
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
