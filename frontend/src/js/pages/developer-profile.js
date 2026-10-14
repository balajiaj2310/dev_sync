/**
 * DevSync Developer Public Profile Page Controller
 * Faithful implementation of the Minimal Developer Card system matching reference image
 */

import { ProfileService } from '../services/profile-service.js';
import { ConnectionService } from '../services/connection-service.js';
import { AuthService } from '../services/auth-service.js';
import { toastSuccess, toastInfo, toastWarning } from '../components/toast.js';
import { ROUTES } from '../core/route-config.js';

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

  if (developer) {
    document.title = `${developer.name || developer.username} (@${developer.username}) — DevSync`;
  }

  // Check if viewing own profile
  const currentUser = await ProfileService.getProfile();
  const isOwner = currentUser && developer && (
    currentUser.username.toLowerCase() === developer.username.toLowerCase() ||
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

  // Set Page Title
  document.title = `${developer.name} (@${developer.username}) — DevSync`;

  // Filter projects by permission
  const visibleProjects = (developer.projects || []).filter(p => {
    if (isOwner) return true;
    return p.visibility === 'Public';
  });

  const pinnedProjectsList = visibleProjects.filter(p =>
    (developer.pinnedProjects || []).includes(p.id)
  );

  let currentTab = 'overview';

  function renderPage() {
    container.innerHTML = `
      <!-- Hero Identity Header Card -->
      <section class="dev-hero-card" aria-label="Developer identity">
        <div class="dev-hero-top">
          <!-- Left: Avatar & Identity Details -->
          <div class="dev-hero-identity">
            <div class="dev-avatar-container">
              ${developer.avatar ? `
                <img src="${developer.avatar}" alt="${developer.name}" class="dev-avatar-img" id="heroAvatar" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';" />
              ` : `
                <div class="dev-avatar-fallback">${(developer.name || 'D').charAt(0)}</div>
              `}
              <span class="dev-status-indicator ${developer.collaborationStatusType === 'busy' ? 'busy' : ''}" title="${developer.collaborationStatus || 'Online'}"></span>
            </div>

            <div class="dev-identity-details">
              <div class="dev-name-title-row">
                <h1 class="dev-display-name">${escapeHtml(developer.name)}</h1>
                ${developer.isVerified !== false ? `
                  <span class="dev-verified-badge" title="Verified Developer">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                  </span>
                ` : ''}
              </div>

              <div class="dev-handle-role-row">
                <span class="dev-username-handle">@${escapeHtml(developer.username)}</span>
                <span class="dev-role-pill">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  ${escapeHtml(developer.role || 'Developer')}
                </span>
              </div>

              <p class="dev-hero-bio">${escapeHtml(developer.headline || developer.bio || '')}</p>

              <div class="dev-hero-meta-row">
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

                  ${developer.social?.instagram ? `
                    <a href="${escapeHtml(developer.social.instagram)}" target="_blank" rel="noopener noreferrer" class="dev-social-btn" title="Instagram">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Status Badge, Actions, Stats -->
          <div class="dev-hero-side">
            <span class="dev-availability-badge ${developer.collaborationStatusType || 'available'}">
              ${escapeHtml(developer.collaborationStatus || 'Available for collaboration')}
            </span>

            <div class="dev-actions-row">
              ${isOwner ? `
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnEditProfile">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Profile
                </button>
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnShareProfile" title="Copy profile URL">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
              ` : `
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnFollowDev">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  <span>${developer.isFollowing ? 'Following &check;' : 'Follow'}</span>
                </button>
                <button type="button" class="btn btn-mint btn-pill btn-sm" id="btnConnectDev">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  <span>${developer.connectionState === 'Connected' ? 'Connected &check;' : (developer.connectionState === 'Request Sent' ? 'Pending' : 'Connect')}</span>
                </button>
                <button type="button" class="btn btn-outline btn-sm" style="border-radius: 50%; width: 34px; height: 34px; padding: 0;" id="btnMoreOptions" title="More options">
                  &bull;&bull;&bull;
                </button>
              `}
            </div>

            <!-- Followers / Following / Projects / Teams -->
            <div class="dev-stats-counter-row">
              <div class="dev-counter-item" data-tab="collaborators">
                <span class="dev-counter-num" id="followersCount">${developer.stats?.followers ?? 0}</span>
                <span class="dev-counter-lbl">Followers</span>
              </div>
              <div class="dev-counter-item" data-tab="collaborators">
                <span class="dev-counter-num">${developer.stats?.following ?? 0}</span>
                <span class="dev-counter-lbl">Following</span>
              </div>
              <div class="dev-counter-item" data-tab="projects">
                <span class="dev-counter-num">${visibleProjects.length}</span>
                <span class="dev-counter-lbl">Projects</span>
              </div>
              <div class="dev-counter-item" data-tab="teams">
                <span class="dev-counter-num">${(developer.teams || []).length}</span>
                <span class="dev-counter-lbl">Teams</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sub-navigation Tabs -->
        <nav class="dev-profile-tabs-bar" role="tablist" aria-label="Profile Sections">
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'projects' ? 'active' : ''}" data-tab="projects">
            Projects <span class="dev-tab-count">${visibleProjects.length}</span>
          </button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'pinned' ? 'active' : ''}" data-tab="pinned">
            Pinned <span class="dev-tab-count">${pinnedProjectsList.length}</span>
          </button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'skills' ? 'active' : ''}" data-tab="skills">Skills</button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'activity' ? 'active' : ''}" data-tab="activity">Activity</button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'achievements' ? 'active' : ''}" data-tab="achievements">Achievements</button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'experience' ? 'active' : ''}" data-tab="experience">Experience</button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'teams' ? 'active' : ''}" data-tab="teams">Teams</button>
          <button type="button" role="tab" class="dev-tab-btn ${currentTab === 'collaborators' ? 'active' : ''}" data-tab="collaborators">Collaborators</button>
        </nav>
      </section>

      <!-- Active Tab Content Area -->
      <div id="tabContentArea">
        ${renderTabContent(currentTab)}
      </div>

      <!-- Modals Container -->
      ${renderModals()}
    `;

    attachEventListeners();
  }

  function renderTabContent(tab) {
    switch (tab) {
      case 'projects':
        return renderProjectsTab();
      case 'pinned':
        return renderPinnedTab();
      case 'skills':
        return renderSkillsTab();
      case 'activity':
        return renderActivityTab();
      case 'achievements':
        return renderAchievementsTab();
      case 'experience':
        return renderExperienceTab();
      case 'teams':
        return renderTeamsTab();
      case 'collaborators':
        return renderCollaboratorsTab();
      case 'overview':
      default:
        return renderOverviewTab();
    }
  }

  /* -------------------------------------------------------------------------
   * Overview Tab (Reference Layout: 2 Columns)
   * ------------------------------------------------------------------------- */
  function renderOverviewTab() {
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Profile
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

                ${developer.education?.institution ? `
                  <div class="dev-fact-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    <span>${escapeHtml(developer.education.institution)}</span>
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
                  <span>${developer.openToInvitations !== false ? 'Open to project invitations' : 'Currently busy'}</span>
                </div>
              </div>
            </div>
          </article>

          <!-- Pinned Projects Card -->
          <article class="dev-card" aria-label="Pinned projects">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                Pinned Projects
              </h2>
              <a href="#" class="dev-card-link-action" data-nav-tab="pinned">View all &rarr;</a>
            </div>

            <div class="dev-projects-grid">
              ${pinnedProjectsList.length > 0 ? pinnedProjectsList.map(p => renderProjectCard(p)).join('') : `
                <div class="text-secondary py-4 text-center" style="grid-column: 1 / -1; font-size: 13px;">
                  No pinned projects selected yet.
                </div>
              `}
            </div>
          </article>

          <!-- Projects Section Card -->
          <article class="dev-card" aria-label="Projects">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                Projects
              </h2>
              <a href="#" class="dev-card-link-action" data-nav-tab="projects">View all &rarr;</a>
            </div>

            <div class="dev-projects-grid">
              ${visibleProjects.slice(0, 3).map(p => renderProjectCard(p)).join('')}
            </div>
          </article>

          <!-- Recent Activity Card -->
          <article class="dev-card" aria-label="Recent activity">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Recent Activity
              </h2>
              <a href="#" class="dev-card-link-action" data-nav-tab="activity">View all &rarr;</a>
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
          <!-- Contribution Stats Card -->
          <article class="dev-card" aria-label="Contribution statistics">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Contribution Stats
              </h2>
              <select class="form-select form-select-sm" style="width: auto; font-size: 11.5px; padding: 2px 8px; height: 26px;" id="statsPeriodSelect">
                <option value="12">Last 12 months</option>
                <option value="6">Last 6 months</option>
                <option value="1">Last 30 days</option>
              </select>
            </div>

            <div class="dev-stats-grid">
              <!-- Repositories (Mint) -->
              <div class="dev-stat-tile mint">
                <div class="dev-stat-tile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                </div>
                <div class="dev-stat-tile-data">
                  <span class="dev-stat-tile-num">${developer.stats?.repositoriesCount ?? visibleProjects.length}</span>
                  <span class="dev-stat-tile-lbl">Repositories</span>
                </div>
              </div>

              <!-- Contributions (Blue) -->
              <div class="dev-stat-tile blue">
                <div class="dev-stat-tile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div class="dev-stat-tile-data">
                  <span class="dev-stat-tile-num">${developer.stats?.contributionsCount ?? 0}</span>
                  <span class="dev-stat-tile-lbl">Contributions</span>
                </div>
              </div>

              <!-- Pull Requests (Purple) -->
              <div class="dev-stat-tile purple">
                <div class="dev-stat-tile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
                </div>
                <div class="dev-stat-tile-data">
                  <span class="dev-stat-tile-num">${developer.stats?.pullRequestsCount ?? 0}</span>
                  <span class="dev-stat-tile-lbl">Pull Requests</span>
                </div>
              </div>

              <!-- Issues (Amber) -->
              <div class="dev-stat-tile amber">
                <div class="dev-stat-tile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div class="dev-stat-tile-data">
                  <span class="dev-stat-tile-num">${developer.stats?.issuesCount ?? 0}</span>
                  <span class="dev-stat-tile-lbl">Issues</span>
                </div>
              </div>
            </div>
          </article>

          <!-- Achievements Card -->
          <article class="dev-card" aria-label="Achievements">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Achievements
              </h2>
              <a href="#" class="dev-card-link-action" data-nav-tab="achievements">View all &rarr;</a>
            </div>

            <div class="dev-achievements-list">
              ${(developer.achievements || []).length > 0 ? (developer.achievements || []).map(ach => `
                <div class="dev-achievement-item">
                  <div class="dev-achievement-badge ${ach.color || 'green'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                  </div>
                  <div class="dev-achievement-info">
                    <span class="dev-achievement-title">${escapeHtml(ach.title)}</span>
                    <span class="dev-achievement-desc">${escapeHtml(ach.description)}</span>
                  </div>
                </div>
              `).join('') : `
                <div class="text-secondary py-3 text-center" style="font-size: 13px;">
                  No achievements recorded yet.
                </div>
              `}
            </div>
          </article>

          <!-- Top Skills Card -->
          <article class="dev-card" aria-label="Top skills">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Top Skills
              </h2>
              ${isOwner ? `
                <button type="button" class="btn btn-outline btn-pill btn-sm" id="btnEditSkills">Edit</button>
              ` : ''}
            </div>

            <div class="dev-skills-cloud">
              ${(developer.skills || []).length > 0 ? (developer.skills || []).map(skill => {
                const name = typeof skill === 'string' ? skill : skill.name;
                const color = typeof skill === 'string' ? getSkillColor(skill) : (skill.color || 'blue');
                return `<span class="dev-tech-pill ${color}">${escapeHtml(name)}</span>`;
              }).join('') : `
                <div class="text-secondary py-2" style="font-size: 13px;">No skills added yet.</div>
              `}
            </div>
          </article>

          <!-- Teams Card -->
          <article class="dev-card" aria-label="Teams">
            <div class="dev-card-header">
              <h2 class="dev-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Teams
              </h2>
              <a href="#" class="dev-card-link-action" data-nav-tab="teams">View all &rarr;</a>
            </div>

            <div class="dev-teams-list">
              ${(developer.teams || []).length > 0 ? (developer.teams || []).map(team => `
                <a href="${ROUTES.TEAM_DETAIL}?id=${team.id}" class="dev-team-item">
                  <img src="${team.avatar}" alt="${team.name}" class="dev-team-avatar" />
                  <div class="dev-team-meta">
                    <span class="dev-team-name">${escapeHtml(team.name)}</span>
                    <span class="dev-team-role">${escapeHtml(team.role)} &bull; ${team.membersCount || 0} members</span>
                  </div>
                </a>
              `).join('') : `
                <div class="text-secondary py-3 text-center" style="font-size: 13px;">
                  No team memberships yet.
                </div>
              `}
            </div>
          </article>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Project Card Renderer (Clean Card Concept)
   * ------------------------------------------------------------------------- */
  function renderProjectCard(project) {
    const isPinned = (developer.pinnedProjects || []).includes(project.id);
    return `
      <div class="dev-project-card">
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
                <span class="dev-badge-visibility ${project.visibility ? project.visibility.toLowerCase() : 'public'}">
                  ${escapeHtml(project.visibility || 'Public')}
                </span>
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
            ${isOwner ? `
              <button type="button" class="btn-pin-toggle" data-repo-id="${project.id}" title="${isPinned ? 'Unpin from profile' : 'Pin to profile'}" style="background: none; border: none; cursor: pointer; color: ${isPinned ? '#0d9488' : '#9ca3af'}; padding: 0 4px;">
                📌
              </button>
            ` : ''}
          </div>
          <span>${escapeHtml(project.updated || 'Recently updated')}</span>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Full Projects Tab
   * ------------------------------------------------------------------------- */
  function renderProjectsTab() {
    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <h2 class="dev-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            All Projects &amp; Repositories
          </h2>
          <span class="text-secondary" style="font-size: 13px;">Showing ${visibleProjects.length} projects</span>
        </div>

        <div class="dev-projects-grid">
          ${visibleProjects.map(p => renderProjectCard(p)).join('')}
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Pinned Tab
   * ------------------------------------------------------------------------- */
  function renderPinnedTab() {
    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <h2 class="dev-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
            Featured Pinned Work
          </h2>
          ${isOwner ? `<span class="text-secondary" style="font-size: 12px;">Click the pin icon to add or remove projects</span>` : ''}
        </div>

        <div class="dev-projects-grid">
          ${pinnedProjectsList.length > 0 ? pinnedProjectsList.map(p => renderProjectCard(p)).join('') : `
            <div class="text-secondary py-6 text-center" style="grid-column: 1 / -1; font-size: 13px;">
              No pinned work to display.
            </div>
          `}
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Skills Tab
   * ------------------------------------------------------------------------- */
  function renderSkillsTab() {
    const categories = {
      'Backend': [],
      'Frontend': [],
      'Database': [],
      'Tools & Platforms': []
    };

    (developer.skills || []).forEach(s => {
      const name = typeof s === 'string' ? s : s.name;
      const cat = typeof s === 'string' ? categorizeSkill(s) : (s.category || 'Tools & Platforms');
      const color = typeof s === 'string' ? getSkillColor(s) : (s.color || 'blue');
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ name, color });
    });

    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <h2 class="dev-card-title">Technical Skills &amp; Stack</h2>
          ${isOwner ? `<button type="button" class="btn btn-outline btn-pill btn-sm" id="btnEditSkillsTab">Edit Skills</button>` : ''}
        </div>

        <div style="display: flex; flex-direction: column; gap: 24px;">
          ${Object.entries(categories).map(([cat, list]) => `
            <div>
              <h3 class="font-heading mb-2" style="font-size: 14px; font-weight: 700; color: #374151;">${cat}</h3>
              <div class="dev-skills-cloud">
                ${list.length > 0 ? list.map(item => `
                  <span class="dev-tech-pill ${item.color}" style="font-size: 12.5px; padding: 4px 12px;">${escapeHtml(item.name)}</span>
                `).join('') : '<span class="text-secondary" style="font-size: 12px;">None specified</span>'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Activity Tab
   * ------------------------------------------------------------------------- */
  function renderActivityTab() {
    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <h2 class="dev-card-title">Public Development Activity Timeline</h2>
        </div>

        <div class="dev-activity-list" style="margin-top: 10px;">
          ${(developer.activities || []).map(act => `
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
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Achievements Tab
   * ------------------------------------------------------------------------- */
  function renderAchievementsTab() {
    return `
      <div class="dev-card">
        <div class="dev-card-header">
          <h2 class="dev-card-title">Earned Developer Milestones &amp; Badges</h2>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
          ${(developer.achievements || []).map(ach => `
            <div class="dev-card" style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div class="d-flex align-items-center gap-3 mb-2">
                <div class="dev-achievement-badge ${ach.color || 'green'}" style="width: 36px; height: 36px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h4 class="font-heading" style="font-size: 14px; font-weight: 700; margin: 0;">${escapeHtml(ach.title)}</h4>
                  <span class="text-secondary" style="font-size: 11px;">${escapeHtml(ach.date || 'Earned')}</span>
                </div>
              </div>
              <p style="font-size: 12.5px; color: #4b5563; margin: 0;">${escapeHtml(ach.description)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Experience & Education Tab
   * ------------------------------------------------------------------------- */
  function renderExperienceTab() {
    return `
      <div class="dev-card">
        <h2 class="dev-card-title mb-4">Education &amp; Experience</h2>

        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <h3 class="font-heading mb-2" style="font-size: 14px; font-weight: 700; color: #374151;">Education</h3>
            <div class="dev-card" style="padding: 16px; border-radius: 10px;">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <strong style="font-size: 14px; color: #111827;">${escapeHtml(developer.education?.degree || 'BCA Student')}</strong>
                <span class="text-secondary" style="font-size: 12px;">${escapeHtml(developer.education?.timeline || '2022 - 2025')}</span>
              </div>
              <div style="font-size: 13px; color: #4b5563;">${escapeHtml(developer.education?.institution || 'Bengaluru City University')}</div>
              <div class="text-secondary mt-1" style="font-size: 12px;">${escapeHtml(developer.education?.location || 'Bengaluru, India')}</div>
            </div>
          </div>

          <div>
            <h3 class="font-heading mb-2" style="font-size: 14px; font-weight: 700; color: #374151;">Work Experience</h3>
            ${(developer.experience || []).map(exp => `
              <div class="dev-card" style="padding: 16px; border-radius: 10px; margin-bottom: 10px;">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <strong style="font-size: 14px; color: #111827;">${escapeHtml(exp.role)}</strong>
                  <span class="text-secondary" style="font-size: 12px;">${escapeHtml(exp.timeline)}</span>
                </div>
                <div style="font-size: 13px; color: #0d9488; font-weight: 600;">${escapeHtml(exp.organization)}</div>
                <p style="font-size: 12.5px; color: #4b5563; margin: 6px 0 0 0;">${escapeHtml(exp.description)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Teams Tab
   * ------------------------------------------------------------------------- */
  function renderTeamsTab() {
    return `
      <div class="dev-card">
        <h2 class="dev-card-title mb-4">Teams &amp; Organizations</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
          ${(developer.teams || []).map(team => `
            <div class="dev-card" style="padding: 18px; border-radius: 12px;">
              <div class="d-flex align-items-center gap-3 mb-2">
                <img src="${team.avatar}" alt="${team.name}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover;" />
                <div>
                  <h4 class="font-heading" style="font-size: 14.5px; font-weight: 700; margin: 0;">${escapeHtml(team.name)}</h4>
                  <span class="text-secondary" style="font-size: 12px;">${escapeHtml(team.role)} &bull; ${team.membersCount || 0} members</span>
                </div>
              </div>
              <p style="font-size: 12.5px; color: #4b5563; margin-bottom: 12px;">${escapeHtml(team.description || '')}</p>
              <a href="${ROUTES.TEAM_DETAIL}?id=${team.id}" class="btn btn-outline btn-sm w-100">View Team Workspace</a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Collaborators Tab
   * ------------------------------------------------------------------------- */
  function renderCollaboratorsTab() {
    return `
      <div class="dev-card">
        <h2 class="dev-card-title mb-4">Collaborators &amp; Connections</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
          ${(developer.collaborators || []).map(c => `
            <div class="dev-card text-center" style="padding: 20px; border-radius: 12px;">
              <img src="${c.avatar}" alt="${c.name}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;" />
              <h4 class="font-heading" style="font-size: 14px; font-weight: 700; margin: 0;">${escapeHtml(c.name)}</h4>
              <div class="text-secondary" style="font-size: 12px; margin-bottom: 6px;">@${escapeHtml(c.username)}</div>
              <div style="font-size: 12px; color: #4b5563; margin-bottom: 14px;">${escapeHtml(c.role)}</div>
              <a href="${ROUTES.DEVELOPER_PROFILE}?user=${encodeURIComponent(c.username)}" class="btn btn-outline btn-sm btn-pill w-100">View Profile</a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Modals: Edit Profile & Edit Skills
   * ------------------------------------------------------------------------- */
  function renderModals() {
    return `
      <!-- Edit Profile Modal -->
      <div class="dev-modal-overlay" id="editProfileModal">
        <div class="dev-modal-dialog">
          <div class="dev-modal-header">
            <h3 class="dev-modal-title">Edit Public Profile</h3>
            <button type="button" class="dev-modal-close" data-close-modal="editProfileModal">&times;</button>
          </div>
          <form id="editProfileForm">
            <div class="dev-modal-body">
              <div class="form-group">
                <label class="form-label" for="editDisplayName">Display Name</label>
                <input type="text" id="editDisplayName" class="form-control" value="${escapeHtml(developer.name)}" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="editHeadline">Headline / Role</label>
                <input type="text" id="editHeadline" class="form-control" value="${escapeHtml(developer.headline || developer.role || '')}" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="editBio">Bio</label>
                <textarea id="editBio" class="form-control" rows="3">${escapeHtml(developer.bio || '')}</textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="editLocation">Location</label>
                <input type="text" id="editLocation" class="form-control" value="${escapeHtml(developer.location || '')}" placeholder="City, Country" />
              </div>

              <div class="form-group">
                <label class="form-label" for="editWebsite">Personal Website</label>
                <input type="url" id="editWebsite" class="form-control" value="${escapeHtml(developer.website || '')}" placeholder="https://yourdomain.dev" />
              </div>

              <div class="form-group">
                <label class="form-label" for="editCollabStatus">Collaboration Status</label>
                <select id="editCollabStatus" class="form-select">
                  <option value="Available for collaboration" ${developer.collaborationStatus === 'Available for collaboration' ? 'selected' : ''}>Available for collaboration</option>
                  <option value="Open to project invitations" ${developer.collaborationStatus === 'Open to project invitations' ? 'selected' : ''}>Open to project invitations</option>
                  <option value="Currently busy" ${developer.collaborationStatus === 'Currently busy' ? 'selected' : ''}>Currently busy</option>
                  <option value="Not publicly specified" ${developer.collaborationStatus === 'Not publicly specified' ? 'selected' : ''}>Not publicly specified</option>
                </select>
              </div>
            </div>
            <div class="dev-modal-footer">
              <button type="button" class="btn btn-outline btn-pill" data-close-modal="editProfileModal">Cancel</button>
              <button type="submit" class="btn btn-primary btn-pill">Save Profile Changes</button>
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
            <div class="d-flex gap-2">
              <input type="text" id="newSkillInput" class="form-control" placeholder="Add a skill (e.g. Go, GraphQL, Redis)" />
              <select id="newSkillCategory" class="form-select" style="max-width: 150px;">
                <option value="Backend">Backend</option>
                <option value="Frontend">Frontend</option>
                <option value="Database">Database</option>
                <option value="Tools & Platforms">Tools</option>
              </select>
              <button type="button" class="btn btn-primary" id="btnAddSkill">Add</button>
            </div>

            <label class="form-label mt-3">Current Skills (Click x to remove)</label>
            <div class="dev-skills-cloud" id="skillsModalTags">
              ${(developer.skills || []).map((s, idx) => {
                const name = typeof s === 'string' ? s : s.name;
                const color = typeof s === 'string' ? getSkillColor(s) : (s.color || 'blue');
                return `
                  <span class="dev-tech-pill ${color}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;">
                    ${escapeHtml(name)}
                    <button type="button" class="btn-remove-skill" data-skill-idx="${idx}" style="background: none; border: none; cursor: pointer; color: inherit; font-size: 14px; line-height: 1; padding: 0;">&times;</button>
                  </span>
                `;
              }).join('')}
            </div>
          </div>
          <div class="dev-modal-footer">
            <button type="button" class="btn btn-primary btn-pill" data-close-modal="editSkillsModal">Done</button>
          </div>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
   * Event Listeners & State Binding
   * ------------------------------------------------------------------------- */
  function attachEventListeners() {
    // Tab switching
    container.querySelectorAll('.dev-tab-btn, [data-nav-tab], .dev-counter-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = el.getAttribute('data-tab') || el.getAttribute('data-nav-tab');
        if (targetTab && targetTab !== currentTab) {
          currentTab = targetTab;
          renderPage();
        }
      });
    });

    // Share Profile button (working clipboard copy)
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
        let nextState = 'Request Sent';
        if (developer.connectionState === 'Request Sent') {
          nextState = 'Not Connected';
          toastInfo('Connection request cancelled.');
        } else if (developer.connectionState === 'Connected') {
          nextState = 'Not Connected';
          toastInfo(`Disconnected from ${developer.name}.`);
        } else {
          nextState = 'Connected';
          toastSuccess(`Connection invitation sent to ${developer.name}!`, 'Connected');
        }
        await ConnectionService.updateConnectionState(developer.id || developer.username, nextState);
        developer.connectionState = nextState;
        renderPage();
      });
    }

    // Pin Toggle
    container.querySelectorAll('.btn-pin-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const repoId = btn.getAttribute('data-repo-id');
        const updated = await ProfileService.togglePinnedProject(developer.username, repoId);
        if (updated) {
          developer.pinnedProjects = updated.pinnedProjects;
          toastSuccess('Pinned projects updated.');
          renderPage();
        }
      });
    });

    // Modal Triggers: Edit Profile
    const editProfileModal = document.getElementById('editProfileModal');
    const openEditButtons = [document.getElementById('btnEditProfile'), document.getElementById('btnEditAbout')];
    openEditButtons.forEach(b => {
      if (b && editProfileModal) {
        b.addEventListener('click', () => editProfileModal.classList.add('open'));
      }
    });

    // Modal Triggers: Edit Skills
    const editSkillsModal = document.getElementById('editSkillsModal');
    const openSkillButtons = [document.getElementById('btnEditSkills'), document.getElementById('btnEditSkillsTab')];
    openSkillButtons.forEach(b => {
      if (b && editSkillsModal) {
        b.addEventListener('click', () => editSkillsModal.classList.add('open'));
      }
    });

    // Modal Close
    container.querySelectorAll('[data-close-modal]').forEach(b => {
      b.addEventListener('click', () => {
        const targetId = b.getAttribute('data-close-modal');
        const modal = document.getElementById(targetId);
        if (modal) modal.classList.remove('open');
      });
    });

    // Close on overlay click
    container.querySelectorAll('.dev-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Edit Profile Form Submission
    const form = document.getElementById('editProfileForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
          name: document.getElementById('editDisplayName').value.trim(),
          headline: document.getElementById('editHeadline').value.trim(),
          bio: document.getElementById('editBio').value.trim(),
          location: document.getElementById('editLocation').value.trim(),
          website: document.getElementById('editWebsite').value.trim(),
          collaborationStatus: document.getElementById('editCollabStatus').value
        };

        const updated = await ProfileService.updateDeveloperProfile(developer.username, updates);
        if (updated) {
          Object.assign(developer, updated);
          toastSuccess('Public profile updated successfully!', 'Saved');
          if (editProfileModal) editProfileModal.classList.remove('open');
          renderPage();
        }
      });
    }

    // Add Skill in Modal
    const btnAddSkill = document.getElementById('btnAddSkill');
    const newSkillInput = document.getElementById('newSkillInput');
    const newSkillCategory = document.getElementById('newSkillCategory');
    if (btnAddSkill && newSkillInput) {
      btnAddSkill.addEventListener('click', async () => {
        const raw = newSkillInput.value.trim();
        if (!raw) return;
        const normalized = raw.charAt(0).toUpperCase() + raw.slice(1);
        const exists = (developer.skills || []).some(s => {
          const sName = typeof s === 'string' ? s : s.name;
          return sName.toLowerCase() === normalized.toLowerCase();
        });
        if (exists) {
          toastWarning(`Skill "${normalized}" is already on your profile.`);
          return;
        }

        const newSkill = {
          name: normalized,
          category: newSkillCategory?.value || 'Backend',
          color: getSkillColor(normalized)
        };

        developer.skills.push(newSkill);
        await ProfileService.updateDeveloperProfile(developer.username, { skills: developer.skills });
        toastSuccess(`Added skill "${normalized}".`);
        renderPage();
        const reopenedModal = document.getElementById('editSkillsModal');
        if (reopenedModal) reopenedModal.classList.add('open');
      });
    }

    // Remove Skill in Modal
    container.querySelectorAll('.btn-remove-skill').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-skill-idx'), 10);
        if (!isNaN(idx) && developer.skills[idx]) {
          const removed = developer.skills.splice(idx, 1)[0];
          await ProfileService.updateDeveloperProfile(developer.username, { skills: developer.skills });
          toastInfo(`Removed skill "${removed.name || removed}".`);
          renderPage();
          const reopenedModal = document.getElementById('editSkillsModal');
          if (reopenedModal) reopenedModal.classList.add('open');
        }
      });
    });
  }

  // Initial Render
  renderPage();
}

