/**
 * Live Viewer Component
 *
 * Displays real-time CAN data received from Rust backend.
 * All processing (MDF4 storage, decoding, aggregation) happens in Rust.
 * This component only receives and renders periodic updates.
 */

import type { DbcInfo, FileFilter, LiveCaptureUpdate, CanBpfFilter } from '../../types';
import { extractFilename } from '../../utils';
import { events, emitCaptureStarted, emitCaptureStopped, emitLiveInterfacesLoaded, type DbcChangedEvent } from '../../events';
import { liveStore, appStore } from '../../store';
import styles from '../../../styles/pelorus-inspector.css?inline';


/** API interface for Live Viewer */
export interface LiveViewerApi {
  listCanInterfaces(): Promise<string[]>;
  startCapture(iface: string, captureFile: string, append: boolean, filters?: CanBpfFilter[]): Promise<void>;
  stopCapture(): Promise<string>; // Returns finalized MDF4 path
  saveFileDialog(filters: FileFilter[], defaultName?: string): Promise<string | null>;
  getDbcInfo(): Promise<DbcInfo | null>;
  onLiveCaptureUpdate(callback: (update: LiveCaptureUpdate) => void): () => void;
  onCaptureFinalized(callback: (path: string) => void): () => void;
  onCaptureError(callback: (error: string) => void): () => void;
  /** Optional callback to get BPF filters for an interface (for Pro) */
  getFiltersForInterface?(iface: string): CanBpfFilter[] | undefined;
}

/** State for Live Viewer */
interface LiveState {
  isCapturing: boolean;
  currentInterface: string | null;
  captureFile: string | null;
}

/** Live Viewer Web Component */
export class LiveViewerElement extends HTMLElement {
  private api: LiveViewerApi | null = null;
  private state: LiveState;
  private shadow: ShadowRoot;

  // Latest update from Rust
  private latestUpdate: LiveCaptureUpdate | null = null;

  // Event unsubscribers
  private unlisteners: (() => void)[] = [];
  private unsubscribeAppStore: (() => void) | null = null;

  // Bound event handler for cleanup
  private handleDbcChanged = (event: DbcChangedEvent) => this.onDbcChanged(event);

  constructor() {
    super();
    this.state = {
      isCapturing: false,
      currentInterface: null,
      captureFile: null,
    };
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    events.on('dbc:changed', this.handleDbcChanged);
    this.unsubscribeAppStore = appStore.subscribe((state) => this.onAppStoreChange(state.mdf4File));
  }

  disconnectedCallback(): void {
    this.cleanup();
    events.off('dbc:changed', this.handleDbcChanged);
    this.unsubscribeAppStore?.();
  }

  setApi(api: LiveViewerApi): void {
    this.api = api;
    this.setupEventListeners();
    this.loadInterfaces();
  }

  /** Handle DBC changed event from event bus */
  private onDbcChanged(_event: DbcChangedEvent): void {
    // DBC change handled in Rust now - just re-render to reflect any name changes
    if (this.latestUpdate) {
      this.renderFromUpdate(this.latestUpdate);
    }
  }

