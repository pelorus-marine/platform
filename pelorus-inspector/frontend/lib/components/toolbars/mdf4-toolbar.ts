/**
 * MDF4 Toolbar Component
 *
 * Toolbar for MDF4 Inspector tab with Open, Clear, and status indicator.
 * Subscribes to appStore for current MDF4 file.
 * Shows yellow dot during capture, green when file is ready.
 */

import { appStore } from '../../store';
import { events, type CaptureStartedEvent, type CaptureStoppedEvent } from '../../events';
import { createEvent, extractFilename } from '../../utils';

export class Mdf4ToolbarElement extends HTMLElement {
  private unsubscribeStore: (() => void) | null = null;
  private isCapturing = false;

  // Bound event handlers
  private handleCaptureStarted = (_e: CaptureStartedEvent) => this.onCaptureStarted();
  private handleCaptureStopped = (_e: CaptureStoppedEvent) => this.onCaptureStopped();

  constructor() {
    super();
  }

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    this.unsubscribeStore = appStore.subscribe(() => this.updateStatusUI());
    events.on('capture:started', this.handleCaptureStarted);
    events.on('capture:stopped', this.handleCaptureStopped);
  }

  disconnectedCallback(): void {
    this.unsubscribeStore?.();
    events.off('capture:started', this.handleCaptureStarted);
    events.off('capture:stopped', this.handleCaptureStopped);
  }

  private onCaptureStarted(): void {
    this.isCapturing = true;
    this.updateStatusUI();
  }

  private onCaptureStopped(): void {
    this.isCapturing = false;
    this.updateStatusUI();
  }

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'mdf4Tab';
    this.innerHTML = `
      <button class="cv-btn primary" id="openBtn">Open</button>
      <button class="cv-btn" id="clearBtn">Clear</button>
      <span class="cv-status"><span class="cv-status-dot" id="statusDot"></span><span id="statusText">No file loaded</span></span>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#openBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('open', {}));
    });

    this.querySelector('#clearBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('clear', {}));
    });
  }

  private updateStatusUI(): void {
    const dot = this.querySelector('#statusDot');
    const text = this.querySelector('#statusText');
    const mdf4File = appStore.get().mdf4File;

    // Yellow during capture, green when file loaded, gray when no file
    dot?.classList.remove('active', 'capturing');
    if (this.isCapturing) {
      dot?.classList.add('capturing');
    } else if (mdf4File) {
      dot?.classList.add('active');
    }

    if (text) {
      if (this.isCapturing && mdf4File) {
        text.textContent = `Capturing to ${extractFilename(mdf4File)}...`;
      } else if (mdf4File) {
        text.textContent = extractFilename(mdf4File);
      } else {
        text.textContent = 'No file loaded';
      }
    }
  }
}

customElements.define('cv-mdf4-toolbar', Mdf4ToolbarElement);
