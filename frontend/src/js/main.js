/**
 * DevSync Main Application Entry Point
 * Orchestrates shared UI components, routers, and page controllers
 */

import { initHeader } from './components/header.js';
import { initSidebar } from './components/sidebar.js';
import { initDropdowns } from './components/dropdown.js';
import { initModals } from './components/modal.js';
import { initGlobalSearch } from './components/search.js';

// Page Initializers
import { initLandingPage } from './pages/landing.js';
import { initAuthPage } from './pages/auth.js';
import { initDashboardPage } from './pages/dashboard.js';
import { initRepositoriesPage } from './pages/repositories.js';
import { initPullRequestsPage } from './pages/pull-requests.js';
import { initIssuesPage } from './pages/issues.js';
import { initTeamsPage } from './pages/teams.js';
import { initDevelopersPage } from './pages/developers.js';
import { initDeveloperProfilePage } from './pages/developer-profile.js';
import { initCommunityPage } from './pages/community.js';
import { initAssistantPage } from './pages/assistant.js';
import { initAnalyticsPage } from './pages/analytics.js';
import { initProfilePage } from './pages/profile.js';
import { initNotificationsPage } from './pages/notifications.js';
import { initSettingsPage } from './pages/settings.js';

import { AuthService } from './services/auth-service.js';
import { ROUTES } from './core/route-config.js';

// Expose DevSyncAuth global helper for authenticated components and widgets
window.DevSyncAuth = window.DevSyncAuth || {
  getAccessToken: () => localStorage.getItem('devsync_auth_token') || '',
  getUser: () => AuthService.getCurrentUserSession(),
  isAuthenticated: () => AuthService.isAuthenticated()
};

function enforceRouteGuards() {
  const isAuth = AuthService.isAuthenticated();
  const pageId = document.body.getAttribute('data-page');
  const isProtected = document.body.getAttribute('data-authenticated') === 'true';

  // 1. Unauthenticated users accessing protected routes redirected to login
  if (isProtected && !isAuth) {
    const currentDest = window.location.pathname + window.location.search;
    window.location.replace(`${ROUTES.SIGN_IN}?redirect=${encodeURIComponent(currentDest)}`);
    return false;
  }

  // 2. Authenticated users visiting login/signup redirected to target or dashboard
  if (isAuth && pageId === 'auth') {
    const urlParams = new URLSearchParams(window.location.search);
    let destination = urlParams.get('redirect');
    if (!destination || destination.includes('sign-in') || destination.includes('login') || destination.includes('sign-up')) {
      destination = ROUTES.OVERVIEW;
    }
    window.location.replace(destination);
    return false;
  }

  return true;
}

function boot() {
  if (!enforceRouteGuards()) {
    return;
  }

  // Initialize Global Shared Components safely
  try { initHeader(); } catch (e) { console.warn('Header init error:', e); }
  try { initSidebar(); } catch (e) { console.warn('Sidebar init error:', e); }
  try { initDropdowns(); } catch (e) { console.warn('Dropdowns init error:', e); }
  try { initModals(); } catch (e) { console.warn('Modals init error:', e); }
  try { initGlobalSearch(); } catch (e) { console.warn('GlobalSearch init error:', e); }

  // Route/Page Controller Dispatcher
  const pageId = document.body.getAttribute('data-page');

  try {
    switch (pageId) {
      case 'landing':
      case 'explore':
      case 'pricing':
      case 'contact':
        initLandingPage();
        break;
      case 'auth':
        initAuthPage();
        break;
      case 'dashboard':
        initDashboardPage();
        break;
      case 'repositories':
        initRepositoriesPage();
        break;
      case 'pull-requests':
        initPullRequestsPage();
        break;
      case 'issues':
        initIssuesPage();
        break;
      case 'teams':
        initTeamsPage();
        break;
      case 'developer-profile':
        initDeveloperProfilePage();
        break;
      case 'developers':
        if (document.getElementById('devProfileRoot')) {
          initDeveloperProfilePage();
        } else {
          initDevelopersPage();
        }
        break;
      case 'community':
        initCommunityPage();
        break;
      case 'assistant':
        initAssistantPage();
        break;
      case 'analytics':
        initAnalyticsPage();
        break;
      case 'profile':
        initProfilePage();
        break;
      case 'notifications':
        initNotificationsPage();
        break;
      case 'settings':
        initSettingsPage();
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Error initializing controller for page [${pageId}]:`, err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
