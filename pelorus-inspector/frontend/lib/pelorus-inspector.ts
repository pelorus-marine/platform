/**
 * Pelorus Inspector Shell
 *
 * Thin orchestration layer that:
 * - Routes between MDF4 Inspector, Live Viewer, DBC / VSS editors, and About tabs
 * - Manages shared DBC state across components
 * - Handles initial file loading from CLI args
 */

import { listen } from './ipc.js';
import type { InspectorApi, InspectorConfig, DbcInfo, InspectorExtension } from './types';
import { extractFilename } from './utils';
import { events, emitDbcChanged, emitVssChanged, type TabSwitchEvent, type VssChangedEvent } from './events';
import { appStore, pelorusWorkspace } from './store';
import { defaultConfig } from './config';
import { mapDbcInfoToDto, createEmptyDbcDto } from './dbc-mapping';
import { getVersion } from '@tauri-apps/api/app';

// Import toolbar components
import './components/toolbars';
import './components/status';
import styles from '../styles/pelorus-inspector.css?inline';

// Import components
import './components/mdf4-inspector';
import './components/live-viewer';
import './components/dbc-editor';
import './components/vss-editor/vss-editor';

import type { Mdf4InspectorElement, Mdf4InspectorApi } from './components/mdf4-inspector';
import type { LiveViewerElement, LiveViewerApi } from './components/live-viewer';
import type { DbcEditorComponent, DbcEditorApi } from './components/dbc-editor';
import type { VssEditorElement, VssEditorApi } from './components/vss-editor/vss-editor';
import { exportDbcToString } from './components/dbc-editor';

/** localStorage key for persisting active tab */
const STORAGE_KEY_TAB = 'pelorus-inspector:active-tab';

/** Shell state */
interface ShellState {
  activeTab: string;
  dbcLoaded: boolean;
  dbcFilename: string | null;
}

/** Pelorus Inspector Shell Component */
export class PelorusInspectorElement extends HTMLElement {
  private api: InspectorApi | null = null;
  private config: Required<InspectorConfig>;
  private state: ShellState;
  private shadow: ShadowRoot;

  // Component references
  private mdf4Inspector: Mdf4InspectorElement | null = null;
  private liveViewer: LiveViewerElement | null = null;
  private dbcEditor: DbcEditorComponent | null = null;
  private vssEditor: VssEditorElement | null = null;

  // Lab / extension panels (CAN, simulator, decoder, workflow, storage)
  private extensions = new Map<string, { ext: InspectorExtension; disabled: boolean }>();
  private aboutExtensions: Array<{ id: string; label: string; panel: string }> = [];

  // Bound handlers for cleanup
  private boundBeforeUnload = this.handleBeforeUnload.bind(this);
  private handleTabSwitch = (e: TabSwitchEvent) => this.switchTab(e.tab);
  /** Unsubscribe Tauri → mitt bridge for `vss-changed` */
  private unlistenVssBackend: (() => void) | null = null;

