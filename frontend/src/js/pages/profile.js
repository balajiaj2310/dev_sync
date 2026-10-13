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
    profileForm.querySelector('#displayName').value = user.name || '';
    profileForm.querySelector('#username').value = user.username || '';
    profileForm.querySelector('#bio').value = user.bio || '';
    profileForm.querySelector('#skills').value = (user.skills || []).join(', ');
    profileForm.querySelector('#website').value = user.website || '';
  }

  // Avatar upload preview simulation
  if (avatarUploadInput && avatarPreview) {
    avatarUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          avatarPreview.src = re.target.result;
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
        skills: profileForm.querySelector('#skills').value.split(',').map(s => s.trim()).filter(Boolean)
      };

      await ProfileService.updateProfile(updates);
      toastSuccess('Profile updated successfully!', 'Changes Saved');
    });
  }
}
