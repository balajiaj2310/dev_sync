/**
 * DevSync Route Configuration
 * Centralized mapping for all public, auth, app, and error routes.
 * Automatically resolves base path dynamically based on runtime location,
 * eliminating the previous redirect bug between /frontend/src and /src.
 */

export function getBasePath() {
  if (typeof window !== 'undefined' && window.location) {
    const p = window.location.pathname;
    if (p.includes('/frontend/src/')) {
      return '/frontend/src/pages';
    }
    if (p.includes('/src/')) {
      return '/src/pages';
    }
  }
  return '/src/pages';
}

export function getPublicAssetPath(assetRelativePath) {
  if (typeof window !== 'undefined' && window.location) {
    const p = window.location.pathname;
    const prefix = p.includes('/frontend/src/') ? '/frontend/public/' : '/public/';
    return `${prefix}${assetRelativePath.replace(/^\//, '')}`;
  }
  return `/public/${assetRelativePath.replace(/^\//, '')}`;
}

export const ROUTES = {
  get BASE() { return getBasePath(); },

  // Public
  get HOME() { return `${getBasePath()}/public/home.html`; },
  get EXPLORE() { return `${getBasePath()}/public/explore.html`; },
  get PRICING() { return `${getBasePath()}/public/pricing.html`; },
  get CONTACT() { return `${getBasePath()}/public/contact.html`; },

  // Auth
  get SIGN_IN() { return `${getBasePath()}/auth/sign-in.html`; },
  get SIGN_UP() { return `${getBasePath()}/auth/sign-up.html`; },
  get FORGOT_PASSWORD() { return `${getBasePath()}/auth/forgot-password.html`; },
  get RESET_PASSWORD() { return `${getBasePath()}/auth/reset-password.html`; },

  // Dashboard & Apps
  get OVERVIEW() { return `${getBasePath()}/dashboard/overview.html`; },

  get REPOSITORIES() { return `${getBasePath()}/repositories/list.html`; },
  get REPOSITORY_DETAIL() { return `${getBasePath()}/repositories/detail.html`; },
  get REPOSITORY_CREATE() { return `${getBasePath()}/repositories/create.html`; },
  get REPOSITORY_FILES() { return `${getBasePath()}/repositories/files.html`; },
  get REPOSITORY_COMMITS() { return `${getBasePath()}/repositories/commits.html`; },
  get REPOSITORY_BRANCHES() { return `${getBasePath()}/repositories/branches.html`; },

  get PULL_REQUESTS() { return `${getBasePath()}/pull-requests/list.html`; },
  get PULL_REQUEST_DETAIL() { return `${getBasePath()}/pull-requests/detail.html`; },
  get PULL_REQUEST_CREATE() { return `${getBasePath()}/pull-requests/create.html`; },

  get ISSUES() { return `${getBasePath()}/issues/list.html`; },
  get ISSUE_DETAIL() { return `${getBasePath()}/issues/detail.html`; },
  get ISSUE_CREATE() { return `${getBasePath()}/issues/create.html`; },

  get TEAMS() { return `${getBasePath()}/teams/list.html`; },
  get TEAM_DETAIL() { return `${getBasePath()}/teams/detail.html`; },
  get TEAM_MEMBERS() { return `${getBasePath()}/teams/members.html`; },

  get DEVELOPERS() { return `${getBasePath()}/developers/discover.html`; },
  get DEVELOPER_PROFILE() { return `${getBasePath()}/developers/profile.html`; },
  get CONNECTIONS() { return `${getBasePath()}/developers/connections.html`; },

  get COMMUNITY() { return `${getBasePath()}/community/index.html`; },
  get COMMUNITY_CHANNEL() { return `${getBasePath()}/community/channel.html`; },

  get ASSISTANT() { return `${getBasePath()}/assistant/index.html`; },
  get ANALYTICS() { return `${getBasePath()}/analytics/index.html`; },
  get PROFILE_EDIT() { return `${getBasePath()}/profile/edit.html`; },
  get NOTIFICATIONS() { return `${getBasePath()}/notifications/index.html`; },

  get SETTINGS_ACCOUNT() { return `${getBasePath()}/settings/account.html`; },
  get SETTINGS_PRIVACY() { return `${getBasePath()}/settings/privacy.html`; },
  get SETTINGS_PREFERENCES() { return `${getBasePath()}/settings/preferences.html`; },

  // Errors
  get ERROR_401() { return `${getBasePath()}/errors/401.html`; },
  get ERROR_403() { return `${getBasePath()}/errors/403.html`; },
  get ERROR_404() { return `${getBasePath()}/errors/404.html`; },
  get ERROR_405() { return `${getBasePath()}/errors/405.html`; },
  get ERROR_429() { return `${getBasePath()}/errors/429.html`; },
  get ERROR_500() { return `${getBasePath()}/errors/500.html`; }
};

export function navigateTo(route) {
  if (route) {
    window.location.href = route;
  }
}
