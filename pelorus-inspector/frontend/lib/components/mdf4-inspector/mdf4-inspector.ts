/**
 * MDF4 Inspector Component
 *
 * A self-contained component for viewing and analyzing CAN data from MDF4 files.
 * Provides static frame viewing, signal decoding, and filtering capabilities.
 */

import type { CanFrame, DbcInfo, DecodedSignal, FileFilter } from '../../types';
import type { Filters } from '../../config';
import { countActiveFilters, createEmptyFilters, filterFrames } from '../../config';
import { events, emitMdf4Changed, emitFrameSelected, type DbcChangedEvent, type CaptureStoppedEvent } from '../../events';
import { appStore } from '../../store';
import styles from '../../../styles/pelorus-inspector.css?inline';

// Import sub-components
import '../shared/frames-table';
import '../shared/signals-panel';
import '../shared/filters-panel';

import type { FramesTableElement } from '../shared/frames-table';
import type { SignalsPanelElement } from '../shared/signals-panel';
import type { FiltersPanelElement } from '../shared/filters-panel';

/** API interface for MDF4 Inspector */
export interface Mdf4InspectorApi {
  loadMdf4(path: string): Promise<[CanFrame[], DecodedSignal[]]>;
  decodeFrames(frames: CanFrame[]): Promise<{ signals: DecodedSignal[]; errors: string[] }>;
  openFileDialog(filters: FileFilter[]): Promise<string | null>;
  getDbcInfo(): Promise<DbcInfo | null>;
}

/** State for MDF4 Inspector */
interface Mdf4State {
  frames: CanFrame[];
  filteredFrames: CanFrame[];
  filters: Filters;
  selectedFrameIndex: number | null;
  dbcInfo: DbcInfo | null;
  currentFile: string | null;
}

function createInitialState(): Mdf4State {
  return {
    frames: [],
    filteredFrames: [],
    filters: createEmptyFilters(),
    selectedFrameIndex: null,
    dbcInfo: null,
    currentFile: null,
  };
}

/** MDF4 Inspector Web Component */
export class Mdf4InspectorElement extends HTMLElement {
  private api: Mdf4InspectorApi | null = null;
  private state: Mdf4State;
  private shadow: ShadowRoot;

  // Sub-component references
  private framesTable: FramesTableElement | null = null;
  private signalsPanel: SignalsPanelElement | null = null;
  private filtersPanel: FiltersPanelElement | null = null;

  // Bound event handlers for cleanup
  private handleDbcChanged = (event: DbcChangedEvent) => this.onDbcChanged(event);
  private handleCaptureStopped = (event: CaptureStoppedEvent) => this.onCaptureStopped(event);
  private unsubscribeAppStore: (() => void) | null = null;

  constructor() {
    super();
    this.state = createInitialState();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    events.on('dbc:changed', this.handleDbcChanged);
    events.on('capture:stopped', this.handleCaptureStopped);
    this.unsubscribeAppStore = appStore.subscribe((state) => this.onAppStoreChange(state.mdf4File));
  }

  disconnectedCallback(): void {
    events.off('dbc:changed', this.handleDbcChanged);
    events.off('capture:stopped', this.handleCaptureStopped);
    this.unsubscribeAppStore?.();
  }

  /** React to global MDF4 file changes */
  private onAppStoreChange(mdf4File: string | null): void {
    if (mdf4File && mdf4File !== this.state.currentFile) {
      this.loadFile(mdf4File);
    } else if (!mdf4File && this.state.currentFile) {
      this.clearAllData();
    }
  }

  /** React to capture stopped - reload if this is the file we have open */
  private onCaptureStopped(event: CaptureStoppedEvent): void {
    const captureFile = event.captureFile;
    // Only reload if this is the same file we already have open (content was updated)
    // New files are handled by appStore subscription
    if (captureFile && captureFile === this.state.currentFile) {
      this.loadFile(captureFile);
    }
  }

  setApi(api: Mdf4InspectorApi): void {
    this.api = api;
    this.refreshDbcInfo();
  }

  /** Get current frames for external use (e.g., DBC editor) */
  getFrames(): CanFrame[] {
    return this.state.frames;
  }

  /** Handle DBC changed event from event bus */
  private async onDbcChanged(event: DbcChangedEvent): Promise<void> {
    if (event.dbcInfo) {
      this.state.dbcInfo = event.dbcInfo;
    } else if (event.action !== 'cleared') {
      // DBC was loaded/updated but dbcInfo not in event - fetch from API
      await this.refreshDbcInfo();
    } else {
      this.state.dbcInfo = null;
    }

    // Re-decode MDF4 frames with new DBC if we have a file loaded
    if (this.state.currentFile && event.action !== 'cleared') {
      await this.reloadCurrentFile();
    } else {
      this.renderFrames();
    }
  }

