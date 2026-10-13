/**
 * DevSync Toast Component
 */

import { showToast } from '../core/notifications.js';

export function toastSuccess(message, title = 'Success') {
  showToast({ title, message, type: 'success' });
}

export function toastDanger(message, title = 'Error') {
  showToast({ title, message, type: 'danger' });
}

export function toastInfo(message, title = 'Notice') {
  showToast({ title, message, type: 'info' });
}
