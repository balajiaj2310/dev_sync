/**
 * DevSync Modal Manager
 * Accessible dialog open, close, backdrop handling, and keyboard escape
 */

export class ModalManager {
  static open(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    modalEl.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Focus first input or button
    const focusable = modalEl.querySelector('input, button:not(.modal-close-btn), textarea, select');
    if (focusable) focusable.focus();

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        ModalManager.close(modalId);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  static close(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    modalEl.classList.remove('show');
    document.body.style.overflow = '';
  }

  static init() {
    // Backdrop click dismiss
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('show');
        document.body.style.overflow = '';
      }
      if (e.target.closest('[data-modal-close]')) {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) {
          modal.classList.remove('show');
          document.body.style.overflow = '';
        }
      }
      const trigger = e.target.closest('[data-modal-target]');
      if (trigger) {
        const targetId = trigger.getAttribute('data-modal-target');
        ModalManager.open(targetId);
      }
    });
  }
}
