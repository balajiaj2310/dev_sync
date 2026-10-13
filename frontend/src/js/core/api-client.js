/**
 * DevSync API Client
 * Clean integration boundary between Mock Adapter and future Django REST Backend
 */

import { APP_CONFIG } from '../config/app-config.js';
import { MockAPI } from '../mock/mock-api.js';

class ApiClient {
  constructor() {
    this.baseUrl = APP_CONFIG.apiBaseUrl;
    this.demoMode = APP_CONFIG.demoMode;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    const token = localStorage.getItem(APP_CONFIG.storageKeys.authToken);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Include Django CSRF token if cookie exists
    const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
    if (csrfMatch) {
      headers['X-CSRFToken'] = csrfMatch[1];
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    if (this.demoMode) {
      console.info(`[DevSync API Mock] Intercepted call to ${endpoint}`);
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.requestTimeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP Error ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection.');
      }
      throw err;
    }
  }

  get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
  patch(endpoint, body) { return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }); }
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
}

export const apiClient = new ApiClient();
export { MockAPI };