  /** Reload current MDF4 file (used when DBC changes to re-decode signals) */
  private async reloadCurrentFile(): Promise<void> {
    if (!this.api || !this.state.currentFile) return;

    try {
      const [frames, decodedSignals] = await this.api.loadMdf4(this.state.currentFile);
      this.state.frames = frames;
      this.state.filteredFrames = [...frames];

      // Update global state with new decoded signals
      appStore.set({ mdf4Frames: frames, mdf4Signals: decodedSignals });

      this.renderFrames();
      this.signalsPanel?.clear();
    } catch (err) {
      console.error('Failed to reload MDF4:', err);
    }
  }

  /** Refresh DBC info from API (used on initial setup or when DBC changes) */
  async refreshDbcInfo(): Promise<void> {
    if (!this.api) return;
    try {
      this.state.dbcInfo = await this.api.getDbcInfo();
      this.renderFrames();
      // Note: signals-panel handles re-decode via its own dbc:changed listener
    } catch {
      // Ignore errors
    }
  }

  /** Load an MDF4 file */
  async loadFile(path: string): Promise<void> {
    if (!this.api) return;

    const btn = this.shadow.querySelector('#loadBtn') as HTMLButtonElement;
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

      const [frames, decodedSignals] = await this.api.loadMdf4(path);
      this.state.frames = frames;
      this.state.filteredFrames = [...frames];
      this.state.selectedFrameIndex = null;
      this.state.currentFile = path;

      // Update global state with frames and pre-decoded signals
      appStore.set({ mdf4File: path, mdf4Frames: frames, mdf4Signals: decodedSignals });

      this.renderFrames();
      this.signalsPanel?.clear();
      this.showMessage(`Loaded ${frames.length} frames`);

      // Notify other components that MDF4 data changed
      emitMdf4Changed({ action: 'loaded' });
    } catch (err) {
      this.showMessage(String(err), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Open'; }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────────

  private render(): void {
    this.shadow.innerHTML = `
      <style>${styles}</style>
      ${this.generateTemplate()}
    `;
    this.cacheElements();
    this.bindEvents();
  }

  private generateTemplate(): string {
    return `
      <div class="cv-mdf4-inspector">
        <div class="cv-panel">
          <div class="cv-panel-header">
            <div class="cv-tabs">
              <button class="cv-tab active" data-tab="data">CAN Frames <span class="cv-tab-badge" id="framesCount">0</span></button>
              <button class="cv-tab" data-tab="filters">Filters <span class="cv-tab-badge dimmed" id="filterCount">0</span></button>
            </div>
          </div>
          <div class="cv-panel-body flush">
            ${this.generateDataSection()}
            ${this.generateFiltersSection()}
          </div>
        </div>
      </div>
    `;
  }

  private generateDataSection(): string {
    return `
      <div class="cv-tab-pane active" id="dataSection">
        <div class="cv-grid responsive">
          <cv-frames-table class="cv-card" id="framesTable">
            <div class="cv-card-header">
              <span class="cv-card-title">Raw CAN Frames</span>
            </div>
            <div class="cv-filter-chips" id="filterChips"></div>
            <div class="cv-table-wrap">
              <table class="cv-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Channel</th>
                    <th>CAN ID</th>
                    <th>Message</th>
                    <th>DLC</th>
                    <th>Data</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody id="framesTableBody"></tbody>
              </table>
            </div>
          </cv-frames-table>
          <cv-signals-panel class="cv-card" id="signalsPanel">
            <div class="cv-card-header">
              <span class="cv-card-title">Decoded Signals <span class="cv-tab-badge" id="signalsCount">0</span></span>
              <span class="cv-decode-error hidden"></span>
            </div>
            <div class="cv-table-wrap">
              <table class="cv-table">
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody id="signalsTableBody"></tbody>
              </table>
            </div>
          </cv-signals-panel>
        </div>
      </div>
    `;
  }

  private generateFiltersSection(): string {
    return `
      <cv-filters-panel class="cv-tab-pane" id="filtersSection">
        <div class="cv-filters-grid">
          <div class="cv-filter-section">
            <div class="cv-filter-section-title">Frame Filters</div>
            <div class="cv-filter-row">
              <label>Time Range:</label>
              <input type="text" class="cv-input mono" id="filterTimeMin" placeholder="0.000">
              <span class="cv-filter-sep">to</span>
              <input type="text" class="cv-input mono" id="filterTimeMax" placeholder="999.999">
            </div>
            <div class="cv-filter-row">
              <label>CAN ID:</label>
              <input type="text" class="cv-input mono" id="filterCanId" placeholder="7DF, 7E8, 100-1FF">
            </div>
            <div class="cv-filter-row">
              <label>Channel:</label>
              <input type="text" class="cv-input mono" id="filterChannel" placeholder="can0, vcan0">
            </div>
            <div class="cv-filter-row">
              <label>Data Pattern:</label>
              <input type="text" class="cv-input mono" id="filterDataPattern" placeholder="01 ?? FF (use ?? for wildcard)">
            </div>
          </div>
          <div class="cv-filter-section">
            <div class="cv-filter-section-title">DBC Filters</div>
            <div class="cv-filter-row">
              <label>Message:</label>
              <input type="text" class="cv-input mono" id="filterMessage" placeholder="EngineData, VehicleSpeed">
            </div>
            <div class="cv-filter-row">
              <label>Signal:</label>
              <input type="text" class="cv-input mono" id="filterSignal" placeholder="RPM, Temperature">
            </div>
            <div class="cv-filter-row">
              <label>Match Status:</label>
              <select class="cv-select" id="filterMatchStatus">
                <option value="all">All Frames</option>
                <option value="matched">Matched Only</option>
                <option value="unmatched">Unmatched Only</option>
              </select>
            </div>
          </div>
          <div class="cv-filter-section cv-filter-actions">
            <button class="cv-btn" id="clearFiltersBtn">Clear All Filters</button>
            <div class="cv-filter-summary">
              <span id="filterSummary">No filters active</span>
            </div>
          </div>
        </div>
      </cv-filters-panel>
    `;
  }

  private cacheElements(): void {
    this.framesTable = this.shadow.querySelector('cv-frames-table');
    this.signalsPanel = this.shadow.querySelector('cv-signals-panel');
    this.filtersPanel = this.shadow.querySelector('cv-filters-panel');

    // Configure frames table with message info lookup (name + comment for tooltip)
    this.framesTable?.setMessageInfoLookup(canId => this.getMessageInfo(canId));

    // Pass API to signals panel for fallback decoding
    if (this.signalsPanel && this.api) {
      this.signalsPanel.setApi({
        decodeFrames: (frames) => this.api!.decodeFrames(frames),
      });
    }
  }

  private bindEvents(): void {
    // Load button
    this.shadow.querySelector('#loadBtn')?.addEventListener('click', () => this.promptLoadMdf4());

    // Clear button
    this.shadow.querySelector('#clearBtn')?.addEventListener('click', () => this.clearAllData());

    // Tab switching
    this.shadow.querySelectorAll('.cv-tabs .cv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        if (!tabName) return;
        this.switchTab(tabName);
      });
    });

