/**
 * DevSync Search Suggestions Component
 */

import { ROUTES, navigateTo } from '../core/route-config.js';

export function initGlobalSearch() {
  const searchInput = document.querySelector('.topbar-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        // Navigate to repositories list with search parameter
        navigateTo(`${ROUTES.REPOSITORIES}?q=${encodeURIComponent(query)}`);
      }
    }
  });
}