/* ---------------------------------------------------------------------------
 * Helper Utilities
 * --------------------------------------------------------------------------- */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSkillColor(skillName) {
  const s = (skillName || '').toLowerCase();
  if (['python', 'flask', 'django', 'java', 'c++', 'c#', 'rust'].includes(s)) return 'blue';
  if (['django', 'mint', 'tailwind', 'fastapi'].includes(s)) return 'mint';
  if (['javascript', 'js', 'node', 'express'].includes(s)) return 'amber';
  if (['html', 'ruby', 'git', 'laravel'].includes(s)) return 'rose';
  if (['css', 'bootstrap', 'sass', 'redux', 'c#'].includes(s)) return 'purple';
  if (['postgresql', 'mysql', 'sql', 'sqlite', 'redis', 'mongodb'].includes(s)) return 'cyan';
  return 'neutral';
}

function categorizeSkill(skillName) {
  const s = (skillName || '').toLowerCase();
  if (['javascript', 'html', 'css', 'react', 'vue', 'bootstrap', 'tailwind'].includes(s)) return 'Frontend';
  if (['python', 'django', 'flask', 'java', 'node', 'express', 'fastapi', 'go'].includes(s)) return 'Backend';
  if (['postgresql', 'mysql', 'sql', 'sqlite', 'mongodb', 'redis'].includes(s)) return 'Database';
  return 'Tools & Platforms';
}
