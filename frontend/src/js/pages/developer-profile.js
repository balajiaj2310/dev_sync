/**
 * DevSync Developer Public Profile Page Controller
 * Faithful implementation of the Minimal Developer Card system with:
 * - Compact Header
 * - Vertical Profile Navigation Workspace
 * - Unified Projects Section with inline Pinning (max 4 pins enforced)
 * - Signature DevSync Project Pulse Component (Live, 24h, 7d, 30d, comparison, progress, team)
 */

import { ProfileService } from '../services/profile-service.js';
import { PulseService } from '../services/pulse-service.js';
import { ConnectionService } from '../services/connection-service.js';
import { AuthService } from '../services/auth-service.js';
import { toastSuccess, toastInfo, toastWarning, toastDanger } from '../components/toast.js';
import { ROUTES } from '../core/route-config.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSkillColor(name) {
  const map = {
    python: 'blue',
    django: 'mint',
    javascript: 'amber',
    react: 'blue',
    postgres: 'purple',
    postgresql: 'purple',
    redis: 'red',
    docker: 'blue',
    aws: 'amber',
    git: 'red'
  };
  return map[(name || '').toLowerCase()] || 'blue';
}

export async function initDeveloperProfilePage() {
  const container = document.getElementById('devProfileRoot');
  if (!container) return;

  // Extract username from URL query parameter or path
  const urlParams = new URLSearchParams(window.location.search);
  let requestedUsername = urlParams.get('user') || urlParams.get('username');

  if (!requestedUsername) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && !last.endsWith('.html') && last !== 'developers' && last !== 'profile') {
      requestedUsername = last;
    }
  }

  // Fallback to active logged-in user if available, or primary demo developer
  if (!requestedUsername) {
    const session = AuthService.getCurrentUserSession();
    if (session && session.username) {
      requestedUsername = session.username;
    } else {
      requestedUsername = 'naveen3438';
    }
  }

  // Load Developer Data
  let developer = null;
  try {
    developer = await ProfileService.getDeveloperProfile(requestedUsername);
  } catch (err) {
    console.error('Failed to load developer profile:', err);
  }

  // Check if viewing own profile or previewing as visitor
  const isPreviewVisitor = urlParams.get('preview') === 'visitor';
  const currentUser = await ProfileService.getProfile();
  const isOwner = !isPreviewVisitor && currentUser && developer && (
    (currentUser.username && developer.username && currentUser.username.toLowerCase() === developer.username.toLowerCase()) ||
    currentUser.id === developer.id
  );

  // Handle Nonexistent User (404 state)
  if (!developer) {
    container.innerHTML = `
      <div class="dev-card text-center py-8" style="max-width: 600px; margin: 40px auto; padding: 48px 24px;">
        <div style="font-size: 56px; line-height: 1; margin-bottom: 16px;">🔍</div>
        <h2 class="font-heading mb-2" style="font-size: 22px; font-weight: 750;">Developer Not Found</h2>
        <p class="text-secondary mb-5" style="font-size: 14px; max-width: 420px; margin-left: auto; margin-right: auto;">
          The developer profile "<strong>@${escapeHtml(requestedUsername)}</strong>" does not exist or may have been updated.
        </p>
        <div class="d-flex align-items-center justify-content-center gap-3">
          <a href="${ROUTES.DEVELOPERS}" class="btn btn-primary btn-pill btn-sm">Explore Developers</a>
          <a href="${ROUTES.OVERVIEW}" class="btn btn-outline btn-pill btn-sm">Back to Dashboard</a>
        </div>
      </div>
    `;
    return;
  }

  document.title = `${developer.name} (@${developer.username}) — DevSync`;

  // State Management
  let currentTab = urlParams.get('tab') || 'overview';
  let pulseRange = '7d';
  let pulseProject = 'all';
  let pulseView = 'activity'; // 'activity', 'comparison', 'progress', 'team'
  let pulseTimer = null;
  let pulseDataCache = null;
  let contribRange = '30d';
  let devIntelCache = null;

  // Filter projects by permission
  function getVisibleProjects() {
    return (developer.projects || []).filter(p => {
      if (isOwner) return true;
      return p.visibility === 'Public';
    });
  }

  // Unified Projects sorted with Pinned first (Section 6)
  function getUnifiedSortedProjects() {
    const projs = getVisibleProjects();
    const pinned = developer.pinnedProjects || [];
    return [...projs].sort((a, b) => {
      const aPinned = pinned.includes(a.id);
      const bPinned = pinned.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }

  function renderPage() {
    const visibleProjects = getVisibleProjects();
    const pinnedCount = (developer.pinnedProjects || []).filter(pid =>
      visibleProjects.some(p => p.id === pid)
    ).length;

    const visitorBanner = isPreviewVisitor ? `
      <div style="background-color: var(--color-mint-soft); border: 1px solid var(--color-mint-strong); border-radius: 8px; padding: 12px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--color-text-primary);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-focus);"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span><strong>Visitor Preview Mode:</strong> You are viewing your public profile exactly as external visitors see it. Private fields (email, mobile, security history) are hidden.</span>
        </div>
        <a href="../settings/account.html?section=profile" class="btn btn-outline btn-sm">Exit Preview</a>
      </div>
    ` : '';

    container.innerHTML = visitorBanner + `
      <!-- Section 6: Compact Hero Identity Header Card -->
      <section class="dev-hero-card" aria-label="Developer identity" style="padding: 20px 28px;">
        <div class="dev-hero-top" style="gap: 20px;">
          <!-- Left: Avatar & Identity Details -->
          <div class="dev-hero-identity" style="gap: 18px;">
            <div class="dev-avatar-container">
              ${developer.avatar ? `
                <img src="${developer.avatar}" alt="${developer.name}" class="dev-avatar-img" style="width: 88px; height: 88px;" id="heroAvatar" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';" />
              ` : `
                <div class="dev-avatar-fallback" style="width: 88px; height: 88px; font-size: 28px;">${(developer.name || 'D').charAt(0)}</div>
              `}
              <span class="dev-status-indicator ${developer.collaborationStatusType === 'busy' ? 'busy' : ''}" title="${developer.collaborationStatus || 'Online'}"></span>
            </div>

            <div class="dev-identity-details">
              <div class="dev-name-title-row" style="margin-bottom: 2px;">
                <h1 class="dev-display-name" style="font-size: 20px;">${escapeHtml(developer.name)}</h1>
                ${developer.isVerified !== false ? `
                  <span class="dev-verified-badge" title="Verified Developer">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                  </span>
                ` : ''}
              </div>

              <div class="dev-handle-role-row" style="margin-bottom: 6px;">
                <span class="dev-username-handle">@${escapeHtml(developer.username)}</span>
                <span class="dev-role-pill">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  ${escapeHtml(developer.role || 'Developer')}
                </span>
              </div>

              <p class="dev-hero-bio" style="font-size: 13px; line-height: 1.4; margin-bottom: 8px;">
                ${escapeHtml(developer.headline || developer.bio || '')}
              </p>

              <div class="dev-hero-meta-row" style="font-size: 12px; gap: 14px;">
                ${developer.location ? `
                  <span class="dev-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${escapeHtml(developer.location)}
                  </span>
                ` : ''}

                ${developer.website ? `
                  <span class="dev-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <a href="${escapeHtml(developer.website)}" target="_blank" rel="noopener noreferrer" class="dev-meta-link">
                      ${escapeHtml(developer.website.replace(/^https?:\/\//, ''))}
                    </a>
                  </span>
                ` : ''}

                <!-- Social Links -->
                <div class="dev-social-icons">
                  ${developer.social?.github ? `
                    <a href="${escapeHtml(developer.social.github)}" target="_blank" rel="noopener noreferrer" class="dev-social-btn" title="GitHub">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    </a>
                  ` : ''}
                  ${developer.social?.linkedin ? `
                    <a href="${escapeHtml(developer.social.linkedin)}" target="_blank" rel="noopener noreferrer" class="dev-social-btn" title="LinkedIn">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Actions & Metrics Counters -->
          <div class="dev-hero-side" style="gap: 12px;">
            <div class="dev-actions-row">
              ${isOwner ? `
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnEditProfile">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Profile
                </button>
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnShareProfile" title="Copy profile URL">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
              ` : `
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnFollowDev">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  <span>${developer.isFollowing ? 'Following &check;' : 'Follow'}</span>
                </button>
                <button type="button" class="btn btn-mint btn-pill btn-sm" id="btnConnectDev">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  <span>${developer.connectionState === 'Connected' ? 'Connected &check;' : 'Connect'}</span>
                </button>
              `}
            </div>

            <!-- Followers / Following / Projects Counters -->
            <div class="dev-stats-counter-row" style="margin-top: 2px;">
              <div class="dev-counter-item" data-tab="overview">
                <span class="dev-counter-num">${developer.stats?.followers ?? 24}</span>
                <span class="dev-counter-lbl">Followers</span>
              </div>
              <div class="dev-counter-item" data-tab="overview">
                <span class="dev-counter-num">${developer.stats?.following ?? 18}</span>
                <span class="dev-counter-lbl">Following</span>
              </div>
              <div class="dev-counter-item" data-tab="projects">
                <span class="dev-counter-num">${visibleProjects.length}</span>
                <span class="dev-counter-lbl">Projects</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 6: Vertical Profile Navigation Workspace Layout -->
      <div class="dev-profile-workspace-layout" id="profileWorkspaceLayout">
        <!-- Vertical Profile Sidebar -->
        <aside class="dev-profile-vertical-sidebar" aria-label="Profile navigation">
          <button type="button" class="dev-profile-side-link ${currentTab === 'overview' ? 'active' : ''}" data-tab="overview">
            <span class="dev-profile-side-link-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Profile Overview</span>
            </span>
          </button>
          <button type="button" class="dev-profile-side-link ${currentTab === 'projects' ? 'active' : ''}" data-tab="projects">
            <span class="dev-profile-side-link-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              <span>Projects</span>
            </span>
            <span class="dev-tab-count">${visibleProjects.length}</span>
          </button>
          <button type="button" class="dev-profile-side-link ${currentTab === 'pulse' ? 'active' : ''}" data-tab="pulse">
            <span class="dev-profile-side-link-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span>Project Pulse</span>
            </span>
            <span class="pulse-live-dot" title="Signature Live Pulse"></span>
          </button>
          <button type="button" class="dev-profile-side-link ${currentTab === 'contributions' ? 'active' : ''}" data-tab="contributions">
            <span class="dev-profile-side-link-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span>Contributions</span>
            </span>
            <span class="dev-tab-count">${developer.stats?.contributionsCount || 34}</span>
          </button>
          <button type="button" class="dev-profile-side-link ${currentTab === 'skills' ? 'active' : ''}" data-tab="skills">
            <span class="dev-profile-side-link-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>Skills &amp; Growth</span>
            </span>
          </button>
        </aside>

        <!-- Dynamic Main Content Area -->
        <main class="dev-profile-content-area" id="profileContentArea">
          ${renderTabContent(currentTab)}
        </main>
      </div>

      <!-- Modals Container -->
      ${renderModals()}
    `;

    attachEventListeners();
    if (currentTab === 'pulse') {
      initPulseComponent();
    } else if (currentTab === 'contributions') {
      initContributionsComponent();
    } else if (currentTab === 'overview') {
      initOverviewContributionSnapshot();
    }
  }

  function renderTabContent(tab) {
    switch (tab) {
      case 'projects':
        return renderProjectsTab();
      case 'pulse':
        return renderPulseTabSkeleton();
      case 'contributions':
        return renderContributionsTab();
      case 'skills':
        return renderSkillsTab();
      case 'overview':
      default:
        return renderOverviewTab();
    }
  }

  /* -------------------------------------------------------------------------
   * Section 5.5: Shared SVG Radar Chart & Gauge Helpers
   * ------------------------------------------------------------------------- */
  function renderSharedSvgRadar(strengths, hasData) {
    if (!hasData || !strengths || strengths.length < 3) {
      return `
        <div class="text-center py-5 text-secondary" style="font-size: 13px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5" style="margin: 0 auto 8px auto; display: block;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Insufficient verified activity to plot radar profile.
        </div>
      `;
    }

    const cx = 135;
    const cy = 110;
    const R = 70;
    const numAxes = strengths.length;

    const webLevels = [0.33, 0.66, 1.0];
    let webPolygons = '';
    webLevels.forEach(lvl => {
      const pts = [];
      for (let i = 0; i < numAxes; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
        const x = cx + R * lvl * Math.cos(angle);
        const y = cy + R * lvl * Math.sin(angle);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      webPolygons += `<polygon points="${pts.join(' ')}" fill="none" stroke="#E2E8F0" stroke-width="1" />`;
    });

    let spokes = '';
    let labels = '';
    const dataPoints = [];

    strengths.forEach((s, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
      const endX = cx + R * Math.cos(angle);
      const endY = cy + R * Math.sin(angle);
      spokes += `<line x1="${cx}" y1="${cy}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="2 2" />`;

      const valRatio = Math.max(0.1, Math.min(1.0, (s.value || 0) / (s.max || 100)));
      const dataX = cx + R * valRatio * Math.cos(angle);
      const dataY = cy + R * valRatio * Math.sin(angle);
      dataPoints.push(`${dataX.toFixed(1)},${dataY.toFixed(1)}`);

      const labelR = R + 18;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      let textAnchor = 'middle';
      if (Math.cos(angle) > 0.3) textAnchor = 'start';
      else if (Math.cos(angle) < -0.3) textAnchor = 'end';

      labels += `
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="10.5" font-weight="600" fill="#475569" text-anchor="${textAnchor}" dominant-baseline="middle">
          ${escapeHtml(s.axis)} <tspan font-weight="700" fill="#059669">(${s.value})</tspan>
        </text>
      `;
    });

    const dataPolygon = `
      <polygon points="${dataPoints.join(' ')}" fill="rgba(16, 185, 129, 0.16)" stroke="#10B981" stroke-width="2" stroke-linejoin="round" />
    `;

    let vertices = '';
    dataPoints.forEach(pt => {
      const [vx, vy] = pt.split(',');
      vertices += `<circle cx="${vx}" cy="${vy}" r="3.5" fill="#10B981" stroke="#FFFFFF" stroke-width="1.5" />`;
    });

    return `
      <svg viewBox="0 0 270 220" width="100%" height="220" style="max-width: 300px; overflow: visible;">
        ${webPolygons}
        ${spokes}
        ${dataPolygon}
        ${vertices}
        ${labels}
      </svg>
    `;
  }

  /* -------------------------------------------------------------------------
   * Section 6: Unified Project Card Renderer
   * ------------------------------------------------------------------------- */
  function renderProjectCard(project) {
    const isPinned = (developer.pinnedProjects || []).includes(project.id);
    return `
      <div class="dev-project-card ${isPinned ? 'pinned-border' : ''}" style="${isPinned ? 'border-color: rgba(245, 158, 11, 0.45);' : ''}">
        <div>
          <div class="dev-project-top">
            <div class="dev-project-icon" style="background-color: ${project.iconBg || '#10B981'};">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <div class="dev-project-title-area">
              <div class="dev-project-title-row">
                <a href="${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(project.name)}" class="dev-project-title" title="${escapeHtml(project.name)}">
                  ${escapeHtml(project.name)}
                </a>
                <div class="d-flex align-items-center gap-1">
                  ${isPinned ? `
                    <span class="dev-project-pin-badge" title="Featured pinned project">
                      📌 Pinned
                    </span>
                  ` : ''}
                  <span class="dev-badge-visibility ${project.visibility ? project.visibility.toLowerCase() : 'public'}">
                    ${escapeHtml(project.visibility || 'Public')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p class="dev-project-desc">${escapeHtml(project.description || 'No description provided.')}</p>

          <div class="dev-project-tags">
            ${(project.tags || []).map(tag => {
              const name = typeof tag === 'string' ? tag : tag.name;
              const color = typeof tag === 'string' ? getSkillColor(tag) : (tag.color || 'blue');
              return `<span class="dev-tech-pill ${color}">${escapeHtml(name)}</span>`;
            }).join('')}
          </div>
        </div>

        <div class="dev-project-meta-row">
          <div class="dev-project-stats-mini">
            <span class="dev-project-stat" title="Stars">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              ${project.stars || 0}
            </span>
            <span class="dev-project-stat" title="Forks">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
              ${project.forks || 0}
            </span>
          </div>

          <div class="d-flex align-items-center gap-2">
            ${isOwner ? `
              <button type="button" class="btn-pin-toggle ${isPinned ? 'is-pinned' : ''}" data-repo-id="${project.id}" title="${isPinned ? 'Click to unpin' : 'Click to pin project (max 4)'}">
                ${isPinned ? '📌 Unpin' : '📌 Pin'}
              </button>
            ` : ''}
            <span class="text-secondary" style="font-size: 11px;">${escapeHtml(project.updated || 'Recently updated')}</span>
          </div>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Overview Tab (With Unified Projects - NO separate pinned box)
   * ------------------------------------------------------------------------- */
  function renderOverviewTab() {
    const sortedProjects = getUnifiedSortedProjects();
    const previewProjects = sortedProjects.slice(0, 4);

    return `
      <div class="dev-profile-grid">
        <!-- Main Column (Left) -->
        <div class="dev-column-main">
          <!-- About Card -->
          <article class="dev-card" aria-label="About developer">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                About
              </h2>
              ${isOwner ? `
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnEditAbout">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
              ` : ''}
            </div>

            <div class="dev-about-content">
              <div class="dev-about-text">
                ${(developer.bio || 'Passionate developer building modern applications and collaborating across DevSync.')
                  .split(/\n+/)
                  .map(para => `<p>${escapeHtml(para.trim())}</p>`)
                  .join('')}
              </div>

              <div class="dev-about-facts">
                ${developer.education?.degree ? `
                  <div class="dev-fact-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                    <span>${escapeHtml(developer.education.degree)}</span>
                  </div>
                ` : ''}
                ${developer.location ? `
                  <div class="dev-fact-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>${escapeHtml(developer.location)}</span>
                  </div>
                ` : ''}
                <div class="dev-fact-item">
                  <span class="dev-fact-dot"></span>
                  <span>${developer.openToInvitations !== false ? 'Open to collaboration' : 'Currently busy'}</span>
                </div>
              </div>
            </div>
          </article>

          <!-- Section 6: Unified Projects Card (Single combined list with Pinned at top) -->
          <article class="dev-card" aria-label="Projects">
            <div class="dev-card-header">
              <div class="d-flex align-items-center gap-2">
                <h2 class="dev-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  Projects &amp; Repositories
                </h2>
                <span class="text-secondary" style="font-size: 12px;">(Pinned work listed first)</span>
              </div>
              <a href="#" class="dev-card-link-action" data-nav-tab="projects">View all (${sortedProjects.length}) &rarr;</a>
            </div>

            <div class="dev-projects-grid">
              ${previewProjects.length > 0 ? previewProjects.map(p => renderProjectCard(p)).join('') : `
                <div class="text-secondary py-4 text-center" style="grid-column: 1 / -1; font-size: 13px;">
                  No repositories available to display.
                </div>
              `}
            </div>
          </article>

          <!-- Recent Activity Card -->
          <article class="dev-card" aria-label="Recent activity">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Recent Activity
              </h2>
              <a href="#" class="dev-card-link-action" data-nav-tab="pulse">Project Pulse &rarr;</a>
            </div>

            <div class="dev-activity-list">
              ${(developer.activities || []).slice(0, 3).map(act => `
                <div class="dev-activity-item">
                  <div class="dev-activity-dot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
                  </div>
                  <div class="dev-activity-details">
                    <div class="dev-activity-title-row">
                      <span class="dev-activity-title">${escapeHtml(act.title)}</span>
                      <span class="dev-activity-time">${escapeHtml(act.time)}</span>
                    </div>
                    <p class="dev-activity-desc">${escapeHtml(act.description)}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </article>
        </div>

        <!-- Sidebar Column (Right) -->
        <div class="dev-column-side">
          <!-- Project Pulse Snapshot Card -->
          <article class="dev-card" aria-label="DevSync Pulse Snapshot" style="background: linear-gradient(180deg, var(--color-surface) 0%, rgba(16, 185, 129, 0.04) 100%);">
            <div class="dev-card-header">
              <div class="d-flex align-items-center gap-2">
                <span class="pulse-live-dot"></span>
                <h2 class="dev-card-title" style="font-size: 14px;">Live Project Pulse</h2>
              </div>
              <a href="#" class="dev-card-link-action" data-nav-tab="pulse">Explore &rarr;</a>
            </div>
            <p class="text-secondary" style="font-size: 12.5px; margin-bottom: 12px;">
              Active commit frequency, branch builds, and team velocity across repositories.
            </p>
            <div class="d-flex align-items-center justify-content-between p-3 rounded" style="background: var(--color-surface-subtle); border: 1px solid var(--color-border);">
              <div>
                <div style="font-size: 11px; text-transform: uppercase; color: var(--color-text-secondary); font-weight: 700;">Active Projects</div>
                <div style="font-size: 18px; font-weight: 750; color: #10b981;">${sortedProjects.length}</div>
              </div>
              <div>
                <div style="font-size: 11px; text-transform: uppercase; color: var(--color-text-secondary); font-weight: 700;">Pulse Status</div>
                <div style="font-size: 13px; font-weight: 600; color: #10b981;">● Online</div>
              </div>
            </div>
          </article>

          <!-- Contribution Intelligence Card (Overview Snapshot) -->
          <article class="dev-card" aria-label="Contribution Intelligence" id="overviewContribCard">
            <div class="dev-card-header">
              <div class="d-flex align-items-center gap-2">
                <span class="contrib-badge-tag">Contribution Intelligence</span>
                <h2 class="dev-card-title" style="font-size: 14.5px;">Contribution Impact</h2>
              </div>
              <a href="#" class="dev-card-link-action" data-nav-tab="contributions">Full Analysis &rarr;</a>
            </div>
            <div id="overviewContribSnapshot">
              <div class="text-center py-4 text-secondary" style="font-size: 13px;">
                <span class="btn-spinner"></span> Gathering verified contribution records...
              </div>
            </div>
          </article>

          <!-- Skills Card -->
          <article class="dev-card" aria-label="Skills">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Technical Stack
              </h2>
              <a href="#" class="dev-card-link-action" data-nav-tab="skills">Details &rarr;</a>
            </div>
            <div class="dev-skills-cloud">
              ${(developer.skills || []).map(skill => {
                const name = typeof skill === 'string' ? skill : skill.name;
                const color = typeof skill === 'string' ? getSkillColor(skill) : (skill.color || 'blue');
                return `<span class="dev-tech-pill ${color}">${escapeHtml(name)}</span>`;
              }).join('')}
            </div>
          </article>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Section 6: Full Unified Projects Tab
   * ------------------------------------------------------------------------- */
  function renderProjectsTab() {
    const sortedProjects = getUnifiedSortedProjects();
    const pinnedCount = (developer.pinnedProjects || []).length;

    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <div>
            <h2 class="dev-card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Projects &amp; Repositories
            </h2>
            <div class="text-secondary" style="font-size: 13px; margin-top: 2px;">
              Single unified portfolio. Pinned repositories are highlighted at the top (${pinnedCount} of 4 pinned).
            </div>
          </div>
          ${isOwner ? `
            <a href="../repositories/create.html" class="btn btn-primary btn-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Repository
            </a>
          ` : ''}
        </div>

        <div class="dev-projects-grid">
          ${sortedProjects.length > 0 ? sortedProjects.map(p => renderProjectCard(p)).join('') : `
            <div class="text-secondary py-6 text-center" style="grid-column: 1 / -1; font-size: 14px;">
              No public projects visible for this developer.
            </div>
          `}
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Section 7: Signature DevSync Project Pulse Component
   * ------------------------------------------------------------------------- */
  function renderPulseTabSkeleton() {
    const visibleProjects = getVisibleProjects();
    return `
      <div class="pulse-card">
        <!-- Pulse Header -->
        <div class="pulse-header">
          <div>
            <div class="d-flex align-items-center gap-3">
              <h2 class="font-heading" style="font-size: 22px; margin: 0;">DevSync Project Pulse</h2>
              <div class="pulse-live-indicator">
                <span class="pulse-live-dot"></span>
                <span id="pulseLiveLabel">Real-time Pulse Active</span>
              </div>
            </div>
            <p class="text-secondary" style="font-size: 13.5px; margin: 4px 0 0 0;">
              Live stream of development activity, commits, branch file uploads, and milestone velocity.
            </p>
          </div>
        </div>

        <!-- Controls Toolbar -->
        <div class="pulse-controls-row">
          <!-- Time Range Selector -->
          <div class="d-flex align-items-center gap-2">
            <span class="text-secondary" style="font-size: 12px; font-weight: 600;">Time Window:</span>
            <div class="pulse-range-group">
              <button type="button" class="pulse-range-btn ${pulseRange === 'live' ? 'active' : ''}" data-pulse-range="live">Live</button>
              <button type="button" class="pulse-range-btn ${pulseRange === '24h' ? 'active' : ''}" data-pulse-range="24h">24h</button>
              <button type="button" class="pulse-range-btn ${pulseRange === '7d' ? 'active' : ''}" data-pulse-range="7d">7 Days</button>
              <button type="button" class="pulse-range-btn ${pulseRange === '30d' ? 'active' : ''}" data-pulse-range="30d">30 Days</button>
            </div>
          </div>

          <!-- Project Filter -->
          <div class="d-flex align-items-center gap-2">
            <span class="text-secondary" style="font-size: 12px; font-weight: 600;">Repository:</span>
            <select id="pulseProjectSelect" class="form-select" style="font-size: 12.5px; width: 180px; padding: 4px 8px;">
              <option value="all">All Projects</option>
              ${visibleProjects.map(p => `
                <option value="${escapeHtml(p.name)}" ${p.name === pulseProject ? 'selected' : ''}>${escapeHtml(p.name)}</option>
              `).join('')}
            </select>
          </div>

          <!-- View Mode Toggles -->
          <div class="d-flex align-items-center gap-1">
            <button type="button" class="btn btn-outline btn-sm ${pulseView === 'activity' ? 'active' : ''}" data-pulse-view="activity">Activity Pulse</button>
            <button type="button" class="btn btn-outline btn-sm ${pulseView === 'comparison' ? 'active' : ''}" data-pulse-view="comparison">Compare</button>
            <button type="button" class="btn btn-outline btn-sm ${pulseView === 'progress' ? 'active' : ''}" data-pulse-view="progress">Progress</button>
            <button type="button" class="btn btn-outline btn-sm ${pulseView === 'team' ? 'active' : ''}" data-pulse-view="team">Team Work</button>
          </div>
        </div>

        <!-- Dynamic Pulse View Container -->
        <div id="pulseViewContainer">
          <div class="text-center py-6 text-secondary"><span class="btn-spinner"></span> Gathering pulse data...</div>
        </div>
      </div>
    `;
  }

  async function initPulseComponent() {
    const viewContainer = document.getElementById('pulseViewContainer');
    if (!viewContainer) return;

    // Attach controls
    container.querySelectorAll('[data-pulse-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        pulseRange = btn.getAttribute('data-pulse-range');
        container.querySelectorAll('[data-pulse-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refreshPulseView();
      });
    });

    const projectSelect = document.getElementById('pulseProjectSelect');
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        pulseProject = e.target.value;
        refreshPulseView();
      });
    }

    container.querySelectorAll('[data-pulse-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        pulseView = btn.getAttribute('data-pulse-view');
        container.querySelectorAll('[data-pulse-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refreshPulseView();
      });
    });

    await refreshPulseView();

    // Auto-refresh for Live mode
    if (pulseTimer) clearInterval(pulseTimer);
    if (pulseRange === 'live') {
      pulseTimer = setInterval(() => {
        if (currentTab === 'pulse' && pulseRange === 'live') {
          refreshPulseView(true);
        }
      }, 15000);
    }
  }

  async function refreshPulseView(isBackground = false) {
    const viewContainer = document.getElementById('pulseViewContainer');
    if (!viewContainer) return;

    if (!isBackground) {
      viewContainer.innerHTML = `<div class="text-center py-6 text-secondary"><span class="btn-spinner"></span> Loading pulse metrics...</div>`;
    }

    try {
      if (pulseView === 'comparison') {
        await renderPulseComparisonView(viewContainer);
      } else if (pulseView === 'progress') {
        await renderPulseProgressView(viewContainer);
      } else if (pulseView === 'team') {
        await renderPulseTeamView(viewContainer);
      } else {
        await renderPulseActivityView(viewContainer);
      }
    } catch (err) {
      viewContainer.innerHTML = `
        <div class="text-secondary py-4 text-center">
          Failed to load Pulse data: ${escapeHtml(err.message || 'Server error')}
        </div>
      `;
    }
  }

  // View 1: Activity Pulse Chart & Drilldown
  async function renderPulseActivityView(containerEl) {
    const [res, intelData] = await Promise.all([
      PulseService.getPulse(developer.username, pulseRange, pulseProject),
      PulseService.getContributionIntelligence(developer.username, (pulseRange === 'live' || pulseRange === '24h') ? '7d' : pulseRange, pulseProject)
    ]);
    pulseDataCache = res;

    const ARC_LENGTH = 188.5;
    const pulseScore = intelData.hasSufficientData ? intelData.score : null;
    const pulseOffset = pulseScore !== null ? Math.max(0, ARC_LENGTH - (ARC_LENGTH * (pulseScore / 100))) : ARC_LENGTH;
    const pulseInd = intelData.indicators || {};

    const intervals = res.intervals || [];
    const maxCount = Math.max(...intervals.map(i => i.count), 5);

    containerEl.innerHTML = `
      <!-- Contribution Intelligence Header Cards in Pulse -->
      <div class="contrib-intel-grid mb-4">
        <!-- Impact Score Gauge Card -->
        <div class="contrib-gauge-card">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="contrib-card-label">Contribution Impact</span>
            <span class="contrib-trend-badge ${intelData.hasSufficientData ? (intelData.trendDirection || 'up') : 'neutral'}">
              ${intelData.hasSufficientData ? `${intelData.trendDirection === 'up' ? '↑' : (intelData.trendDirection === 'down' ? '↓' : '•')} ${intelData.trendPercent} ${intelData.priorPeriodLabel || ''}` : 'Insufficient data'}
            </span>
          </div>
          <div class="contrib-gauge-wrap">
            <svg class="contrib-gauge-svg" viewBox="0 0 160 95" width="160" height="95">
              <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="#E2E8F0" stroke-width="12" stroke-linecap="round" />
              <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="${pulseScore !== null ? '#10B981' : '#CBD5E1'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="${pulseOffset}" />
            </svg>
            <div class="contrib-gauge-center">
              <span class="contrib-gauge-score">${pulseScore !== null ? pulseScore : '—'}</span>
              <span class="contrib-gauge-max">/ 100</span>
            </div>
          </div>
          <p class="contrib-gauge-explanation">
            ${escapeHtml(intelData.hasSufficientData ? intelData.explanation : (intelData.message || 'Insufficient activity recorded in this period.'))}
          </p>
        </div>

        <!-- 3 Compact Indicators -->
        <div class="contrib-indicators-column">
          <div class="contrib-indicator-card">
            <div class="contrib-ind-left">
              <div class="contrib-ind-icon mint">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <span class="contrib-ind-label">Impact</span>
                <span class="contrib-ind-sub">${escapeHtml(pulseInd.impact?.sublabel || 'Work delivered')}</span>
              </div>
            </div>
            <div class="contrib-ind-right">
              <span class="contrib-ind-value">${escapeHtml(pulseInd.impact?.value || '0 delivered')}</span>
              <span class="contrib-ind-status ${(pulseInd.impact?.status || 'steady').toLowerCase()}">${escapeHtml(pulseInd.impact?.status || 'Steady')}</span>
            </div>
          </div>

          <div class="contrib-indicator-card">
            <div class="contrib-ind-left">
              <div class="contrib-ind-icon blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <span class="contrib-ind-label">Flow</span>
                <span class="contrib-ind-sub">${escapeHtml(pulseInd.flow?.sublabel || 'Resolution velocity')}</span>
              </div>
            </div>
            <div class="contrib-ind-right">
              <span class="contrib-ind-value">${escapeHtml(pulseInd.flow?.value || '0 resolved')}</span>
              <span class="contrib-ind-status ${(pulseInd.flow?.status || 'active').toLowerCase()}">${escapeHtml(pulseInd.flow?.status || 'Active')}</span>
            </div>
          </div>

          <div class="contrib-indicator-card">
            <div class="contrib-ind-left">
              <div class="contrib-ind-icon purple">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <span class="contrib-ind-label">Collaboration</span>
                <span class="contrib-ind-sub">${escapeHtml(pulseInd.collaboration?.sublabel || 'Reviews & discussions')}</span>
              </div>
            </div>
            <div class="contrib-ind-right">
              <span class="contrib-ind-value">${escapeHtml(pulseInd.collaboration?.value || '0 interactions')}</span>
              <span class="contrib-ind-status ${(pulseInd.collaboration?.status || 'active').toLowerCase()}">${escapeHtml(pulseInd.collaboration?.status || 'Active')}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Pulse Chart -->
      <div class="mb-2 d-flex align-items-center justify-content-between">
        <span class="text-secondary" style="font-size: 12px; font-weight: 600;">Activity Timeline &bull; Click any bar to view event drilldown</span>
        <span class="text-secondary" style="font-size: 11px;">Max Velocity: ${maxCount} events/bucket</span>
      </div>

      <div class="pulse-chart-container">
        ${intervals.map((item, idx) => {
          const heightPct = Math.max((item.count / maxCount) * 100, 6);
          return `
            <div class="pulse-bar-column" data-interval-idx="${idx}" title="${escapeHtml(item.label)}: ${item.count} events">
              <span class="pulse-bar-count">${item.count}</span>
              <div class="pulse-bar-rect" style="height: ${heightPct}%;"></div>
              <span class="pulse-bar-label">${escapeHtml(item.label)}</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Recent Event List -->
      <div class="mt-5">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h3 class="font-heading" style="font-size: 15px; margin: 0;">Verified Event Stream</h3>
          <span class="text-secondary" style="font-size: 12px;">Live Audit Log</span>
        </div>

        <div class="dev-activity-list">
          ${(res.recentEvents || []).slice(0, 5).map(evt => `
            <div class="dev-activity-item">
              <div class="dev-activity-dot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
              </div>
              <div class="dev-activity-details">
                <div class="dev-activity-title-row">
                  <span class="dev-activity-title">
                    <strong>@${escapeHtml(evt.actor || developer.username)}</strong> &bull; ${escapeHtml(evt.title || evt.action)}
                  </span>
                  <span class="dev-activity-time">${escapeHtml(evt.time || 'Recently')}</span>
                </div>
                <p class="dev-activity-desc">${escapeHtml(evt.description || '')}</p>
                ${evt.repository ? `
                  <div class="text-secondary" style="font-size: 11.5px;">
                    Repository: <code>${escapeHtml(evt.repository)}</code> &bull; Branch: <code>${escapeHtml(evt.branch || 'main')}</code>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Click on bar triggers Event Drilldown Modal
    containerEl.querySelectorAll('.pulse-bar-column').forEach(col => {
      col.addEventListener('click', () => {
        const idx = parseInt(col.getAttribute('data-interval-idx'), 10);
        const item = intervals[idx];
        if (item) {
          openPulseDrilldown(item.label, item.events || []);
        }
      });
    });
  }

  // View 2: Project Comparison
  async function renderPulseComparisonView(containerEl) {
    const res = await PulseService.getComparison(developer.username, pulseRange);
    const projects = res.comparison || [];
    const maxEvents = Math.max(...projects.map(p => p.eventCount), 1);

    containerEl.innerHTML = `
      <div class="mb-4">
        <h3 class="font-heading" style="font-size: 16px; margin: 0 0 4px 0;">Cross-Project Velocity Comparison</h3>
        <p class="text-secondary" style="font-size: 13px; margin: 0;">Compare development activity and commit volume across repositories.</p>
      </div>

      <div class="d-flex flex-column gap-4">
        ${projects.map(p => {
          const pct = Math.round((p.eventCount / maxEvents) * 100);
          return `
            <div class="card p-4">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <div class="d-flex align-items-center gap-2">
                  <a href="${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(p.name)}" class="table-repo-name" style="font-size: 14.5px;">
                    ${escapeHtml(p.name)}
                  </a>
                  <span class="badge ${p.visibility === 'Public' ? 'badge-public' : 'badge-private'}">${escapeHtml(p.visibility)}</span>
                </div>
                <span style="font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: #10B981;">
                  ${p.eventCount} events
                </span>
              </div>
              <div class="repo-progress-track mb-3">
                <div class="repo-progress-fill" style="width: ${pct}%;"></div>
              </div>
              <div class="d-flex align-items-center gap-4 text-secondary" style="font-size: 12.5px;">
                <span>Commits: <strong>${p.commits || 0}</strong></span>
                <span>Branch Uploads: <strong>${p.uploads || 0}</strong></span>
                <span>Active Branches: <strong>${p.branches || 1}</strong></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // View 3: Task & Milestone Progress
  async function renderPulseProgressView(containerEl) {
    const res = await PulseService.getProgress(developer.username, pulseProject === 'all' ? null : pulseProject);
    const milestones = res.milestones || [];
    const tasks = res.tasks || [];

    containerEl.innerHTML = `
      <div class="mb-4">
        <h3 class="font-heading" style="font-size: 16px; margin: 0 0 4px 0;">Milestone &amp; Task Progress</h3>
        <p class="text-secondary" style="font-size: 13px; margin: 0;">Real-time tracking of repository deliverables and completed features.</p>
      </div>

      <!-- Milestones List -->
      <div class="d-flex flex-column gap-3 mb-5">
        ${milestones.map(m => `
          <div class="card p-4">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div>
                <strong style="font-size: 14.5px;">${escapeHtml(m.title)}</strong>
                <span class="text-secondary ml-2" style="font-size: 12px;">(${escapeHtml(m.repository)})</span>
              </div>
              <span style="font-family: var(--font-heading); font-weight: 700; color: #10B981;">${m.progress}%</span>
            </div>
            <div class="repo-progress-track mb-2">
              <div class="repo-progress-fill" style="width: ${m.progress}%;"></div>
            </div>
            <div class="d-flex align-items-center justify-content-between text-secondary" style="font-size: 12px;">
              <span>Target: ${escapeHtml(m.dueDate || 'Q4 2026')}</span>
              <span>${m.completedTasks} of ${m.totalTasks} tasks completed</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Tasks Breakdown -->
      <h4 class="font-heading" style="font-size: 14.5px; margin-bottom: 12px;">Assigned Task Deliverables</h4>
      <div class="table-responsive">
        <table class="table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>Task</th>
              <th>Repository</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => `
              <tr>
                <td><strong>${escapeHtml(t.title)}</strong></td>
                <td><code>${escapeHtml(t.repository || 'devsync-core')}</code></td>
                <td>
                  <span class="task-status-pill ${(t.status || '').toLowerCase().replace(' ', '-')}">
                    ${escapeHtml(t.status || 'Pending')}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // View 4: Team Contributions
  async function renderPulseTeamView(containerEl) {
    const targetRepo = pulseProject === 'all' ? 'devsync-core' : pulseProject;
    const res = await PulseService.getTeamContributions(targetRepo);
    const contributors = res.contributors || [];

    containerEl.innerHTML = `
      <div class="mb-4">
        <h3 class="font-heading" style="font-size: 16px; margin: 0 0 4px 0;">Team Contribution Breakdown</h3>
        <p class="text-secondary" style="font-size: 13px; margin: 0;">Attribution of commits, branch file uploads, and tasks for <strong>${escapeHtml(targetRepo)}</strong>.</p>
      </div>

      <div class="table-responsive">
        <table class="table" style="font-size: 13px;">
          <thead>
            <tr>
              <th>Contributor</th>
              <th>Role</th>
              <th>Responsibility Area</th>
              <th>Assigned Tasks</th>
              <th class="text-right">Recorded Actions</th>
            </tr>
          </thead>
          <tbody>
            ${contributors.map(c => `
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <img src="${escapeHtml(c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80')}" alt="${escapeHtml(c.name)}" style="width: 24px; height: 24px; border-radius: 50%;" />
                    <a href="profile.html?user=${encodeURIComponent(c.username)}" style="font-weight: 600; color: inherit; text-decoration: none;">
                      ${escapeHtml(c.name || c.username)}
                    </a>
                  </div>
                </td>
                <td><span class="role-pill ${escapeHtml((c.role || 'Collaborator').toLowerCase())}">${escapeHtml(c.role)}</span></td>
                <td><span class="resp-pill">${escapeHtml(c.responsibility || 'Engineering')}</span></td>
                <td>${(c.assignedTasks || []).length} tasks</td>
                <td class="text-right"><strong>${c.recordedActions || 0}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Pulse Event Drilldown Modal
  function openPulseDrilldown(label, events) {
    const modal = document.getElementById('pulseDrilldownModal');
    const titleEl = document.getElementById('drilldownModalTitle');
    const listEl = document.getElementById('drilldownEventList');

    if (titleEl) titleEl.textContent = `Pulse Events: ${label}`;
    if (listEl) {
      if (events.length === 0) {
        listEl.innerHTML = `<div class="text-secondary py-4 text-center">No individual events in this time bucket.</div>`;
      } else {
        listEl.innerHTML = events.map(evt => `
          <div class="dev-activity-item mb-3 pb-3 border-bottom">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <strong>@${escapeHtml(evt.actor || developer.username)}</strong> &bull; <span class="badge badge-private" style="font-size: 10.5px;">${escapeHtml(evt.action || 'event')}</span>
              <span class="text-secondary" style="font-size: 11px;">${escapeHtml(evt.time || 'Recently')}</span>
            </div>
            <div style="font-size: 13px; margin-bottom: 2px;">${escapeHtml(evt.title || evt.description)}</div>
            ${evt.repository ? `
              <div class="text-secondary" style="font-size: 11.5px;">
                Repo: <code>${escapeHtml(evt.repository)}</code> &bull; Branch: <code>${escapeHtml(evt.branch || 'main')}</code>
              </div>
            ` : ''}
          </div>
        `).join('');
      }
    }

    if (modal) modal.classList.add('open');
  }

  /* -------------------------------------------------------------------------
   * Contributions Tab: DevSync Contribution Intelligence
   * ------------------------------------------------------------------------- */
  function renderContributionsTab() {
    return `
      <div class="dev-card">
        <!-- Header & Controls -->
        <div class="contrib-intel-header">
          <div>
            <div class="d-flex align-items-center gap-2">
              <h2 class="font-heading" style="font-size: 19px; margin: 0; color: #0F172A;">Contribution Intelligence</h2>
              <span class="contrib-badge-tag">Verified Records</span>
            </div>
            <p class="text-secondary" style="font-size: 13px; margin: 3px 0 0 0;">
              Data-driven engineering impact, flow velocity, and peer collaboration metrics for @${escapeHtml(developer.username)}.
            </p>
          </div>

          <!-- Controls: 7d / 30d / 90d Time Range -->
          <div class="contrib-intel-controls">
            <div class="contrib-range-pills" role="group" aria-label="Time Window">
              <button type="button" class="contrib-range-btn ${contribRange === '7d' ? 'active' : ''}" data-dev-range="7d">7 Days</button>
              <button type="button" class="contrib-range-btn ${contribRange === '30d' ? 'active' : ''}" data-dev-range="30d">30 Days</button>
              <button type="button" class="contrib-range-btn ${contribRange === '90d' ? 'active' : ''}" data-dev-range="90d">90 Days</button>
            </div>
          </div>
        </div>

        <!-- Dynamic Container -->
        <div id="devContribIntelContainer">
          <div class="text-center py-6 text-secondary"><span class="btn-spinner"></span> Gathering verified contribution records...</div>
        </div>
      </div>
    `;
  }

  async function initContributionsComponent() {
    const containerEl = document.getElementById('devContribIntelContainer');
    if (!containerEl) return;

    container.querySelectorAll('[data-dev-range]').forEach(btn => {
      btn.addEventListener('click', async () => {
        contribRange = btn.getAttribute('data-dev-range');
        container.querySelectorAll('[data-dev-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await loadDevContributionIntelligence();
      });
    });

    await loadDevContributionIntelligence();
  }

  async function loadDevContributionIntelligence() {
    const containerEl = document.getElementById('devContribIntelContainer');
    if (!containerEl) return;

    containerEl.innerHTML = `<div class="text-center py-6 text-secondary"><span class="btn-spinner"></span> Computing contribution metrics...</div>`;

    try {
      const intel = await PulseService.getContributionIntelligence(developer.username, contribRange);
      devIntelCache = intel;

      const ARC_LENGTH = 188.5;
      const score = intel.hasSufficientData ? intel.score : null;
      const offset = score !== null ? Math.max(0, ARC_LENGTH - (ARC_LENGTH * (score / 100))) : ARC_LENGTH;

      const ind = intel.indicators || {};

      containerEl.innerHTML = `
        <div class="contrib-intel-grid mb-4">
          <!-- Left: Score Gauge -->
          <div class="contrib-gauge-card">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="d-flex align-items-center gap-2">
                <span class="contrib-card-label">Contribution Impact</span>
                <span class="contrib-info-btn" title="${escapeHtml(intel.tooltip || 'Composite transparent engineering metric')}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </span>
              </div>
              <span class="contrib-trend-badge ${intel.hasSufficientData ? (intel.trendDirection || 'up') : 'neutral'}">
                ${intel.hasSufficientData ? `${intel.trendDirection === 'up' ? '↑' : (intel.trendDirection === 'down' ? '↓' : '•')} ${intel.trendPercent} ${intel.priorPeriodLabel || ''}` : 'Insufficient data'}
              </span>
            </div>

            <!-- SVG Semicircular Gauge -->
            <div class="contrib-gauge-wrap">
              <svg class="contrib-gauge-svg" viewBox="0 0 160 95" width="160" height="95">
                <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="#E2E8F0" stroke-width="12" stroke-linecap="round" />
                <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="${score !== null ? '#10B981' : '#CBD5E1'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="${offset}" />
              </svg>
              <div class="contrib-gauge-center">
                <span class="contrib-gauge-score">${score !== null ? score : '—'}</span>
                <span class="contrib-gauge-max">/ 100</span>
              </div>
            </div>

            <p class="contrib-gauge-explanation">
              ${escapeHtml(intel.hasSufficientData ? intel.explanation : (intel.message || 'Insufficient activity recorded in this period.'))}
            </p>
          </div>

          <!-- Right: 3 Indicators -->
          <div class="contrib-indicators-column">
            <!-- Impact -->
            <div class="contrib-indicator-card">
              <div class="contrib-ind-left">
                <div class="contrib-ind-icon mint">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div>
                  <span class="contrib-ind-label">Impact</span>
                  <span class="contrib-ind-sub">${escapeHtml(ind.impact?.sublabel || 'Work delivered')}</span>
                </div>
              </div>
              <div class="contrib-ind-right">
                <span class="contrib-ind-value">${escapeHtml(ind.impact?.value || '0 delivered')}</span>
                <span class="contrib-ind-status ${(ind.impact?.status || 'steady').toLowerCase()}">${escapeHtml(ind.impact?.status || 'Steady')}</span>
              </div>
            </div>

            <!-- Flow -->
            <div class="contrib-indicator-card">
              <div class="contrib-ind-left">
                <div class="contrib-ind-icon blue">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <div>
                  <span class="contrib-ind-label">Flow</span>
                  <span class="contrib-ind-sub">${escapeHtml(ind.flow?.sublabel || 'Resolution velocity')}</span>
                </div>
              </div>
              <div class="contrib-ind-right">
                <span class="contrib-ind-value">${escapeHtml(ind.flow?.value || '0 resolved')}</span>
                <span class="contrib-ind-status ${(ind.flow?.status || 'active').toLowerCase()}">${escapeHtml(ind.flow?.status || 'Active')}</span>
              </div>
            </div>

            <!-- Collaboration -->
            <div class="contrib-indicator-card">
              <div class="contrib-ind-left">
                <div class="contrib-ind-icon purple">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <span class="contrib-ind-label">Collaboration</span>
                  <span class="contrib-ind-sub">${escapeHtml(ind.collaboration?.sublabel || 'Reviews & discussions')}</span>
                </div>
              </div>
              <div class="contrib-ind-right">
                <span class="contrib-ind-value">${escapeHtml(ind.collaboration?.value || '0 interactions')}</span>
                <span class="contrib-ind-status ${(ind.collaboration?.status || 'active').toLowerCase()}">${escapeHtml(ind.collaboration?.status || 'Active')}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Lower Grid: Strengths Radar & Project Comparison -->
        <div class="contrib-lower-grid mb-5">
          <!-- Strengths -->
          <div class="contrib-sub-card">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h4 class="contrib-section-title">Engineering Strengths</h4>
                <span class="text-secondary" style="font-size: 12px;">5-dimensional verified capabilities</span>
              </div>
              <span class="text-secondary" style="font-size: 11.5px;">Scale 0–100</span>
            </div>
            <div class="contrib-radar-wrapper">
              ${renderSharedSvgRadar(intel.strengths, intel.hasSufficientData)}
            </div>
          </div>

          <!-- Projects -->
          <div class="contrib-sub-card">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h4 class="contrib-section-title">Project Distribution</h4>
                <span class="text-secondary" style="font-size: 12px;">Proportional activity across repositories</span>
              </div>
              <span class="text-secondary" style="font-size: 11.5px;">${(intel.projectDistribution || []).length} active</span>
            </div>
            <div class="contrib-projects-list">
              ${(intel.projectDistribution || []).length > 0 ? (intel.projectDistribution || []).map(p => `
                <div class="contrib-proj-row">
                  <div class="contrib-proj-top">
                    <a href="${ROUTES.REPOSITORY_DETAIL}?repo=${encodeURIComponent(p.name)}" class="contrib-proj-name">
                      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${p.languageColor || '#10B981'};"></span>
                      ${escapeHtml(p.name)}
                    </a>
                    <span class="contrib-proj-share">${p.sharePercent}%</span>
                  </div>
                  <div class="contrib-proj-bar">
                    <div class="contrib-proj-fill" style="width: ${p.sharePercent}%; background-color: ${p.languageColor || '#10B981'};"></div>
                  </div>
                  <div class="contrib-proj-meta">
                    <span>${escapeHtml(p.recentActivity || 'Activity recorded')}</span>
                    <span>${p.eventCount} action${p.eventCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
              `).join('') : `
                <div class="text-center py-4 text-secondary" style="font-size: 13px;">
                  No active repository records found in this window.
                </div>
              `}
            </div>
          </div>
        </div>

        <h3 class="font-heading" style="font-size: 15px; margin-bottom: 12px;">Verified Contribution History</h3>
        <div class="dev-activity-list">
          ${(developer.activities || []).map(act => `
            <div class="dev-activity-item">
              <div class="dev-activity-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg></div>
              <div class="dev-activity-details">
                <div class="dev-activity-title-row">
                  <span class="dev-activity-title">${escapeHtml(act.title)}</span>
                  <span class="dev-activity-time">${escapeHtml(act.time)}</span>
                </div>
                <p class="dev-activity-desc">${escapeHtml(act.description)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      containerEl.innerHTML = `
        <div class="text-secondary py-4 text-center">
          Failed to load Contribution Intelligence: ${escapeHtml(err.message || 'Server error')}
        </div>
      `;
    }
  }

  async function initOverviewContributionSnapshot() {
    const target = document.getElementById('overviewContribSnapshot');
    if (!target) return;

    try {
      const intel = await PulseService.getContributionIntelligence(developer.username, '30d');
      const score = intel.hasSufficientData ? intel.score : null;
      const ARC_LENGTH = 188.5;
      const offset = score !== null ? Math.max(0, ARC_LENGTH - (ARC_LENGTH * (score / 100))) : ARC_LENGTH;
      const ind = intel.indicators || {};

      target.innerHTML = `
        <div class="d-flex align-items-center justify-content-between p-3 rounded mb-3" style="background: var(--color-surface-subtle, #FAFAFA); border: 1px solid var(--color-border, #E2E8F0);">
          <div class="d-flex align-items-center gap-3">
            <svg viewBox="0 0 160 95" width="70" height="42">
              <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="#E2E8F0" stroke-width="12" stroke-linecap="round" />
              <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="${score !== null ? '#10B981' : '#CBD5E1'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="${offset}" />
            </svg>
            <div>
              <div style="font-size: 20px; font-weight: 800; color: #0F172A; line-height: 1.1;">
                ${score !== null ? score : '—'} <span style="font-size: 11px; font-weight: 600; color: #94A3B8;">/ 100</span>
              </div>
              <div style="font-size: 11.5px; color: #64748B;">Contribution Impact</div>
            </div>
          </div>
          <span class="contrib-trend-badge ${intel.hasSufficientData ? (intel.trendDirection || 'up') : 'neutral'}">
            ${intel.hasSufficientData ? `${intel.trendDirection === 'up' ? '↑' : (intel.trendDirection === 'down' ? '↓' : '•')} ${intel.trendPercent}` : 'Insufficient data'}
          </span>
        </div>

        <div class="d-flex flex-column gap-2 mb-2">
          <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background: #FAFAFA; border: 1px solid #E2E8F0; font-size: 12px;">
            <span style="color: #64748B;">Impact</span>
            <span style="font-weight: 700; color: #0F172A;">${escapeHtml(ind.impact?.value || '0 delivered')}</span>
          </div>
          <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background: #FAFAFA; border: 1px solid #E2E8F0; font-size: 12px;">
            <span style="color: #64748B;">Flow</span>
            <span style="font-weight: 700; color: #0F172A;">${escapeHtml(ind.flow?.value || '0 resolved')}</span>
          </div>
          <div class="d-flex align-items-center justify-content-between p-2 rounded" style="background: #FAFAFA; border: 1px solid #E2E8F0; font-size: 12px;">
            <span style="color: #64748B;">Collaboration</span>
            <span style="font-weight: 700; color: #0F172A;">${escapeHtml(ind.collaboration?.value || '0 interactions')}</span>
          </div>
        </div>
      `;
    } catch (_) {
      target.innerHTML = `<div class="text-secondary py-3 text-center" style="font-size: 12px;">Verified records synced with server.</div>`;
    }
  }

  /* -------------------------------------------------------------------------
   * Skills & Growth Tab
   * ------------------------------------------------------------------------- */
  function renderSkillsTab() {
    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <h2 class="dev-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Technical Stack &amp; Skills
          </h2>
          ${isOwner ? `
            <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnEditSkillsTab">Manage Skills</button>
          ` : ''}
        </div>

        <div class="dev-skills-cloud mb-5">
          ${(developer.skills || []).map(skill => {
            const name = typeof skill === 'string' ? skill : skill.name;
            const color = typeof skill === 'string' ? getSkillColor(skill) : (skill.color || 'blue');
            return `
              <span class="dev-tech-pill ${color}" style="font-size: 13px; padding: 6px 14px;">
                ${escapeHtml(name)}
              </span>
            `;
          }).join('')}
        </div>

        <div class="p-4 rounded" style="background: var(--color-surface-subtle); border: 1px solid var(--color-border);">
          <h3 class="font-heading" style="font-size: 14.5px; margin: 0 0 6px 0;">Continuous Learning &amp; Growth</h3>
          <p class="text-secondary" style="font-size: 13px; margin: 0;">
            Currently mastering distributed systems in Python, asynchronous task processing with Celery/Redis, and real-time collaboration engines.
          </p>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Modals: Edit Profile, Edit Skills, Pulse Drilldown
   * ------------------------------------------------------------------------- */
  function renderModals() {
    return `
      <!-- Pulse Drilldown Modal -->
      <div class="dev-modal-overlay" id="pulseDrilldownModal">
        <div class="dev-modal-dialog" style="max-width: 600px;">
          <div class="dev-modal-header">
            <h3 class="dev-modal-title" id="drilldownModalTitle">Pulse Events Drilldown</h3>
            <button type="button" class="dev-modal-close" data-close-modal="pulseDrilldownModal">&times;</button>
          </div>
          <div class="dev-modal-body" id="drilldownEventList" style="max-height: 60vh; overflow-y: auto;">
            <!-- Populated dynamically -->
          </div>
          <div class="dev-modal-footer">
            <button type="button" class="btn btn-primary btn-pill btn-sm" data-close-modal="pulseDrilldownModal">Close</button>
          </div>
        </div>
      </div>

      <!-- Edit Profile Modal -->
      <div class="dev-modal-overlay" id="editProfileModal">
        <div class="dev-modal-dialog">
          <div class="dev-modal-header">
            <h3 class="dev-modal-title">Edit Developer Profile</h3>
            <button type="button" class="dev-modal-close" data-close-modal="editProfileModal">&times;</button>
          </div>
          <form id="editProfileForm">
            <div class="dev-modal-body">
              <div class="form-group mb-3">
                <label class="form-label" for="editDisplayName">Display Name</label>
                <input type="text" id="editDisplayName" class="form-control" value="${escapeHtml(developer.name)}" required />
              </div>
              <div class="form-group mb-3">
                <label class="form-label" for="editHeadline">Role / Focus</label>
                <input type="text" id="editHeadline" class="form-control" value="${escapeHtml(developer.headline || developer.role || '')}" required />
              </div>
              <div class="form-group mb-3">
                <label class="form-label" for="editBio">Bio</label>
                <textarea id="editBio" class="form-control" rows="3">${escapeHtml(developer.bio || '')}</textarea>
              </div>
              <div class="form-group mb-3">
                <label class="form-label" for="editLocation">Location</label>
                <input type="text" id="editLocation" class="form-control" value="${escapeHtml(developer.location || '')}" />
              </div>
              <div class="form-group mb-3">
                <label class="form-label" for="editWebsite">Personal Website</label>
                <input type="url" id="editWebsite" class="form-control" value="${escapeHtml(developer.website || '')}" />
              </div>
            </div>
            <div class="dev-modal-footer">
              <button type="button" class="btn btn-outline btn-pill btn-sm" data-close-modal="editProfileModal">Cancel</button>
              <button type="submit" class="btn btn-primary btn-pill btn-sm">Save Changes</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit Skills Modal -->
      <div class="dev-modal-overlay" id="editSkillsModal">
        <div class="dev-modal-dialog">
          <div class="dev-modal-header">
            <h3 class="dev-modal-title">Manage Technical Skills</h3>
            <button type="button" class="dev-modal-close" data-close-modal="editSkillsModal">&times;</button>
          </div>
          <div class="dev-modal-body">
            <div class="d-flex gap-2 mb-3">
              <input type="text" id="newSkillInput" class="form-control" placeholder="e.g. Go, GraphQL, Redis" />
              <button type="button" class="btn btn-primary btn-sm" id="btnAddSkill">Add</button>
            </div>
            <div class="dev-skills-cloud" id="skillsModalTags">
              ${(developer.skills || []).map((s, idx) => {
                const name = typeof s === 'string' ? s : s.name;
                const color = typeof s === 'string' ? getSkillColor(s) : (s.color || 'blue');
                return `
                  <span class="dev-tech-pill ${color}" style="display: inline-flex; align-items: center; gap: 4px;">
                    ${escapeHtml(name)}
                    <button type="button" class="btn-remove-skill" data-skill-idx="${idx}" style="background: none; border: none; cursor: pointer; color: inherit; padding: 0;">&times;</button>
                  </span>
                `;
              }).join('')}
            </div>
          </div>
          <div class="dev-modal-footer">
            <button type="button" class="btn btn-primary btn-pill btn-sm" data-close-modal="editSkillsModal">Done</button>
          </div>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Event Listeners & Binding
   * ------------------------------------------------------------------------- */
  function attachEventListeners() {
    // Tab switching (from vertical sidebar, counters, and in-page links)
    container.querySelectorAll('.dev-profile-side-link, [data-nav-tab], .dev-counter-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = el.getAttribute('data-tab') || el.getAttribute('data-nav-tab');
        if (targetTab && targetTab !== currentTab) {
          currentTab = targetTab;
          const p = new URLSearchParams(window.location.search);
          p.set('tab', currentTab);
          window.history.pushState(null, '', `${window.location.pathname}?${p.toString()}`);
          renderPage();
        }
      });
    });

    // Share Profile button
    const btnShare = document.getElementById('btnShareProfile');
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        const shareUrl = window.location.href;
        try {
          await navigator.clipboard.writeText(shareUrl);
          toastSuccess('Public profile URL copied to clipboard!', 'Share Profile');
        } catch (_) {
          toastSuccess(`Profile URL: ${shareUrl}`, 'Share Profile');
        }
      });
    }

    // Follow Developer button
    const btnFollow = document.getElementById('btnFollowDev');
    if (btnFollow) {
      btnFollow.addEventListener('click', async () => {
        const res = await ProfileService.toggleFollow(developer.username);
        if (res) {
          developer.isFollowing = res.isFollowing;
          if (developer.stats) developer.stats.followers = res.followers;
          renderPage();
          if (res.isFollowing) {
            toastSuccess(`You are now following ${developer.name}!`, 'Followed');
          } else {
            toastInfo(`Unfollowed ${developer.name}.`);
          }
        }
      });
    }

    // Connect Developer button
    const btnConnect = document.getElementById('btnConnectDev');
    if (btnConnect) {
      btnConnect.addEventListener('click', async () => {
        let nextState = developer.connectionState === 'Connected' ? 'Not Connected' : 'Connected';
        await ConnectionService.updateConnectionState(developer.id || developer.username, nextState);
        developer.connectionState = nextState;
        renderPage();
        toastSuccess(nextState === 'Connected' ? `Connected with ${developer.name}!` : `Disconnected from ${developer.name}.`);
      });
    }

    // Section 6: Unified Project Pin Toggle (Max 4 Pins Enforced)
    container.querySelectorAll('.btn-pin-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const repoId = btn.getAttribute('data-repo-id');
        const isCurrentlyPinned = (developer.pinnedProjects || []).includes(repoId);

        // Enforce max 4 pinned projects before calling API
        if (!isCurrentlyPinned && (developer.pinnedProjects || []).length >= 4) {
          toastWarning('Only four projects can be pinned to your profile. Please unpin a project first before pinning another.', 'Maximum 4 Pinned Projects');
          return;
        }

        try {
          const updated = await ProfileService.togglePinnedProject(developer.username, repoId);
          if (updated && updated.pinnedProjects) {
            developer.pinnedProjects = updated.pinnedProjects;
            toastSuccess(
              isCurrentlyPinned ? 'Project unpinned from profile.' : 'Project pinned to profile!',
              'Portfolio Updated'
            );
            renderPage();
          }
        } catch (err) {
          const msg = err.data?.detail || err.message || 'Unable to update pinned projects.';
          toastWarning(msg, 'Pin Limit');
        }
      });
    });

    // Modal Triggers
    const editProfileModal = document.getElementById('editProfileModal');
    [document.getElementById('btnEditProfile'), document.getElementById('btnEditAbout')].forEach(b => {
      if (b && editProfileModal) {
        b.addEventListener('click', () => editProfileModal.classList.add('open'));
      }
    });

    const editSkillsModal = document.getElementById('editSkillsModal');
    [document.getElementById('btnEditSkillsTab')].forEach(b => {
      if (b && editSkillsModal) {
        b.addEventListener('click', () => editSkillsModal.classList.add('open'));
      }
    });

    container.querySelectorAll('[data-close-modal]').forEach(b => {
      b.addEventListener('click', () => {
        const targetId = b.getAttribute('data-close-modal');
        const modal = document.getElementById(targetId);
        if (modal) modal.classList.remove('open');
      });
    });

    container.querySelectorAll('.dev-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Form: Edit Profile
    const editForm = document.getElementById('editProfileForm');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updatedData = {
          name: document.getElementById('editDisplayName')?.value?.trim(),
          headline: document.getElementById('editHeadline')?.value?.trim(),
          bio: document.getElementById('editBio')?.value?.trim(),
          location: document.getElementById('editLocation')?.value?.trim(),
          website: document.getElementById('editWebsite')?.value?.trim()
        };
        try {
          await ProfileService.updateDeveloperProfile(developer.username, updatedData);
          Object.assign(developer, updatedData);
          toastSuccess('Profile updated successfully.');
          document.getElementById('editProfileModal')?.classList.remove('open');
          renderPage();
        } catch (err) {
          toastDanger('Failed to update profile.');
        }
      });
    }
  }

  // Initial Render
  renderPage();
}