  /** Handle appStore mdf4File changes */
  private onAppStoreChange(mdf4File: string | null): void {
    // Sync local state with global MDF4 file (e.g., when MDF4 Inspector loads a file)
    if (mdf4File !== this.state.captureFile) {
      this.state.captureFile = mdf4File;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Handling
  // ─────────────────────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    if (!this.api) return;

    this.unlisteners.push(
      this.api.onLiveCaptureUpdate(update => this.handleUpdate(update)),
      this.api.onCaptureFinalized(path => this.handleFinalized(path)),
      this.api.onCaptureError(error => {
        console.error('[live-viewer] CAPTURE ERROR:', error);
        this.showMessage(error, 'error');
        this.state.isCapturing = false;
        this.updateStoreStatus();
      })
    );
  }

  private cleanup(): void {
    this.unlisteners.forEach(fn => fn());
    this.unlisteners = [];
  }

  private handleUpdate(update: LiveCaptureUpdate): void {
    // Only update store if this instance started the capture
    // (prevents other instances from overwriting isCapturing with false)
    if (!this.state.isCapturing) {
      return;
    }
    this.latestUpdate = update;
    this.renderFromUpdate(update);
    this.updateStoreStatus();
  }

  private handleFinalized(path: string): void {
    this.state.captureFile = path;
    this.showMessage(`MDF4 saved to ${extractFilename(path)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────────

  private render(): void {
    this.shadow.innerHTML = `
      <style>${styles}</style>
      ${this.generateTemplate()}
    `;
    this.bindEvents();
  }

  private generateTemplate(): string {
    return `
      <div class="cv-live-viewer">
        <div class="cv-panel">
          <div class="cv-panel-header">
            <div class="cv-tabs">
              <button class="cv-tab active" data-tab="monitor">Message Monitor <span class="cv-tab-badge" id="messageCount">0</span></button>
              <button class="cv-tab" data-tab="signals">Signal Monitor <span class="cv-tab-badge" id="signalCount">0</span></button>
              <button class="cv-tab" data-tab="stream">Frame Stream <span class="cv-tab-badge" id="frameCount">0</span></button>
              <button class="cv-tab" data-tab="errors">Error Monitor <span class="cv-tab-badge cv-tab-badge-error dimmed" id="errorCount" data-count="0">0</span></button>
            </div>
          </div>
          <div class="cv-panel-body flush">
            ${this.generateMonitorSection()}
            ${this.generateSignalsSection()}
            ${this.generateStreamSection()}
            ${this.generateErrorsSection()}
          </div>
        </div>

        <div class="cv-stats-bar">
          <div class="cv-stat">
            <span class="cv-stat-label">Messages</span>
            <span class="cv-stat-value" id="statMsgCount">0</span>
          </div>
          <div class="cv-stat">
            <span class="cv-stat-label">Frames</span>
            <span class="cv-stat-value" id="statTotalFrames">0</span>
          </div>
          <div class="cv-stat">
            <span class="cv-stat-label">Rate</span>
            <span class="cv-stat-value" id="statFrameRate">0/s</span>
          </div>
          <div class="cv-stat">
            <span class="cv-stat-label">Elapsed</span>
            <span class="cv-stat-value" id="statElapsed">0:00</span>
          </div>
        </div>
      </div>
    `;
  }

  private generateMonitorSection(): string {
    return `
      <div class="cv-tab-pane active" id="monitorSection">
        <div class="cv-table-wrap">
          <table class="cv-table">
            <thead>
              <tr>
                <th>CAN ID</th>
                <th>Message</th>
                <th>Data</th>
                <th>Count</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody id="monitorTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  private generateSignalsSection(): string {
    return `
      <div class="cv-tab-pane" id="signalsSection">
        <div class="cv-signal-monitor" id="signalsContainer"></div>
      </div>
    `;
  }

  private generateStreamSection(): string {
    return `
      <div class="cv-tab-pane" id="streamSection">
        <div class="cv-table-wrap">
          <table class="cv-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>CAN ID</th>
                <th>DLC</th>
                <th>Data</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody id="streamTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  private generateErrorsSection(): string {
    return `
      <div class="cv-tab-pane" id="errorsSection">
        <div class="cv-table-wrap">
          <table class="cv-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Channel</th>
                <th>Error Type</th>
                <th>Details</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody id="errorsTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Tab switching
    this.shadow.querySelectorAll('.cv-tabs .cv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        if (!tabName) return;
        this.switchTab(tabName);
      });
    });
  }

  private switchTab(tabName: string): void {
    this.shadow.querySelectorAll('.cv-tabs .cv-tab').forEach(t =>
      t.classList.toggle('active', (t as HTMLElement).dataset.tab === tabName)
    );
    this.shadow.querySelectorAll('.cv-panel-body > .cv-tab-pane').forEach(p =>
      p.classList.toggle('active', p.id === `${tabName}Section`)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Capture Control
  // ─────────────────────────────────────────────────────────────────────────────

  async loadInterfaces(): Promise<void> {
    if (!this.api) return;
    try {
      const interfaces = await this.api.listCanInterfaces();
      emitLiveInterfacesLoaded({ interfaces });
    } catch (err) {
      console.warn('Could not load interfaces:', err);
    }
  }

  async startCapture(iface: string): Promise<void> {
    if (!this.api) return;
    try {
      const existingFile = appStore.get().mdf4File;
      let captureFile: string | null = null;
      let appendMode = false;

      // If an MDF4 file is already selected, ask what to do
      if (existingFile) {
        const choice = await this.showCaptureChoiceDialog(existingFile);
        if (choice === 'cancel') {
          return;
        } else if (choice === 'append') {
          captureFile = existingFile;
          appendMode = true;
        } else if (choice === 'overwrite') {
          captureFile = existingFile;
          appendMode = false;
        }
        // choice === 'new' falls through to prompt for new file
      }

      // If no file chosen yet (new capture or user chose "new"), prompt for file location
      if (!captureFile) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const defaultName = `can-capture-${timestamp}.mf4`;

        captureFile = await this.api.saveFileDialog(
          [{ name: 'MDF4 Files', extensions: ['mf4'] }],
          defaultName
        );

        if (!captureFile) {
          return; // User cancelled
        }
      }

      // Clear previous data (unless appending)
      if (!appendMode) {
        this.latestUpdate = null;
        this.renderFromUpdate(null);
      }

      this.state.isCapturing = true;
      this.state.currentInterface = iface;
      this.state.captureFile = captureFile;
      this.updateStoreStatus();

      // Get filters from Pro if available
      const filters = this.api.getFiltersForInterface?.(iface);
      await this.api.startCapture(iface, captureFile, appendMode, filters);
      const mode = appendMode ? 'Appending to' : 'Capturing to';
      const filterInfo = filters?.length ? ` (${filters.length} filter${filters.length > 1 ? 's' : ''})` : '';
      this.showMessage(`${mode} ${extractFilename(captureFile)}${filterInfo}`);
      emitCaptureStarted({ interface: iface, captureFile });
    } catch (err) {
      console.error('[live-viewer] startCapture FAILED:', err);
      this.state.isCapturing = false;
      this.updateStoreStatus();
      this.showMessage(String(err), 'error');
    }
  }

  /** Show dialog to choose between append, overwrite, or new file */
  private showCaptureChoiceDialog(existingFile: string): Promise<'append' | 'overwrite' | 'new' | 'cancel'> {
    return new Promise((resolve) => {
      const filename = extractFilename(existingFile);
      const dialog = document.createElement('div');
      dialog.className = 'cv-modal-overlay';
      dialog.innerHTML = `
        <div class="cv-modal">
          <div class="cv-modal-header">MDF4 File Already Selected</div>
          <div class="cv-modal-body">
            <p>An MDF4 file is currently selected:</p>
            <p class="cv-modal-filename">${filename}</p>
            <p>What would you like to do?</p>
          </div>
          <div class="cv-modal-actions">
            <button class="cv-btn success" data-action="append">Append</button>
            <button class="cv-btn warning" data-action="overwrite">Overwrite</button>
            <button class="cv-btn primary" data-action="new">New File</button>
            <button class="cv-btn" data-action="cancel">Cancel</button>
          </div>
        </div>
      `;

      const handleClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action as 'append' | 'overwrite' | 'new' | 'cancel';
        if (action) {
          dialog.remove();
          resolve(action);
        }
      };

      dialog.addEventListener('click', handleClick);
      this.shadow.appendChild(dialog);
    });
  }

  async stopCapture(): Promise<void> {
    if (!this.api) return;
    try {
      const filePath = await this.api.stopCapture();

      const frameCount = this.latestUpdate?.stats.frame_count ?? 0;
      const iface = this.state.currentInterface;

      this.state.isCapturing = false;
      this.state.captureFile = filePath;
      this.updateStoreStatus();
      this.showMessage(`Capture saved to ${extractFilename(filePath)}`);
      emitCaptureStopped({ interface: iface, captureFile: filePath, frameCount });
    } catch (err) {
      this.state.isCapturing = false;
      this.updateStoreStatus();
      this.showMessage(String(err), 'error');
    }
  }

  clearAllData(): void {
    this.latestUpdate = null;
    this.renderFromUpdate(null);
    this.updateStoreStatus();
  }

  /** Update store with current status */
  private updateStoreStatus(): void {
    const update = {
      isCapturing: this.state.isCapturing,
      currentInterface: this.state.currentInterface,
      frameCount: this.latestUpdate?.stats.frame_count ?? 0,
      messageCount: this.latestUpdate?.stats.message_count ?? 0,
    };
    liveStore.set(update);
    // Only update global MDF4 file when not capturing (file doesn't exist during capture)
    if (!this.state.isCapturing) {
      appStore.set({ mdf4File: this.state.captureFile });
    }
  }

  /** Get current capture state */
  getIsCapturing(): boolean {
    return this.state.isCapturing;
  }

  /** Get current frame count */
  getFrameCount(): number {
    return this.latestUpdate?.stats.frame_count ?? 0;
  }

  /** Get capture file path */
  getCaptureFile(): string | null {
    return this.state.captureFile;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Rendering from Update (all HTML pre-rendered in Rust)
  // ─────────────────────────────────────────────────────────────────────────────

  private renderFromUpdate(update: LiveCaptureUpdate | null): void {
    // Messages table - just set pre-rendered HTML
    const monitorTbody = this.shadow.querySelector('#monitorTableBody');
    if (monitorTbody) monitorTbody.innerHTML = update?.messages_html ?? '';

    // Signals container (responsive grid, not a table)
    const signalsContainer = this.shadow.querySelector('#signalsContainer');
    if (signalsContainer) signalsContainer.innerHTML = update?.signals_html ?? '';

    // Frames table
    const streamTbody = this.shadow.querySelector('#streamTableBody');
    if (streamTbody) streamTbody.innerHTML = update?.frames_html ?? '';

    // Errors table
    const errorsTbody = this.shadow.querySelector('#errorsTableBody');
    if (errorsTbody) errorsTbody.innerHTML = update?.errors_html ?? '';

    // Badge counts
    const messageCount = this.shadow.querySelector('#messageCount');
    if (messageCount) messageCount.textContent = String(update?.message_count ?? 0);

    const signalCount = this.shadow.querySelector('#signalCount');
    if (signalCount) signalCount.textContent = String(update?.signal_count ?? 0);

    const frameCount = this.shadow.querySelector('#frameCount');
    if (frameCount) frameCount.textContent = String(update?.frame_count ?? 0);

    const errorCount = this.shadow.querySelector('#errorCount');
    if (errorCount) {
      const count = update?.error_count ?? 0;
      errorCount.textContent = String(count);
      errorCount.setAttribute('data-count', String(count));
      errorCount.classList.toggle('dimmed', count === 0);
    }

    // Stats - pre-formatted strings
    const msgCount = this.shadow.querySelector('#statMsgCount');
    const totalFrames = this.shadow.querySelector('#statTotalFrames');
    const frameRate = this.shadow.querySelector('#statFrameRate');
    const elapsed = this.shadow.querySelector('#statElapsed');

    if (update?.stats_html) {
      if (msgCount) msgCount.textContent = update.stats_html.message_count;
      if (totalFrames) totalFrames.textContent = update.stats_html.frame_count;
      if (frameRate) frameRate.textContent = update.stats_html.frame_rate;
      if (elapsed) elapsed.textContent = update.stats_html.elapsed;
    } else {
      if (msgCount) msgCount.textContent = '0';
      if (totalFrames) totalFrames.textContent = '0';
      if (frameRate) frameRate.textContent = '0/s';
      if (elapsed) elapsed.textContent = '0:00';
    }
  }

  private showMessage(text: string, type: 'success' | 'error' = 'success'): void {
    const msg = document.createElement('div');
    msg.className = `cv-message ${type}`;
    msg.textContent = text;
    this.shadow.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }
}

customElements.define('cv-live-viewer', LiveViewerElement);
