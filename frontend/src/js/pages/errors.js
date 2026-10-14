/**
 * DevSync Error Pages Controller
 * Handles dynamic navigation, smart retry policies, countdown timers,
 * and rate-limit enforcement for all error pages (401, 403, 404, 405, 429, 500).
 */

import { ROUTES, navigateTo, getBasePath } from '../core/route-config.js';

document.addEventListener('DOMContentLoaded', () => {
  initErrorPageNavigation();
  initErrorSpecificBehaviors();
});

/**
 * Configure all navigation links dynamically using centralized route configuration.
 * Avoids any hardcoded relative path mismatches across different hosting environments.
 */
function initErrorPageNavigation() {
  const base = getBasePath();

  // Header branding & navigation
  const brandLinks = document.querySelectorAll('.header-brand, .footer-brand a');
  brandLinks.forEach(link => {
    link.href = ROUTES.HOME;
  });

  const homeLinks = document.querySelectorAll('[data-route="home"]');
  homeLinks.forEach(link => {
    link.href = ROUTES.HOME;
  });

  const exploreLinks = document.querySelectorAll('[data-route="explore"]');
  exploreLinks.forEach(link => {
    link.href = ROUTES.EXPLORE;
  });

  const pricingLinks = document.querySelectorAll('[data-route="pricing"]');
  pricingLinks.forEach(link => {
    link.href = ROUTES.PRICING;
  });

  const contactLinks = document.querySelectorAll('[data-route="contact"]');
  contactLinks.forEach(link => {
    link.href = ROUTES.CONTACT;
  });

  const signInLinks = document.querySelectorAll('[data-route="sign-in"]');
  signInLinks.forEach(link => {
    // Preserve return URL if specified
    const currentParams = new URLSearchParams(window.location.search);
    const returnUrl = currentParams.get('return_to') || currentParams.get('next');
    if (returnUrl) {
      link.href = `${ROUTES.SIGN_IN}?next=${encodeURIComponent(returnUrl)}`;
    } else {
      link.href = ROUTES.SIGN_IN;
    }
  });

  const signUpLinks = document.querySelectorAll('[data-route="sign-up"]');
  signUpLinks.forEach(link => {
    link.href = ROUTES.SIGN_UP;
  });
}

/**
 * Page-specific behavior logic (429 countdowns, 500 retry handlers, 405 method inspections)
 */
function initErrorSpecificBehaviors() {
  const pageType = document.body.dataset.errorCode;

  // 500: Smart Try Again button
  if (pageType === '500') {
    const btnTryAgain = document.getElementById('btnTryAgain');
    if (btnTryAgain) {
      btnTryAgain.addEventListener('click', (e) => {
        e.preventDefault();
        btnTryAgain.disabled = true;
        btnTryAgain.innerHTML = `
          <svg class="btn-icon-svg" style="animation: rotateSlow 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Retrying...
        `;
        
        setTimeout(() => {
          // If referrer exists and is not an error page, return to it; otherwise reload
          if (document.referrer && !document.referrer.includes('/errors/')) {
            window.location.href = document.referrer;
          } else {
            window.location.reload();
          }
        }, 800);
      });
    }
  }

  // 429: Rate-limit countdown timer
  if (pageType === '429') {
    const urlParams = new URLSearchParams(window.location.search);
    let secondsLeft = parseInt(urlParams.get('retry_after') || urlParams.get('seconds') || '30', 10);
    if (isNaN(secondsLeft) || secondsLeft <= 0) secondsLeft = 30;

    const timerBadge = document.getElementById('rateLimitTimer');
    const timerValue = document.getElementById('timerCountdown');
    const noticeBanner = document.getElementById('rateLimitNotice');
    const btnTryAgainLater = document.getElementById('btnTryAgainLater');

    const updateTimerDisplay = () => {
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (timerValue) {
        timerValue.textContent = formatted;
      }
    };

    updateTimerDisplay();

    const intervalId = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(intervalId);
        if (timerValue) timerValue.textContent = 'Ready';
        if (btnTryAgainLater) {
          btnTryAgainLater.classList.remove('btn-error-primary');
          btnTryAgainLater.classList.add('btn-error-primary');
          btnTryAgainLater.innerHTML = `
            <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Retry Request Now
          `;
          btnTryAgainLater.addEventListener('click', (e) => {
            e.preventDefault();
            if (document.referrer && !document.referrer.includes('/errors/')) {
              window.location.href = document.referrer;
            } else {
              window.location.href = ROUTES.HOME;
            }
          });
        }
      } else {
        updateTimerDisplay();
      }
    }, 1000);

    if (btnTryAgainLater) {
      btnTryAgainLater.addEventListener('click', (e) => {
        if (secondsLeft > 0) {
          e.preventDefault();
          if (noticeBanner) {
            noticeBanner.classList.add('show');
            noticeBanner.textContent = `Rate limit is active. Please wait ${secondsLeft}s before retrying.`;
            setTimeout(() => noticeBanner.classList.remove('show'), 3500);
          }
        }
      });
    }
  }

  // 405: Inspect method param if present
  if (pageType === '405') {
    const urlParams = new URLSearchParams(window.location.search);
    const requestedMethod = (urlParams.get('method') || '').toUpperCase();
    if (requestedMethod) {
      const methodDisplay = document.getElementById('requestedMethodName');
      if (methodDisplay) {
        methodDisplay.textContent = requestedMethod;
      }
    }
  }
}
