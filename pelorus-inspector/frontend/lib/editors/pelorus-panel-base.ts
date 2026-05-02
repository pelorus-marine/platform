/**
 * Base class for Pelorus Inspector shadow-DOM panels (loading + error UX).
 */

import type { PanelLoadStatus } from '../store';
import { escapeHtml } from '../utils/html';

export interface PelorusPanelState {
  status: PanelLoadStatus;
  error: string | null;
}

export abstract class PelorusPanelBase extends HTMLElement {
  protected shadow: ShadowRoot;
  protected state: PelorusPanelState = {
    status: 'idle',
    error: null,
  };

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.safeRender();
  }

  protected abstract getStyles(): string;
  protected abstract renderContent(): string;

  protected safeRender(): void {
    try {
      if (this.state.status === 'error' && this.state.error) {
        this.renderError(this.state.error);
        return;
      }

      if (this.state.status === 'loading') {
        this.renderLoading();
        return;
      }

      this.shadow.innerHTML = `
        <style>${this.getStyles()}</style>
        ${this.renderContent()}
      `;
      this.afterRender();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[${this.tagName}] Render error:`, e);
      this.renderError(message);
    }
  }

  protected afterRender(): void {}

  protected renderLoading(message = 'Loading...'): void {
    this.shadow.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="pro-loading">
        <div class="pro-loading-spinner"></div>
        <span class="pro-loading-text">${message}</span>
      </div>
    `;
  }

  protected renderError(message: string): void {
    this.shadow.innerHTML = `
      <style>
        ${this.getStyles()}
        .pro-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          gap: 12px;
          color: var(--cv-danger, #dc3545);
          text-align: center;
        }
        .pro-error-icon { font-size: 32px; }
        .pro-error-message { font-size: 14px; opacity: 0.9; }
        .pro-error-retry {
          margin-top: 8px;
          padding: 6px 12px;
          border: 1px solid var(--cv-border, #444);
          border-radius: 4px;
          background: transparent;
          color: var(--cv-text, #e0e0e0);
          cursor: pointer;
        }
        .pro-error-retry:hover { background: var(--cv-bg-hover, #333); }
      </style>
      <div class="pro-error">
        <div class="pro-error-icon">⚠</div>
        <div class="pro-error-message">${escapeHtml(message)}</div>
        <button class="pro-error-retry" id="retry-btn">Retry</button>
      </div>
    `;

    this.shadow.querySelector('#retry-btn')?.addEventListener('click', () => {
      this.handleRetry();
    });
  }

  protected handleRetry(): void {
    this.setStatus('idle');
    this.safeRender();
  }

  protected setStatus(status: PanelLoadStatus): void {
    this.state.status = status;
    if (status !== 'error') {
      this.state.error = null;
    }
  }

  protected setError(message: string): void {
    this.state.status = 'error';
    this.state.error = message;
    import('./form-helpers.js')
      .then(({ showToast }) => {
        showToast(this.shadow, message, 'error', false);
      })
      .catch(() => {});
    this.safeRender();
  }

  protected clearError(): void {
    this.state.error = null;
    if (this.state.status === 'error') {
      this.state.status = 'idle';
    }
  }

  protected async withLoading<T>(operation: () => Promise<T>): Promise<T | null> {
    this.setStatus('loading');
    this.safeRender();

    try {
      const result = await operation();
      this.setStatus('ready');
      this.safeRender();
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[${this.tagName}] Operation failed:`, e);
      this.setError(message);
      return null;
    }
  }

  protected async safeExecute<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: Error) => void,
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error(`[${this.tagName}] Execution error:`, error);
      errorHandler?.(error);
      return null;
    }
  }

  protected $<T extends HTMLElement>(selector: string): T | null {
    return this.shadow.querySelector<T>(selector);
  }

  protected $$<T extends HTMLElement>(selector: string): NodeListOf<T> {
    return this.shadow.querySelectorAll<T>(selector);
  }
}