  constructor() {
    super();
    this.config = { ...defaultConfig };
    // Restore last active tab from localStorage, fallback to config
    const savedTab = localStorage.getItem(STORAGE_KEY_TAB);
    this.state = {
      activeTab: savedTab || this.config.initialTab,
      dbcLoaded: false,
      dbcFilename: null,
    };
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  setApi(api: InspectorApi): void {
    this.api = api;
    this.setupComponents();
    void this.attachVssBackendBridge();
    this.loadInitialFiles();
  }

  /** Forward Rust `vss-changed` events to the mitt bus (same shape as `VssChangedEvent`). */
  private async attachVssBackendBridge(): Promise<void> {
    this.unlistenVssBackend?.();
    this.unlistenVssBackend = null;
    try {
      this.unlistenVssBackend = await listen('vss-changed', ev => {
        emitVssChanged(ev.payload as VssChangedEvent);
      });
    } catch {
      /* Browser / tests without Tauri */
    }
  }

  setConfig(config: Partial<InspectorConfig>): void {
    this.config = { ...defaultConfig, ...config };
    this.state.activeTab = this.config.initialTab;
    this.render();
  }

  /** Configure the viewer (shorthand for setConfig) */
  configure(config: Partial<InspectorConfig>): void {
    this.config = { ...this.config, ...config };
    // Re-render if already connected
    if (this.isConnected) {
      this.render();
    }
  }

  /** Register a lab extension (tab + optional toolbar + panel). */
  async registerExtension(ext: InspectorExtension, disabled = false): Promise<void> {
    this.extensions.set(ext.id, { ext, disabled });
    if (this.api && ext.setup && !disabled) {
      await ext.setup(this.api);
    }
    if (this.isConnected) {
      this.render();
      this.setupComponents();
    }
  }

  /** Lab extensions currently registered */
  getExtensions(): InspectorExtension[] {
    return Array.from(this.extensions.values()).map(entry => entry.ext);
  }

  /** Stop an extension and drop its tab/panel (teardown if provided). */
  unregisterExtension(id: string): void {
    const entry = this.extensions.get(id);
    if (entry?.ext.teardown) {
      entry.ext.teardown();
    }
    this.extensions.delete(id);
    if (this.isConnected) {
      this.render();
      this.setupComponents();
    }
  }

  /** Add a sub-tab to the About panel */
  addAboutTab(id: string, label: string, panel: string): void {
    this.aboutExtensions.push({ id, label, panel });
    if (this.isConnected) {
      this.render();
    }
  }

  connectedCallback(): void {
    this.render();
    this.loadVersion();
    window.addEventListener('beforeunload', this.boundBeforeUnload);
    events.on('tab:switch', this.handleTabSwitch);
  }

  private async loadVersion(): Promise<void> {
    try {
      const version = await getVersion();
      const versionEl = this.shadow.querySelector('#appVersion');
      if (versionEl) {
        versionEl.textContent = `v${version}`;
      }
    } catch {
      // Fallback if not running in Tauri
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener('beforeunload', this.boundBeforeUnload);
    events.off('tab:switch', this.handleTabSwitch);
    this.unlistenVssBackend?.();
    this.unlistenVssBackend = null;
  }

  private handleBeforeUnload(e: BeforeUnloadEvent): void {
    const dirty: string[] = [];
    if (this.dbcEditor?.getIsDirty()) dirty.push('DBC');
    if (this.vssEditor?.getIsDirty()) dirty.push('VSS catalog');
    if (dirty.length > 0) {
      e.preventDefault();
      e.returnValue = `You have unsaved changes (${dirty.join(', ')}). Leave anyway?`;
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
    // Recreated custom elements need API wiring again (setApi / registerExtension are not re-run).
    if (this.api) {
      this.setupComponents();
    }
    this.switchTab(this.state.activeTab);
  }

  private generateTemplate(): string {
    const extensionTabs = Array.from(this.extensions.values())
      .filter(({ ext }) => ext.tab)
      .map(({ ext, disabled }) => {
        const disabledClass = disabled ? ' disabled' : '';
        const disabledAttr = disabled ? ' data-disabled="true"' : '';
        const icon = ext.tab!.icon || '';
        return `<button class="cv-tab${disabledClass}" data-tab="${ext.tab!.id}" title="${ext.tab!.title || ''}"${disabledAttr}>${icon}${ext.tab!.label}</button>`;
      })
      .join('');

    const extensionToolbars = Array.from(this.extensions.values())
      .filter(({ ext }) => ext.toolbar)
      .map(({ ext, disabled }) => {
        const disabledAttr = disabled ? ' data-disabled="true"' : '';
        return `<${ext.toolbar}${disabledAttr}></${ext.toolbar}>`;
      })
      .join('');

    const extensionPanels = Array.from(this.extensions.values())
      .filter(({ ext }) => ext.panel && ext.tab)
      .map(({ ext, disabled }) => {
        const disabledClass = disabled ? ' cv-panel-disabled' : '';
        return `<${ext.panel} class="cv-panel hidden${disabledClass}" id="${ext.tab!.id}Panel"></${ext.panel}>`;
      })
      .join('');

    return `
      <div class="cv-app">
        <header class="cv-app-header">
          <div class="cv-header-row">
            <h1 class="cv-app-title">${this.config.appName}</h1>
            <div class="cv-header-status">
              <cv-dbc-status></cv-dbc-status>
              <cv-mdf4-status></cv-mdf4-status>
            </div>
          </div>
          <nav class="cv-tabs bordered">
            ${this.config.showDbcTab ? '<button class="cv-tab" data-tab="dbc" title="View and manage DBC files">DBC</button>' : ''}
            ${this.config.showVssTab ? '<button class="cv-tab" data-tab="vss" title="Pelorus VSS catalog (.vspec)">VSS</button>' : ''}
            ${this.config.showMdf4Tab ? '<button class="cv-tab" data-tab="mdf4" title="Load MDF4 measurement files">MDF4</button>' : ''}
            ${this.config.showLiveTab ? '<button class="cv-tab" data-tab="live" title="Capture from SocketCAN">Live</button>' : ''}
            ${extensionTabs}
            ${this.config.showAboutTab ? `<button class="cv-tab" data-tab="about" title="About ${this.config.appName}">About</button>` : ''}
          </nav>
          <cv-mdf4-toolbar></cv-mdf4-toolbar>
          <cv-live-toolbar></cv-live-toolbar>
          <cv-dbc-toolbar></cv-dbc-toolbar>
          ${this.config.showVssTab ? '<cv-vss-toolbar></cv-vss-toolbar>' : ''}
          ${extensionToolbars}
          <div id="aboutTab" class="cv-toolbar cv-tab-pane cv-about-header">
            <span class="cv-about-title">${this.config.appName}</span>
            <span class="cv-about-version" id="appVersion"></span>
            <span class="cv-about-desc">By sailors, for sailors — open tools for MDF4, SocketCAN, Rhai, and DBC workflows.</span>
          </div>
        </header>
        <cv-mdf4-inspector class="cv-panel hidden" id="mdf4Panel"></cv-mdf4-inspector>
        <cv-live-viewer class="cv-panel hidden" id="livePanel"></cv-live-viewer>
        <cv-dbc-editor class="cv-panel hidden" id="dbcPanel"></cv-dbc-editor>
        ${this.config.showVssTab ? '<cv-vss-editor class="cv-panel hidden" id="vssPanel"></cv-vss-editor>' : ''}
        ${extensionPanels}
        ${this.generateAboutPanel()}
      </div>
    `;
  }

  private generateAboutPanel(): string {
    // Generate extension tabs for about panel
    const aboutExtTabs = this.aboutExtensions
      .map(ext => `<button class="cv-tab" data-tab="${ext.id}">${ext.label}</button>`)
      .join('');

    // Generate extension panels for about panel
    const aboutExtPanels = this.aboutExtensions
      .map(ext => `<div class="cv-tab-pane" id="about${ext.id.charAt(0).toUpperCase() + ext.id.slice(1)}"><${ext.panel}></${ext.panel}></div>`)
      .join('');

    return `
      <section class="cv-panel hidden" id="aboutPanel">
        <nav class="cv-panel-header cv-tabs">
          <button class="cv-tab active" data-tab="features">Features</button>
          <button class="cv-tab" data-tab="acknowledgments">Acknowledgments</button>
          ${aboutExtTabs}
        </nav>
        <div class="cv-tab-pane active" id="aboutFeatures">
          <div class="cv-grid responsive">
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">MDF4 File Support</span></div><p class="cv-card-body">Load and analyze CAN data from ASAM MDF4 measurement files with timestamps and decoded signals.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Live SocketCAN Capture</span></div><p class="cv-card-body">Lossless capture from Linux SocketCAN with real-time MDF4 recording and live monitors.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">DBC Signal Decoding</span></div><p class="cv-card-body">Decode raw CAN frames into physical values. Supports CAN 2.0 and CAN FD with extended IDs.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Built-in DBC Editor</span></div><p class="cv-card-body">Create and modify DBC files directly. Edit messages, signals, and their properties.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">VSS Signal Catalog</span></div><p class="cv-card-body">Edit Pelorus <code>Vessel.*</code> catalogs (COVESA VSS syntax). Decode view shows semantic paths next to DBC signals.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Real-time Monitors</span></div><p class="cv-card-body">Message monitor shows latest data per CAN ID. Signal monitor groups decoded values by message.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">High Performance</span></div><p class="cv-card-body">Rust backend handles all processing. Pre-rendered updates minimize frontend overhead.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">SocketCAN Lab</span></div><p class="cv-card-body">Create vcan/slcan interfaces, tune bit timing, and bridge buses with gateway helpers (where the OS allows).</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Rhai Simulator</span></div><p class="cv-card-body">Script repeatable traffic for bring-up, commissioning, and bench testing with DBC-aware encoding.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Message Lab</span></div><p class="cv-card-body">Pattern scans and byte-level stats to spot counters, gauges, and multiplexed fields without a DBC.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Workflow Canvas</span></div><p class="cv-card-body">Chain decode, filters, Rhai transforms, and MDF4 sinks in a visual DAG executed fully in Rust.</p></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Voyage Stash</span></div><p class="cv-card-body">SQLite-backed storage for DBC, MDF4, Rhai scripts, and workflows with ZIP export for sharing.</p></div>
          </div>
        </div>
        <div class="cv-tab-pane" id="aboutAcknowledgments">
          <div class="cv-grid responsive">
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Standards</span></div><ul class="cv-card-body cv-deps-list"><li><a href="https://www.asam.net/standards/detail/mdf/" target="_blank">ASAM MDF4</a> – Measurement data format</li><li><a href="https://covesa.github.io/vehicle_signal_specification/" target="_blank">COVESA VSS</a> – Vehicle Signal Specification</li><li><a href="https://docs.kernel.org/networking/can.html" target="_blank">SocketCAN</a> – Linux CAN subsystem</li><li><a href="https://www.iso.org/standard/63648.html" target="_blank">ISO 11898</a> – CAN protocol spec</li></ul></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Rust Core</span></div><ul class="cv-card-body cv-deps-list"><li><a href="https://tauri.app" target="_blank">Tauri</a> – Desktop app framework</li><li class="cv-sister-project"><a href="https://github.com/sigmatactical-org/mdf4-rs" target="_blank">mdf4-rs</a> – MDF4 parser/writer</li><li class="cv-sister-project"><a href="https://github.com/sigmatactical-org/dbc-rs" target="_blank">dbc-rs</a> – DBC parser/decoder</li><li><a href="https://crates.io/crates/socketcan" target="_blank">socketcan</a> – CAN FD bindings</li></ul></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Rust Ecosystem</span></div><ul class="cv-card-body cv-deps-list"><li><a href="https://tokio.rs" target="_blank">Tokio</a> – Async runtime</li><li><a href="https://serde.rs" target="_blank">Serde</a> – Serialization</li><li><a href="https://clap.rs" target="_blank">Clap</a> – CLI parser</li><li><a href="https://rhai.rs" target="_blank">Rhai</a> – Embedded scripting</li><li><a href="https://crates.io/crates/rusqlite" target="_blank">rusqlite</a> – SQLite</li><li><a href="https://crates.io/crates/zip" target="_blank">zip</a> – Archives</li></ul></div>
            <div class="cv-card"><div class="cv-card-header"><span class="cv-card-title">Frontend</span></div><ul class="cv-card-body cv-deps-list"><li><a href="https://vite.dev" target="_blank">Vite</a> – Build tool</li><li><a href="https://www.typescriptlang.org" target="_blank">TypeScript</a> – Typed JavaScript</li><li><a href="https://vitest.dev" target="_blank">Vitest</a> – Test framework</li></ul></div>
          </div>
          <p class="cv-about-license">MIT or Apache-2.0 • Rust + TypeScript</p>
        </div>
        ${aboutExtPanels}
      </section>
    `;
  }

  private cacheElements(): void {
    this.mdf4Inspector = this.shadow.querySelector('cv-mdf4-inspector');
    this.liveViewer = this.shadow.querySelector('cv-live-viewer');
    this.dbcEditor = this.shadow.querySelector('cv-dbc-editor');
    this.vssEditor = this.shadow.querySelector('cv-vss-editor');
  }

  private bindEvents(): void {
    // Main tab switching
    this.shadow.querySelectorAll('.cv-tabs.bordered .cv-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        if (el.dataset.disabled === 'true') {
          return;
        }
        const tab = el.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });

    // MDF4 toolbar events
    this.shadow.querySelector('cv-mdf4-toolbar')?.addEventListener('open', () => this.mdf4Inspector?.promptLoadMdf4());
    this.shadow.querySelector('cv-mdf4-toolbar')?.addEventListener('clear', () => this.mdf4Inspector?.clearAllData());

    // Live toolbar events
    this.shadow.querySelector('cv-live-toolbar')?.addEventListener('refresh-interfaces', () => this.liveViewer?.loadInterfaces());
    this.shadow.querySelector('cv-live-toolbar')?.addEventListener('start-capture', (e: Event) => {
      const iface = (e as CustomEvent<{ interface: string }>).detail.interface;
      this.liveViewer?.startCapture(iface);
    });
    this.shadow.querySelector('cv-live-toolbar')?.addEventListener('stop-capture', () => this.liveViewer?.stopCapture());
    this.shadow.querySelector('cv-live-toolbar')?.addEventListener('clear', () => this.liveViewer?.clearAllData());

    // DBC toolbar events
    this.shadow.querySelector('cv-dbc-toolbar')?.addEventListener('new', () => this.dbcEditor?.handleNew());
    this.shadow.querySelector('cv-dbc-toolbar')?.addEventListener('open', () => this.dbcEditor?.handleOpen());
    this.shadow.querySelector('cv-dbc-toolbar')?.addEventListener('edit', () => this.dbcEditor?.setEditMode(true));
    this.shadow.querySelector('cv-dbc-toolbar')?.addEventListener('cancel', () => this.dbcEditor?.cancelEdit());
    this.shadow.querySelector('cv-dbc-toolbar')?.addEventListener('save', () => this.dbcEditor?.handleSave());
    this.shadow.querySelector('cv-dbc-toolbar')?.addEventListener('save-as', () => this.dbcEditor?.handleSaveAs());

    // VSS toolbar events
    this.shadow.querySelector('cv-vss-toolbar')?.addEventListener('new', () => this.vssEditor?.handleNew());
    this.shadow.querySelector('cv-vss-toolbar')?.addEventListener('open', () => this.vssEditor?.handleOpen());
    this.shadow.querySelector('cv-vss-toolbar')?.addEventListener('clear', () => void this.vssEditor?.handleClearCatalog());
    this.shadow.querySelector('cv-vss-toolbar')?.addEventListener('save', () => this.vssEditor?.handleSave());
    this.shadow.querySelector('cv-vss-toolbar')?.addEventListener('save-as', () => this.vssEditor?.handleSaveAs());

    // About panel tabs
    this.shadow.querySelector('#aboutPanel')?.querySelectorAll('.cv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        if (!tabName) return;
        this.shadow.querySelector('#aboutPanel')?.querySelectorAll('.cv-tab').forEach(t =>
          t.classList.toggle('active', (t as HTMLElement).dataset.tab === tabName)
        );
        this.shadow.querySelector('#aboutPanel')?.querySelectorAll('.cv-tab-pane').forEach(p =>
          p.classList.toggle('active', p.id === `about${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)
        );
      });
    });

    // External links
    this.shadow.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href]') as HTMLAnchorElement;
      if (anchor?.href && anchor.target === '_blank') {
        e.preventDefault();
        this.openExternalUrl(anchor.href);
      }
    });

  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Component Setup
  // ─────────────────────────────────────────────────────────────────────────────

  private setupComponents(): void {
    if (!this.api) return;

    // Setup MDF4 Inspector
    if (this.mdf4Inspector) {
      this.mdf4Inspector.setApi(this.createMdf4Api());
    }

    // Setup Live Viewer
    if (this.liveViewer) {
      this.liveViewer.setApi(this.createLiveApi());
    }

    // Setup DBC Editor
    if (this.dbcEditor) {
      this.dbcEditor.setApi(this.createDbcEditorApi());
    }

    // Setup VSS Editor
    if (this.vssEditor) {
      this.vssEditor.setApi(this.createVssEditorApi());
    }
  }

  private createVssEditorApi(): VssEditorApi {
    const api = this.api!;
    return {
      loadVss: (path) => api.loadVss(path),
      saveVssContent: (path, content) => api.saveVssContent(path, content),
      clearVss: (emitChanged?) => api.clearVss(emitChanged),
      updateVssContent: (content) => api.updateVssContent(content),
      updateVssCatalog: (dto) => api.updateVssCatalog(dto),
      serializeVssCatalog: (dto) => api.serializeVssCatalog(dto),
      getVssSnapshot: () => api.getVssSnapshot(),
      getVssPath: () => api.getVssPath(),
      openFileDialog: () =>
        api.openFileDialog([{ name: 'VSS catalog', extensions: ['vspec', 'yaml', 'yml'] }]),
      saveFileDialog: (filters, defaultName) => api.saveFileDialog(filters, defaultName),
    };
  }

  private createMdf4Api(): Mdf4InspectorApi {
    const api = this.api!;
    return {
      loadMdf4: (path) => api.loadMdf4(path),
      decodeFrames: (frames) => api.decodeFrames(frames),
      openFileDialog: (filters) => api.openFileDialog(filters),
      getDbcInfo: () => api.getDbcInfo(),
    };
  }

  private createLiveApi(): LiveViewerApi {
    const api = this.api!;
    return {
      listCanInterfaces: () => api.listCanInterfaces(),
      startCapture: (iface, captureFile, append) => api.startCapture(iface, captureFile, append),
      stopCapture: () => api.stopCapture(),
      saveFileDialog: (filters, defaultName) => api.saveFileDialog(filters, defaultName),
      getDbcInfo: () => api.getDbcInfo(),
      onLiveCaptureUpdate: (cb) => api.onLiveCaptureUpdate(cb),
      onCaptureFinalized: (cb) => api.onCaptureFinalized(cb),
      onCaptureError: (cb) => api.onCaptureError(cb),
      getFiltersForInterface: (iface) => {
        const { interfaceFilters } = pelorusWorkspace.get();
        return interfaceFilters[iface];
      },
    };
  }

  private createDbcEditorApi(): DbcEditorApi {
    const api = this.api!;

    return {
      loadDbc: async (path: string) => {
        await api.loadDbc(path);
        const info = await api.getDbcInfo();
        if (!info) throw new Error('Failed to load DBC');
        this.state.dbcLoaded = true;
        this.state.dbcFilename = extractFilename(path);
        appStore.set({ dbcFile: path });
        this.emitDbcChange('loaded', info);
        return mapDbcInfoToDto(info);
      },
      saveDbcContent: async (path: string, content: string) => {
        await api.saveDbcContent(path, content);
        this.state.dbcFilename = extractFilename(path);
        appStore.set({ dbcFile: path });
        const info = await api.getDbcInfo();
        this.emitDbcChange('updated', info);
      },
      newDbc: async () => {
        await api.clearDbc();
        this.state.dbcLoaded = false;
        this.state.dbcFilename = null;
        appStore.set({ dbcFile: null });
        this.emitDbcChange('new', null);
        return createEmptyDbcDto();
      },
      getDbc: async () => {
        try {
          const info = await api.getDbcInfo();
          if (!info) return null;
          return mapDbcInfoToDto(info);
        } catch {
          return null;
        }
      },
      updateDbc: async (dbc) => {
        const content = exportDbcToString(dbc);
        await api.updateDbcContent(content);
        this.state.dbcLoaded = true;
        const info = await api.getDbcInfo();
        this.emitDbcChange('updated', info);
      },
      getCurrentFile: async () => api.getDbcPath(),
      isDirty: async () => false,
      openFileDialog: async () => api.openFileDialog([{ name: 'DBC Files', extensions: ['dbc'] }]),
      saveFileDialog: async () => api.saveFileDialog([{ name: 'DBC Files', extensions: ['dbc'] }], 'untitled.dbc'),
      getDbcSpecification: async () => api.getDbcSpecification(),
    };
  }

  /** Emit DBC changed event for all listeners */
  private emitDbcChange(action: 'loaded' | 'cleared' | 'updated' | 'new', dbcInfo: DbcInfo | null): void {
    emitDbcChanged({
      action,
      dbcInfo,
      filename: this.state.dbcFilename,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Tab Management
  // ─────────────────────────────────────────────────────────────────────────────

  private switchTab(tab: string): void {
    // Warn about unsaved DBC changes when leaving the DBC tab
    if (this.state.activeTab === 'dbc' && tab !== 'dbc') {
      if (this.dbcEditor?.hasUnsavedChanges()) {
        if (!confirm('You have unsaved changes in the DBC editor. Leave anyway?')) {
          return;
        }
      }
    }

    if (this.state.activeTab === 'vss' && tab !== 'vss') {
      if (this.vssEditor?.hasUnsavedChanges()) {
        if (!confirm('You have unsaved changes in the VSS catalog editor. Leave anyway?')) {
          return;
        }
      }
    }

    this.state.activeTab = tab;
    localStorage.setItem(STORAGE_KEY_TAB, tab);

    // Update tab buttons
    this.shadow.querySelectorAll('.cv-tabs.bordered .cv-tab').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tab);
    });

    // Update tab header panes
    this.shadow.querySelectorAll('.cv-app-header > .cv-tab-pane').forEach(content => {
      content.classList.toggle('active', content.id === `${tab}Tab`);
    });

    // Show/hide component panels
    const mdf4Panel = this.shadow.querySelector('#mdf4Panel');
    const livePanel = this.shadow.querySelector('#livePanel');
    const dbcPanel = this.shadow.querySelector('#dbcPanel');
    const vssPanel = this.shadow.querySelector('#vssPanel');
    const aboutPanel = this.shadow.querySelector('#aboutPanel');

    mdf4Panel?.classList.toggle('hidden', tab !== 'mdf4');
    livePanel?.classList.toggle('hidden', tab !== 'live');
    dbcPanel?.classList.toggle('hidden', tab !== 'dbc');
    vssPanel?.classList.toggle('hidden', tab !== 'vss');
    aboutPanel?.classList.toggle('hidden', tab !== 'about');

    // Show/hide extension panels
    for (const { ext, disabled } of this.extensions.values()) {
      if (ext.tab && ext.panel) {
        const panel = this.shadow.querySelector(`#${ext.tab.id}Panel`);
        panel?.classList.toggle('hidden', tab !== ext.tab.id);
        panel?.classList.toggle('cv-panel-disabled', disabled);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Initial Loading
  // ─────────────────────────────────────────────────────────────────────────────

  private async loadInitialFiles(): Promise<void> {
    if (!this.api) return;
    try {
      const initial = await this.api.getInitialFiles();
      if (initial.dbc_path && this.dbcEditor) {
        await this.dbcEditor.loadFile(initial.dbc_path);
        // DBC loaded at startup - switch to MDF4 tab (ready to load/capture data)
        this.switchTab('mdf4');
      }
      if (initial.mdf4_path && this.mdf4Inspector) {
        await this.mdf4Inspector.loadFile(initial.mdf4_path);
        this.switchTab('mdf4');
      }
      if (initial.vss_path && this.vssEditor && this.config.showVssTab) {
        await this.vssEditor.loadFile(initial.vss_path);
      }
    } catch (err) {
      console.error('Failed to load initial files:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  private async openExternalUrl(url: string): Promise<void> {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch {
      window.open(url, '_blank');
    }
  }
}

customElements.define('pelorus-inspector', PelorusInspectorElement);
export default PelorusInspectorElement;
