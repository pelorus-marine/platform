/**
 * Live Capture Toolbar Component
 *
 * Toolbar for Live Capture tab with interface selection, capture controls,
 * and status indicator. Subscribes to store for high-frequency updates,
 * events for interface list.
 */

import { events, type LiveInterfacesLoadedEvent } from '../../events';
import { liveStore, appStore, type LiveState } from '../../store';
import { createEvent, extractFilename } from '../../utils';

export class LiveToolbarElement extends HTMLElement {
  private unsubscribeStore: (() => void) | null = null;

  // Bound handlers for cleanup
  private handleInterfacesLoaded = (e: LiveInterfacesLoadedEvent) => this.onInterfacesLoaded(e);

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    events.on('live:interfaces-loaded', this.handleInterfacesLoaded);
    this.unsubscribeStore = liveStore.subscribe((state) => this.onStoreChange(state));
  }

  disconnectedCallback(): void {
    events.off('live:interfaces-loaded', this.handleInterfacesLoaded);
    this.unsubscribeStore?.();
  }

  private onInterfacesLoaded(e: LiveInterfacesLoadedEvent): void {
    const select = this.querySelector('#interfaceSelect') as HTMLSelectElement;
    if (select) {
      select.innerHTML = '<option value="">Select CAN interface...</option>' +
        e.interfaces.map(iface => `<option value="${iface}">${iface}</option>`).join('');
    }
    this.updateButtonStates(liveStore.get());
  }

  private onStoreChange(state: LiveState): void {
    this.updateStatusUI(state);
    this.updateButtonStates(state);
  }

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'liveTab';
    this.innerHTML = `
      <label>Interface:</label>
      <select class="cv-select" id="interfaceSelect">
        <option value="">Select CAN interface...</option>
      </select>
      <button class="cv-btn" id="refreshBtn">↻</button>
      <span class="cv-toolbar-sep"></span>
      <button class="cv-btn success" id="startBtn" disabled>Start</button>
      <button class="cv-btn danger" id="stopBtn" disabled>Stop</button>
      <button class="cv-btn" id="clearBtn">Clear</button>
      <span class="cv-status"><span class="cv-status-dot" id="statusDot"></span><span id="statusText">Idle</span></span>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#refreshBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('refresh-interfaces', {}));
    });

    this.querySelector('#startBtn')?.addEventListener('click', () => {
      const select = this.querySelector('#interfaceSelect') as HTMLSelectElement;
      if (select?.value) {
        this.dispatchEvent(createEvent('start-capture', { interface: select.value }));
      }
    });

    this.querySelector('#stopBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('stop-capture', {}));
    });

    this.querySelector('#clearBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('clear', {}));
    });

    this.querySelector('#interfaceSelect')?.addEventListener('change', () => {
      this.updateButtonStates(liveStore.get());
    });
  }

  private updateStatusUI(state: LiveState): void {
    const dot = this.querySelector('#statusDot');
    const text = this.querySelector('#statusText');
    const mdf4File = appStore.get().mdf4File;

    dot?.classList.toggle('active', state.isCapturing);
    if (text) {
      if (mdf4File) {
        text.textContent = extractFilename(mdf4File);
      } else {
        text.textContent = state.isCapturing ? 'Capturing...' : 'Idle';
      }
    }
  }

  private updateButtonStates(state: LiveState): void {
    const select = this.querySelector('#interfaceSelect') as HTMLSelectElement;
    const startBtn = this.querySelector('#startBtn') as HTMLButtonElement;
    const stopBtn = this.querySelector('#stopBtn') as HTMLButtonElement;

    if (startBtn && select) {
      startBtn.disabled = !select.value || state.isCapturing;
    }
    if (stopBtn) {
      stopBtn.disabled = !state.isCapturing;
    }
  }
}

customElements.define('cv-live-toolbar', LiveToolbarElement);
