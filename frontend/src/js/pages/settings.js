/**
 * DevSync Settings Controller
 */

import { toastSuccess } from '../components/toast.js';

export function initSettingsPage() {
  const saveBtn = document.getElementById('btnSaveSettings');
  const passwordForm = document.getElementById('changePasswordForm');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      toastSuccess('Preferences saved successfully!');
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      toastSuccess('Password updated successfully!');
      passwordForm.reset();
    });
  }
}
