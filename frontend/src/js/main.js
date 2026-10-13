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
import { initCommunityPage } from './pages/community.js';
import { initAssistantPage } from './pages/assistant.js';
import { initAnalyticsPage } from './pages/analytics.js';
import { initProfilePage } from './pages/profile.js';
import { initNotificationsPage } from './pages/notifications.js';
import { initSettingsPage } from './pages/settings.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Global Shared Components
  initHeader();
  initSidebar();
  initDropdowns();
  initModals();
  initGlobalSearch();

  // Route/Page Controller Dispatcher
  const pageId = document.body.getAttribute('data-page');

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
    case 'developers':
      initDevelopersPage();
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
});
