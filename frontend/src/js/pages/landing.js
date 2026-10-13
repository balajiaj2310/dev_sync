/**
 * DevSync Landing Page Controller
 */

import { ROUTES, navigateTo } from '../core/route-config.js';
import { toastInfo } from '../components/toast.js';

export function initLandingPage() {
  // Get Started action buttons
  document.querySelectorAll('[data-action="get-started"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(ROUTES.SIGN_UP);
    });
  });

  // Sign in buttons
  document.querySelectorAll('[data-action="sign-in"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(ROUTES.SIGN_IN);
    });
  });

  // Explore projects
  document.querySelectorAll('[data-action="explore-projects"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(ROUTES.EXPLORE);
    });
  });

  // Public search bar button
  const searchBtn = document.querySelector('.btn-icon-search');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      toastInfo('Search is ready. Sign in to browse all repositories & code.');
    });
  }
}
