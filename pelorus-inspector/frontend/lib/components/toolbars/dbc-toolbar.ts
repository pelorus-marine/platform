/**
 * DBC Toolbar Component
 *
 * Toolbar for DBC Editor tab with file operations, edit mode toggle,
 * and status indicator. Subscribes to dbc:state-change events.
 */

import { events, type DbcStateChangeEvent } from '../../events';
import { appStore } from '../../store';
import { createEvent, extractFilename } from '../../utils';

export class DbcToolbarElement extends HTMLElement {
  private isDirty = false;
  private isEditing = false;
  private messageCount = 0;
  private unsubscribeStore: (() => void) | null = null;

  // Bound handler for cleanup
  private handleStateChange = (e: DbcStateChangeEvent) => this.onStateChange(e);

  constructor() {
    super();
  }

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    events.on('dbc:state-change', this.handleStateChange);
    this.unsubscribeStore = appStore.subscribe(() => this.updateStatusUI());
  }

  disconnectedCallback(): void {
    events.off('dbc:state-change', this.handleStateChange);
    this.unsubscribeStore?.();
  }

  private onStateChange(e: DbcStateChangeEvent): void {
    this.isDirty = e.isDirty;
    this.isEditing = e.isEditing;
    this.messageCount = e.messageCount;
    this.updateUI();
  }

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'dbcTab';
    this.innerHTML = `
      <button class="cv-btn" id="newBtn">New</button>
      <button class="cv-btn" id="openBtn">Open</button>
      <button class="cv-btn primary" id="editBtn">Edit</button>
      <button class="cv-btn" id="cancelBtn" style="display:none">Cancel</button>
      <button class="cv-btn" id="saveBtn" disabled>Save</button>
      <button class="cv-btn" id="saveAsBtn" disabled>Save As</button>
      <span class="cv-status"><span class="cv-status-dot" id="statusDot"></span><span id="statusText">No file loaded</span></span>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#newBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('new', {}));
    });

    this.querySelector('#openBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('open', {}));
    });

    this.querySelector('#editBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('edit', {}));
    });

    this.querySelector('#cancelBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('cancel', {}));
    });

    this.querySelector('#saveBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('save', {}));
    });

    this.querySelector('#saveAsBtn')?.addEventListener('click', () => {
      this.dispatchEvent(createEvent('save-as', {}));
    });
  }

  private updateUI(): void {
    const editBtn = this.querySelector('#editBtn') as HTMLButtonElement;
    const cancelBtn = this.querySelector('#cancelBtn') as HTMLButtonElement;
    const saveBtn = this.querySelector('#saveBtn') as HTMLButtonElement;
    const saveAsBtn = this.querySelector('#saveAsBtn') as HTMLButtonElement;

    // Edit/Cancel toggle
    if (editBtn) editBtn.style.display = this.isEditing ? 'none' : '';
    if (cancelBtn) cancelBtn.style.display = this.isEditing ? '' : 'none';

    // Save buttons
    if (saveBtn) {
      saveBtn.disabled = !this.isDirty;
      saveBtn.classList.toggle('success', this.isDirty);
    }
    if (saveAsBtn) {
      saveAsBtn.disabled = this.messageCount === 0;
    }

    this.updateStatusUI();
  }

  private updateStatusUI(): void {
    const statusDot = this.querySelector('#statusDot');
    const statusText = this.querySelector('#statusText');
    const dbcFile = appStore.get().dbcFile;

    statusDot?.classList.toggle('active', !!dbcFile && !this.isDirty);
    statusDot?.classList.toggle('warning', this.isDirty);
    if (statusText) {
      const filename = dbcFile ? extractFilename(dbcFile) : 'No file loaded';
      statusText.textContent = this.isDirty ? `${filename} *` : filename;
    }
  }
}

customElements.define('cv-dbc-toolbar', DbcToolbarElement);
