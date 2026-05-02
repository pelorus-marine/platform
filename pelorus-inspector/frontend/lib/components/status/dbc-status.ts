/**
 * DBC Status Component
 *
 * Displays current DBC file status in the header.
 * Subscribes to appStore and dbc:state-change events.
 */

import { appStore } from '../../store';
import { events, emitTabSwitch, type DbcStateChangeEvent } from '../../events';
import { extractFilename } from '../../utils';

export class DbcStatusElement extends HTMLElement {
  private unsubscribeStore: (() => void) | null = null;
  private isDirty = false;

  private handleStateChange = (e: DbcStateChangeEvent) => this.onStateChange(e);

  connectedCallback(): void {
    this.render();
    this.unsubscribeStore = appStore.subscribe(() => this.updateUI());
    events.on('dbc:state-change', this.handleStateChange);
  }

  disconnectedCallback(): void {
    this.unsubscribeStore?.();
    events.off('dbc:state-change', this.handleStateChange);
  }

  private onStateChange(e: DbcStateChangeEvent): void {
    this.isDirty = e.isDirty;
    this.updateUI();
  }

  private render(): void {
    this.className = 'cv-stat clickable';
    this.innerHTML = `
      <span class="cv-stat-label">DBC</span>
      <span class="cv-stat-value">No file loaded</span>
    `;
    this.addEventListener('click', () => {
      emitTabSwitch({ tab: 'dbc' });
    });
  }

  private updateUI(): void {
    const { dbcFile } = appStore.get();
    const value = this.querySelector('.cv-stat-value');

    // Green when loaded and not dirty
    this.classList.remove('success', 'warning');
    if (dbcFile && !this.isDirty) {
      this.classList.add('success');
    } else if (dbcFile && this.isDirty) {
      this.classList.add('warning');
    }

    if (value) {
      if (dbcFile) {
        const filename = extractFilename(dbcFile);
        value.textContent = this.isDirty ? `${filename} *` : filename;
        value.setAttribute('title', dbcFile);
      } else {
        value.textContent = 'No file loaded';
        value.removeAttribute('title');
      }
    }
  }
}

customElements.define('cv-dbc-status', DbcStatusElement);
