/**
 * DevSync Header & Topbar Component
 */

import { ROUTES, navigateTo } from '../core/route-config.js';
import { AuthService } from '../services/auth-service.js';

export function initHeader() {
  // Mobile nav toggle on public header
  const mobileToggle = document.querySelector('.public-mobile-toggle');
  const publicNav = document.querySelector('.public-nav');
  if (mobileToggle && publicNav) {
    mobileToggle.addEventListener('click', () => {
      publicNav.classList.toggle('open');
    });
  }

  // Profile dropdown toggle on authenticated topbar
  const profileBtn = document.querySelector('.user-profile-btn');
  const profileMenu = document.querySelector('.profile-dropdown-menu');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
        profileMenu.classList.remove('show');
      }
    });
  }

  // Sign out button
  const signOutBtn = document.querySelector('[data-action="sign-out"]');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await AuthService.signOut();
      navigateTo(ROUTES.SIGN_IN);
    });
  }

  // Dynamic topbar session hydration
  const currentUser = AuthService.getCurrentUserSession();
  if (currentUser) {
    const avatarEls = document.querySelectorAll('.user-avatar');
    avatarEls.forEach(img => {
      if (currentUser.avatar) img.src = currentUser.avatar;
      img.alt = currentUser.name || currentUser.username;
    });

    const nameEls = document.querySelectorAll('.user-name');
    nameEls.forEach(el => {
      el.textContent = currentUser.name || currentUser.username;
    });

    const roleEls = document.querySelectorAll('.user-role');
    roleEls.forEach(el => {
      if (currentUser.role) el.textContent = currentUser.role;
    });

    const dropdownHeader = document.querySelector('.dropdown-header');
    if (dropdownHeader) {
      dropdownHeader.textContent = `Signed in as @${currentUser.username}`;
    }

    const topbarUserLink = document.getElementById('topbarUserLink');
    if (topbarUserLink) {
      topbarUserLink.href = `/developers/${encodeURIComponent(currentUser.username)}/`;
    }

    const dropdownProfileLinks = document.querySelectorAll('.dropdown-item');
    dropdownProfileLinks.forEach(link => {
      if (link.textContent.includes('View Profile')) {
        link.href = `/developers/${encodeURIComponent(currentUser.username)}/`;
      }
    });
  }

  // Global search shortcut (Ctrl+K / Cmd+K)
  const searchInput = document.querySelector('.topbar-search-input');
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}
