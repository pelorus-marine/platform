/**
 * MDF4 Status Component
 *
 * Displays current MDF4 file status in the header.
 * Subscribes to appStore and liveStore.
 */

import { appStore, liveStore } from '../../store';
import { emitTabSwitch } from '../../events';
import { extractFilename } from '../../utils';

export class Mdf4StatusElement extends HTMLElement {
  private unsubscribeAppStore: (() => void) | null = null;
  private unsubscribeLiveStore: (() => void) | null = null;

  connectedCallback(): void {
    this.render();
    this.unsubscribeAppStore = appStore.subscribe(() => this.updateUI());
    this.unsubscribeLiveStore = liveStore.subscribe(() => this.updateUI());
  }

  disconnectedCallback(): void {
    this.unsubscribeAppStore?.();
    this.unsubscribeLiveStore?.();
  }

  private render(): void {
    this.className = 'cv-stat clickable';
    this.innerHTML = `
      <span class="cv-stat-label">MDF4</span>
      <span class="cv-stat-value">No file loaded</span>
    `;
    this.addEventListener('click', () => {
      const { isCapturing } = liveStore.get();
      emitTabSwitch({ tab: isCapturing ? 'live' : 'mdf4' });
    });
  }

  private updateUI(): void {
    const { mdf4File } = appStore.get();
    const { isCapturing } = liveStore.get();
    const value = this.querySelector('.cv-stat-value');

    this.classList.remove('success', 'warning');

    if (isCapturing) {
      this.classList.add('warning');
      if (value) {
        value.textContent = 'Capturing...';
        value.removeAttribute('title');
      }
    } else if (mdf4File) {
      this.classList.add('success');
      if (value) {
        value.textContent = extractFilename(mdf4File);
        value.setAttribute('title', mdf4File);
      }
    } else {
      if (value) {
        value.textContent = 'No file loaded';
        value.removeAttribute('title');
      }
    }
  }
}

customElements.define('cv-mdf4-status', Mdf4StatusElement);
