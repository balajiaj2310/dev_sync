/**
 * DevSync Application Configuration
 * Configurable boundary between frontend demo and future Django REST backend
 */

export const APP_CONFIG = {
  appName: 'DevSync',
  version: '1.0.0',
  // When true, all service modules route to local mock data adapter
  demoMode: true,
  // Future Django Backend base endpoint
  apiBaseUrl: '/api/v1',
  requestTimeoutMs: 8000,
  defaultPageSize: 10,
  mockDelayMs: 250,
  storageKeys: {
    authToken: 'devsync_auth_token',
    userSession: 'devsync_user_session',
    theme: 'devsync_theme',
    connections: 'devsync_connections_state'
  }
};
