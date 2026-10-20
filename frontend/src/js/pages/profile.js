/**
 * DevSync Profile Controller
 * Live preview and public profile editing.
 */

import { ProfileService } from '../services/profile-service.js';
import { toastSuccess, toastDanger } from '../components/toast.js';

export async function initProfilePage() {
  const profileForm = document.getElementById('profileEditForm');
  const avatarUploadInput = document.getElementById('avatarUploadInput');
  const avatarPreview = document.getElementById('avatarPreview');

  // Live preview DOM elements
  const livePreviewAvatar = document.getElementById('livePreviewAvatar');
  const livePreviewName = document.getElementById('livePreviewName');
  const livePreviewHandle = document.getElementById('livePreviewHandle');
  const livePreviewBio = document.getElementById('livePreviewBio');
  const livePreviewSkills = document.getElementById('livePreviewSkills');
  const btnEditViewVisitor = document.getElementById('btnEditViewVisitor');

  function updateLivePreview() {
    const dName = profileForm?.querySelector('#displayName')?.value.trim();
    const uName = profileForm?.querySelector('#username')?.value.trim();
    const bioText = profileForm?.querySelector('#bio')?.value.trim();
    const skillsText = profileForm?.querySelector('#skills')?.value.trim();

    if (livePreviewName) livePreviewName.textContent = dName || 'Developer Name';
    if (livePreviewHandle) livePreviewHandle.textContent = uName ? `@${uName}` : '@username';
    if (livePreviewBio) livePreviewBio.textContent = bioText || 'Biography preview will appear here...';

    if (btnEditViewVisitor && uName) {
      btnEditViewVisitor.href = `/u/${uName}?preview=visitor`;
    }

    if (livePreviewSkills) {
      const skillsArr = skillsText ? skillsText.split(',').map(s => s.trim()).filter(Boolean) : [];
      livePreviewSkills.innerHTML = skillsArr.map(s => `
        <span class="badge" style="background-color: var(--color-surface-subtle); border: 1px solid var(--color-border); font-size: 11px; padding: 3px 8px; border-radius: 4px; color: var(--color-text-primary);">
          ${s}
        </span>
      `).join('');
    }
  }

  // Load current profile data
  const user = await ProfileService.getProfile();
  if (profileForm && user) {
    if (user.name) profileForm.querySelector('#displayName').value = user.name;
    if (user.username) profileForm.querySelector('#username').value = user.username;
    if (user.bio) profileForm.querySelector('#bio').value = user.bio;
    if (user.skills) profileForm.querySelector('#skills').value = (user.skills || []).map(s => typeof s === 'string' ? s : s.name).join(', ');
    if (user.website) profileForm.querySelector('#website').value = user.website;
    if (user.avatar) {
      if (avatarPreview) avatarPreview.src = user.avatar;
      if (livePreviewAvatar) livePreviewAvatar.src = user.avatar;
    }

    const emailEl = profileForm.querySelector('#profileEmail');
    if (emailEl) emailEl.value = user.email || '';

    const githubEl = profileForm.querySelector('#socialGithub');
    if (githubEl) {
      githubEl.value = user.social?.github || (user.github ? (user.github.startsWith('http') ? user.github : `https://github.com/${user.github}`) : '');
    }

    const linkedinEl = profileForm.querySelector('#socialLinkedin');
    if (linkedinEl) {
      linkedinEl.value = user.social?.linkedin || (user.linkedin ? (user.linkedin.startsWith('http') ? user.linkedin : `https://linkedin.com/in/${user.linkedin}`) : '');
    }

    const instagramEl = profileForm.querySelector('#socialInstagram');
    if (instagramEl) {
      instagramEl.value = user.social?.instagram || (user.instagram ? (user.instagram.startsWith('http') ? user.instagram : `https://instagram.com/${user.instagram}`) : '');
    }

    updateLivePreview();
  }

  // Bind real-time input listeners for live preview
  if (profileForm) {
    ['#displayName', '#username', '#bio', '#skills'].forEach(sel => {
      profileForm.querySelector(sel)?.addEventListener('input', updateLivePreview);
    });
  }

  // Avatar upload preview
  let updatedAvatarData = null;
  if (avatarUploadInput) {
    avatarUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toastDanger('Avatar file exceeds 5MB limit.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (re) => {
          if (avatarPreview) avatarPreview.src = re.target.result;
          if (livePreviewAvatar) livePreviewAvatar.src = re.target.result;
          updatedAvatarData = re.target.result;
          toastSuccess('Avatar preview updated.');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = profileForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      const updates = {
        name: profileForm.querySelector('#displayName').value.trim(),
        username: profileForm.querySelector('#username').value.trim(),
        bio: profileForm.querySelector('#bio').value.trim(),
        website: profileForm.querySelector('#website').value.trim(),
        skills: profileForm.querySelector('#skills').value.split(',').map(s => s.trim()).filter(Boolean),
        email: profileForm.querySelector('#profileEmail') ? profileForm.querySelector('#profileEmail').value.trim() : (user?.email || ''),
        social: {
          github: profileForm.querySelector('#socialGithub') ? profileForm.querySelector('#socialGithub').value.trim() : '',
          linkedin: profileForm.querySelector('#socialLinkedin') ? profileForm.querySelector('#socialLinkedin').value.trim() : '',
          instagram: profileForm.querySelector('#socialInstagram') ? profileForm.querySelector('#socialInstagram').value.trim() : ''
        }
      };

      if (updatedAvatarData) {
        updates.avatar = updatedAvatarData;
      }

      try {
        await ProfileService.updateProfile(updates);

        // Keep local session updated
        try {
          const rawSession = localStorage.getItem('devsync_user_session');
          if (rawSession) {
            const sess = JSON.parse(rawSession);
            Object.assign(sess, updates);
            localStorage.setItem('devsync_user_session', JSON.stringify(sess));
          }
        } catch (err) {}

        toastSuccess('Profile and social links updated successfully!', 'Changes Saved');
      } catch (err) {
        toastDanger(err.message || 'Failed to update profile.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Profile Changes →';
      }
    });
  }
}
