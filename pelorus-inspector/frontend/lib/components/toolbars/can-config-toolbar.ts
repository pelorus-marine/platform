/**
 * CAN Configuration Toolbar
 *
 * Toolbar for CAN tab with Create New, Refresh, and status indicator.
 */

import { events, EMPTY_PAYLOAD, type CanInterfacesLoadedEvent } from '../../events.js';

export class CanConfigToolbarElement extends HTMLElement {
  private upCount = 0;

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    events.on('can:interfaces-loaded', this.handleInterfacesLoaded);
  }

  disconnectedCallback(): void {
    events.off('can:interfaces-loaded', this.handleInterfacesLoaded);
  }

  private handleInterfacesLoaded = (e: CanInterfacesLoadedEvent): void => {
    this.upCount = e.count;
    this.updateStatus();
  };

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'canTab';
    this.innerHTML = `
      <button class="cv-btn" id="createNewBtn">Create</button>
      <button class="cv-btn" id="refreshBtn">Refresh</button>
      <span class="cv-status">
        <span class="cv-status-dot ${this.upCount > 0 ? 'active' : ''}" id="statusDot"></span>
        <span id="statusText">${this.upCount > 0 ? `${this.upCount} interface${this.upCount > 1 ? 's' : ''} up` : 'No interfaces up'}</span>
      </span>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#createNewBtn')?.addEventListener('click', () => {
      events.emit('can:create-new', EMPTY_PAYLOAD);
    });

    this.querySelector('#refreshBtn')?.addEventListener('click', () => {
      events.emit('can:refresh', EMPTY_PAYLOAD);
    });
  }

  private updateStatus(): void {
    const dot = this.querySelector('#statusDot');
    const text = this.querySelector('#statusText');

    dot?.classList.toggle('active', this.upCount > 0);
    if (text) {
      text.textContent = this.upCount > 0
        ? `${this.upCount} interface${this.upCount > 1 ? 's' : ''} up`
        : 'No interfaces up';
    }
  }
}

customElements.define('cv-can-config-toolbar', CanConfigToolbarElement);
