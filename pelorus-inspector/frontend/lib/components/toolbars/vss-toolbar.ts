/**
 * VSS catalog toolbar — mirrors DBC toolbar pattern.
 */

import { events, type VssStateChangeEvent } from '../../events';
import { appStore } from '../../store';
import { createEvent, extractFilename } from '../../utils';

export class VssToolbarElement extends HTMLElement {
  private isDirty = false;
  private leafCount = 0;
  private branchCount = 0;
  private unsubscribeStore: (() => void) | null = null;
  private handleStateChange = (e: VssStateChangeEvent) => this.onStateChange(e);

  constructor() {
    super();
  }

  connectedCallback(): void {
    this.id = 'vssTab';
    this.className = 'cv-toolbar cv-tab-pane';
    this.render();
    this.bindEvents();
    events.on('vss:state-change', this.handleStateChange);
    this.unsubscribeStore = appStore.subscribe(() => this.updateStatusUI());
  }

  disconnectedCallback(): void {
    events.off('vss:state-change', this.handleStateChange);
    this.unsubscribeStore?.();
  }

  private onStateChange(e: VssStateChangeEvent): void {
    this.isDirty = e.isDirty;
    this.leafCount = e.leafCount;
    this.branchCount = e.branchCount;
    this.updateUI();
  }

  private render(): void {
    this.innerHTML = `
      <button class="cv-btn" id="vssNewBtn">New</button>
      <button class="cv-btn" id="vssOpenBtn">Open</button>
      <button class="cv-btn" id="vssClearBtn" title="Remove catalog from session (decode views lose vessel paths until you load again)">Clear</button>
      <button class="cv-btn" id="vssSaveBtn" disabled>Save</button>
      <button class="cv-btn" id="vssSaveAsBtn" disabled>Save As</button>
      <span class="cv-status"><span class="cv-status-dot" id="vssStatusDot"></span><span id="vssStatusText">No catalog loaded</span></span>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#vssNewBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('new', {}));
    });
    this.querySelector('#vssOpenBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('open', {}));
    });
    this.querySelector('#vssClearBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('clear', {}));
    });
    this.querySelector('#vssSaveBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('save', {}));
    });
    this.querySelector('#vssSaveAsBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('save-as', {}));
    });
  }

  private updateUI(): void {
    const saveBtn = this.querySelector('#vssSaveBtn') as HTMLButtonElement;
    const saveAsBtn = this.querySelector('#vssSaveAsBtn') as HTMLButtonElement;
    if (saveBtn) {
      const vssFile = appStore.get().vssFile;
      saveBtn.disabled = !vssFile || !this.isDirty;
      saveBtn.classList.toggle('success', !!vssFile && this.isDirty);
    }
    if (saveAsBtn) {
      saveAsBtn.disabled = this.leafCount === 0 && this.branchCount === 0;
    }
    this.updateStatusUI();
  }

  private updateStatusUI(): void {
    const statusDot = this.querySelector('#vssStatusDot');
    const statusText = this.querySelector('#vssStatusText');
    const vssFile = appStore.get().vssFile;
    statusDot?.classList.toggle('active', !!vssFile && !this.isDirty);
    statusDot?.classList.toggle('warning', this.isDirty);
    if (statusText) {
      const fn = vssFile ? extractFilename(vssFile) : 'No catalog loaded';
      statusText.textContent = this.isDirty ? `${fn} *` : fn;
    }
  }
}

customElements.define('cv-vss-toolbar', VssToolbarElement);
