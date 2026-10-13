/**
 * DevSync Route Configuration
 * Centralized mapping for all public, auth, app, and error routes
 */

export const ROUTES = {
  // Public
  HOME: '/frontend/src/pages/public/home.html',
  EXPLORE: '/frontend/src/pages/public/explore.html',
  PRICING: '/frontend/src/pages/public/pricing.html',
  CONTACT: '/frontend/src/pages/public/contact.html',

  // Auth
  SIGN_IN: '/frontend/src/pages/auth/sign-in.html',
  SIGN_UP: '/frontend/src/pages/auth/sign-up.html',
  FORGOT_PASSWORD: '/frontend/src/pages/auth/forgot-password.html',
  RESET_PASSWORD: '/frontend/src/pages/auth/reset-password.html',

  // Dashboard & Apps
  OVERVIEW: '/frontend/src/pages/dashboard/overview.html',

  REPOSITORIES: '/frontend/src/pages/repositories/list.html',
  REPOSITORY_DETAIL: '/frontend/src/pages/repositories/detail.html',
  REPOSITORY_CREATE: '/frontend/src/pages/repositories/create.html',
  REPOSITORY_FILES: '/frontend/src/pages/repositories/files.html',
  REPOSITORY_COMMITS: '/frontend/src/pages/repositories/commits.html',
  REPOSITORY_BRANCHES: '/frontend/src/pages/repositories/branches.html',

  PULL_REQUESTS: '/frontend/src/pages/pull-requests/list.html',
  PULL_REQUEST_DETAIL: '/frontend/src/pages/pull-requests/detail.html',
  PULL_REQUEST_CREATE: '/frontend/src/pages/pull-requests/create.html',

  ISSUES: '/frontend/src/pages/issues/list.html',
  ISSUE_DETAIL: '/frontend/src/pages/issues/detail.html',
  ISSUE_CREATE: '/frontend/src/pages/issues/create.html',

  TEAMS: '/frontend/src/pages/teams/list.html',
  TEAM_DETAIL: '/frontend/src/pages/teams/detail.html',
  TEAM_MEMBERS: '/frontend/src/pages/teams/members.html',

  DEVELOPERS: '/frontend/src/pages/developers/discover.html',
  DEVELOPER_PROFILE: '/frontend/src/pages/developers/profile.html',
  CONNECTIONS: '/frontend/src/pages/developers/connections.html',

  COMMUNITY: '/frontend/src/pages/community/index.html',
  COMMUNITY_CHANNEL: '/frontend/src/pages/community/channel.html',

  ASSISTANT: '/frontend/src/pages/assistant/index.html',
  ANALYTICS: '/frontend/src/pages/analytics/index.html',
  PROFILE_EDIT: '/frontend/src/pages/profile/edit.html',
  NOTIFICATIONS: '/frontend/src/pages/notifications/index.html',

  SETTINGS_ACCOUNT: '/frontend/src/pages/settings/account.html',
  SETTINGS_PRIVACY: '/frontend/src/pages/settings/privacy.html',
  SETTINGS_PREFERENCES: '/frontend/src/pages/settings/preferences.html',

  // Errors
  ERROR_401: '/frontend/src/pages/errors/401.html',
  ERROR_403: '/frontend/src/pages/errors/403.html',
  ERROR_404: '/frontend/src/pages/errors/404.html',
  ERROR_405: '/frontend/src/pages/errors/405.html',
  ERROR_429: '/frontend/src/pages/errors/429.html',
  ERROR_500: '/frontend/src/pages/errors/500.html'
};

export function navigateTo(route) {
  if (route) {
    window.location.href = route;
  }
}
