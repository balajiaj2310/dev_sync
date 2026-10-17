/**
 * DevSync Profile Controller
 */

import { ProfileService } from '../services/profile-service.js';
import { toastSuccess } from '../components/toast.js';

export async function initProfilePage() {
  const profileForm = document.getElementById('profileEditForm');
  const avatarUploadInput = document.getElementById('avatarUploadInput');
  const avatarPreview = document.getElementById('avatarPreview');

  // Load current profile data
  const user = await ProfileService.getProfile();
  if (profileForm && user) {
    if (user.name) profileForm.querySelector('#displayName').value = user.name;
    if (user.username) profileForm.querySelector('#username').value = user.username;
    if (user.bio) profileForm.querySelector('#bio').value = user.bio;
    if (user.skills) profileForm.querySelector('#skills').value = (user.skills || []).map(s => typeof s === 'string' ? s : s.name).join(', ');
    if (user.website) profileForm.querySelector('#website').value = user.website;
    if (user.avatar && avatarPreview) avatarPreview.src = user.avatar;

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
  }

  // Avatar upload preview simulation
  let updatedAvatarData = null;
  if (avatarUploadInput && avatarPreview) {
    avatarUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          avatarPreview.src = re.target.result;
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
    });
  }
}
