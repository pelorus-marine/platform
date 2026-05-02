/**
 * Toast Notification Component
 *
 * Lightweight toast notifications for success, error, and info messages.
 * Auto-dismisses after a configurable duration.
 *
 * Usage:
 *   import { toast } from './toast.js';
 *   toast.success('Exported 5 artifacts');
 *   toast.error('Failed to save file');
 *   toast.info('Processing...');
 */

import { escapeHtml } from '../../utils/html';

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = `
  .cv-toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .cv-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--cv-bg-elevated, #2a2a2a);
    border: 1px solid var(--cv-border, #3a3a3a);
    color: var(--cv-text, #e0e0e0);
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    animation: cv-toast-in 0.2s ease-out;
    max-width: 400px;
  }

  .cv-toast.dismissing {
    animation: cv-toast-out 0.2s ease-in forwards;
  }

  @keyframes cv-toast-in {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes cv-toast-out {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }

  .cv-toast-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .cv-toast-content {
    flex: 1;
    line-height: 1.4;
  }

  .cv-toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--cv-text-muted, #888);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .cv-toast-close:hover {
    background: var(--cv-bg-alt, #333);
    color: var(--cv-text, #e0e0e0);
  }

  .cv-toast.success {
    border-left: 3px solid var(--cv-success, #22c55e);
  }

  .cv-toast.error {
    border-left: 3px solid var(--cv-danger, #ef4444);
  }

  .cv-toast.info {
    border-left: 3px solid var(--cv-accent, #3b82f6);
  }

  .cv-toast.success .cv-toast-icon { color: var(--cv-success, #22c55e); }
  .cv-toast.error .cv-toast-icon { color: var(--cv-danger, #ef4444); }
  .cv-toast.info .cv-toast-icon { color: var(--cv-accent, #3b82f6); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

const ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Toast Manager
// ─────────────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  duration?: number;
}

class ToastManager {
  private container: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  private ensureContainer(): HTMLElement {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    // Add styles if not present
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.textContent = styles;
      document.head.appendChild(this.styleElement);
    }

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'cv-toast-container';
    document.body.appendChild(this.container);

    return this.container;
  }

  show(message: string, type: ToastType, options: ToastOptions = {}): void {
    const container = this.ensureContainer();
    const duration = options.duration ?? 4000;

    const toastEl = document.createElement('div');
    toastEl.className = `cv-toast ${type}`;
    toastEl.innerHTML = `
      <span class="cv-toast-icon">${ICONS[type]}</span>
      <span class="cv-toast-content">${escapeHtml(message)}</span>
      <button class="cv-toast-close" title="Dismiss">${ICONS.close}</button>
    `;

    const dismiss = () => {
      toastEl.classList.add('dismissing');
      setTimeout(() => toastEl.remove(), 200);
    };

    toastEl.querySelector('.cv-toast-close')?.addEventListener('click', dismiss);

    container.appendChild(toastEl);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  success(message: string, options?: ToastOptions): void {
    this.show(message, 'success', options);
  }

  error(message: string, options?: ToastOptions): void {
    this.show(message, 'error', { duration: 6000, ...options });
  }

  info(message: string, options?: ToastOptions): void {
    this.show(message, 'info', options);
  }

}

// ─────────────────────────────────────────────────────────────────────────────
// Export singleton
// ─────────────────────────────────────────────────────────────────────────────

export const toast = new ToastManager();