    // Frame selection
    this.framesTable?.addEventListener('frame-selected', (e: Event) => {
      const detail = (e as CustomEvent<{ frame: CanFrame; index: number }>).detail;
      this.state.selectedFrameIndex = detail.index;
      // Look up pre-decoded signals for this frame
      // Match by timestamp AND message name (to handle multiple frames at same timestamp)
      const allSignals = appStore.get().mdf4Signals;
      const frameCanId = detail.frame.can_id;
      const dbcMessage = this.state.dbcInfo?.messages.find(m => m.id === frameCanId);
      const messageName = dbcMessage?.name;

      const frameSignals = allSignals.filter(s =>
        s.timestamp === detail.frame.timestamp &&
        (!messageName || s.message_name === messageName)
      );
      // Emit on event bus - signals-panel will handle display
      emitFrameSelected({ frame: detail.frame, index: detail.index, source: 'mdf4-inspector', signals: frameSignals });
    });

    // Filter changes
    this.filtersPanel?.addEventListener('filter-change', (e: Event) => {
      const filters = (e as CustomEvent<Filters>).detail;
      this.state.filters = filters;
      this.applyFilters();
      this.renderFrames();
      this.signalsPanel?.clear();
      this.updateFilterChips();
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
  // Frame Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /** Open file dialog and load selected MDF4 file */
  async promptLoadMdf4(): Promise<void> {
    if (!this.api) return;
    try {
      const path = await this.api.openFileDialog([
        { name: 'MDF4 Files', extensions: ['mf4', 'mdf', 'mdf4', 'MF4', 'MDF', 'MDF4'] }
      ]);
      if (path) await this.loadFile(path);
    } catch (err) {
      this.showMessage(String(err), 'error');
    }
  }

  /** Clear all loaded data */
  clearAllData(): void {
    this.state.frames = [];
    this.state.filteredFrames = [];
    this.state.selectedFrameIndex = null;
    this.state.currentFile = null;

    // Update global state
    appStore.set({ mdf4File: null, mdf4Frames: [], mdf4Signals: [] });

    this.renderFrames();
    this.signalsPanel?.clear();

    // Notify other components that MDF4 data was cleared
    emitMdf4Changed({ action: 'cleared' });
  }

  private applyFilters(): void {
    this.state.filteredFrames = filterFrames(this.state.frames, this.state.filters, this.state.dbcInfo);
  }

  private renderFrames(): void {
    this.applyFilters();
    this.framesTable?.setFrames(this.state.filteredFrames);
    this.updateFrameCount();
    this.updateFilterTabBadge();
  }

  private getMessageInfo(canId: number): { name: string; comment?: string } {
    if (!this.state.dbcInfo) return { name: '-' };
    const msg = this.state.dbcInfo.messages.find(m => m.id === canId);
    if (!msg) return { name: '-' };
    return { name: msg.name, comment: msg.comment };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UI Updates
  // ─────────────────────────────────────────────────────────────────────────────

  private updateFrameCount(): void {
    const countEl = this.shadow.querySelector('#framesCount');
    if (countEl) countEl.textContent = String(this.state.filteredFrames.length);
  }

  private updateFilterTabBadge(): void {
    const countEl = this.shadow.querySelector('#filterCount');
    if (countEl) {
      const count = countActiveFilters(this.state.filters);
      countEl.textContent = String(count);
      countEl.classList.toggle('active', count > 0);
    }
  }

  private updateFilterChips(): void {
    const container = this.shadow.querySelector('#filterChips');
    if (!container) return;

    const f = this.state.filters;
    const chips: { label: string; key: string; value: string }[] = [];

    if (f.timeMin !== null) chips.push({ label: `Time ≥ ${f.timeMin}`, key: 'timeMin', value: '' });
    if (f.timeMax !== null) chips.push({ label: `Time ≤ ${f.timeMax}`, key: 'timeMax', value: '' });
    if (f.canIds?.length) chips.push({ label: `ID: ${f.canIds.map(id => '0x' + id.toString(16).toUpperCase()).join(', ')}`, key: 'canIds', value: '' });
    if (f.channel) chips.push({ label: `Ch: ${f.channel}`, key: 'channel', value: '' });
    if (f.dataPattern) chips.push({ label: `Data: ${f.dataPattern}`, key: 'dataPattern', value: '' });
    if (f.messages?.length) chips.push({ label: `Msg: ${f.messages.join(', ')}`, key: 'messages', value: '' });
    if (f.signals?.length) chips.push({ label: `Sig: ${f.signals.join(', ')}`, key: 'signals', value: '' });
    if (f.matchStatus !== 'all') chips.push({ label: f.matchStatus === 'matched' ? 'Matched only' : 'Unmatched only', key: 'matchStatus', value: 'all' });

    if (chips.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = chips.map(c =>
      `<span class="cv-filter-chip" data-key="${c.key}" data-value="${c.value}">${c.label}<button class="cv-filter-chip-x" title="Remove filter">&times;</button></span>`
    ).join('');

    // Bind click handlers for X buttons
    container.querySelectorAll('.cv-filter-chip-x').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chip = (e.target as HTMLElement).closest('.cv-filter-chip') as HTMLElement;
        if (chip) this.clearFilter(chip.dataset.key!, chip.dataset.value!);
      });
    });
  }

  private clearFilter(key: string, defaultValue: string): void {
    // Clear the specific filter input
    const inputMap: Record<string, string> = {
      timeMin: 'filterTimeMin',
      timeMax: 'filterTimeMax',
      canIds: 'filterCanId',
      channel: 'filterChannel',
      dataPattern: 'filterDataPattern',
      messages: 'filterMessage',
      signals: 'filterSignal',
      matchStatus: 'filterMatchStatus',
    };

    const inputId = inputMap[key];
    if (!inputId) return;

    const input = this.filtersPanel?.querySelector(`#${inputId}`) as HTMLInputElement | HTMLSelectElement;
    if (input) {
      input.value = defaultValue;
      input.classList.remove('filter-active');
      // Trigger filter change
      this.filtersPanel?.dispatchEvent(new CustomEvent('filter-change', {
        detail: this.filtersPanel?.getFilters?.() ?? this.state.filters,
        bubbles: true,
      }));
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

customElements.define('cv-mdf4-inspector', Mdf4InspectorElement);
