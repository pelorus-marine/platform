/**
 * Traffic Simulator Component — Pelorus Inspector
 *
 * Tabbed interface for CAN traffic simulation:
 * - Tab 1: Script Editor
 * - Tab 2: Templates (with preview and apply)
 * - Tab 3: Statistics
 */

import './sim-script-editor.js';
import { getDefaultScript, getTemplate } from './script-templates.js';
import { events, emitSimulatorStarted, emitSimulatorStopped, type SimulatorStats, type SimulatorStartRequestedEvent } from '../events.js';
import { invoke } from '../ipc.js';
import type { SimScriptEditorElement } from './sim-script-editor.js';
import {
  PANEL_TAB_STYLES, SIDEBAR_STYLES, LOG_STYLES, STAT_CARD_STYLES,
  STATUS_STYLES, TEMPLATE_LIST_STYLES, TOAST_DISMISSABLE_STYLES
} from '../editors/styles.js';
import {
  type LogEntry, type SelectOption, type StatCardDefinition,
  renderLogContainer, updateLogDisplay, createLogEntry, showToast,
  renderPanelTabs, bindTabSwitching, switchTab,
  renderStatusIndicator, updateStatusIndicator,
  renderStatsGrid, updateStatValue,
  renderSidebarSelect, renderSidebarSection,
  createVisibilityAwareInterval,
} from '../editors/form-helpers.js';

interface InterfaceInfo {
  name: string;
  available: boolean;
}

const RATE_OPTIONS: SelectOption[] = [
  { value: 0.1, label: '0.1 Mbit/s' },
  { value: 0.25, label: '0.25 Mbit/s' },
  { value: 0.5, label: '0.5 Mbit/s' },
  { value: 1, label: '1 Mbit/s' },
  { value: 2, label: '2 Mbit/s' },
  { value: 5, label: '5 Mbit/s' },
  { value: 8, label: '8 Mbit/s (CAN FD)' },
];

const TEMPLATES = [
  { key: 'default', name: 'Default', desc: 'Basic template with DBC signal example' },
  { key: 'basic', name: 'Basic Raw', desc: 'Simple raw CAN data every 100ms' },
  { key: 'dbc_signals', name: 'DBC Signals', desc: 'Uses signal definitions from DBC' },
  { key: 'obd2', name: 'OBD-II', desc: 'OBD-II diagnostic response simulation' },
  { key: 'sweep', name: 'Sweep', desc: 'Ramps values from 0 to max' },
  { key: 'noise', name: 'Noise', desc: 'Random data for testing' },
  { key: 'can_fd', name: 'CAN FD', desc: 'CAN FD frames up to 64 bytes' },
];

const TABS = [
  { id: 'script', label: 'Simulation Script' },
  { id: 'templates', label: 'Templates', badge: TEMPLATES.length },
  { id: 'stats', label: 'Statistics' },
];

const componentStyles = `
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .sim-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--cv-bg);
  }
  .script-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .script-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .stats-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  .stats-section { margin-bottom: 24px; }
  .section-title {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--cv-border);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--cv-text-muted);
  }
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--cv-bg-alt);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    margin-bottom: 16px;
    font-size: 0.85rem;
  }
`;

const styles = PANEL_TAB_STYLES + SIDEBAR_STYLES + LOG_STYLES + STAT_CARD_STYLES +
  STATUS_STYLES + TEMPLATE_LIST_STYLES + TOAST_DISMISSABLE_STYLES + componentStyles;

export class TrafficSimulatorElement extends HTMLElement {
  private shadow: ShadowRoot;
  private script = '';
  private poller: { start: () => void; stop: () => void } | null = null;
  private selectedTemplate: string | null = null;
  private logs: LogEntry[] = [];
  private interfaces: InterfaceInfo[] = [];
  private selectedInterface = 'vcan0';
  private targetRate = 0.5;
  private activeTab = 'script';
  private stats: SimulatorStats = {
    running: false,
    frames_sent: 0,
    elapsed_secs: 0,
    actual_rate_mbps: 0,
    frames_per_sec: 0,
    target_rate_mbps: 0,
  };

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.script = getDefaultScript();
    this.render();
    this.bindEvents();
    this.loadStats();
    this.loadInterfaces();
    this.startPolling();
    events.on('simulator:start-requested', this.handleStartRequested);
  }

  disconnectedCallback(): void {
    this.stopPolling();
    events.off('simulator:start-requested', this.handleStartRequested);
  }

  private get editor(): SimScriptEditorElement | null {
    return this.shadow.querySelector('sim-script-editor');
  }

  private render(): void {
    this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="sim-panel">
        ${renderPanelTabs(TABS, this.activeTab)}
        <div class="panel-content">
          ${this.renderScriptTab()}
          ${this.renderTemplatesTab()}
          ${this.renderStatsTab()}
        </div>
      </div>
    `;

    if (this.editor) {
      this.editor.script = this.script;
    }
  }

  private renderScriptTab(): string {
    const interfaceOptions = this.getInterfaceOptions();
    return `
      <div class="panel-pane ${this.activeTab === 'script' ? 'active' : ''}" id="scriptPane">
        <div class="script-layout">
          <div class="script-main">
            <sim-script-editor></sim-script-editor>
          </div>
          <div class="sidebar">
            ${renderSidebarSection('Status', renderStatusIndicator(this.stats.running))}
            ${renderSidebarSection('Configuration', `
              ${renderSidebarSelect('sidebarInterface', 'Interface', interfaceOptions, this.selectedInterface, this.stats.running)}
              ${renderSidebarSelect('sidebarRate', 'Target Rate', RATE_OPTIONS, this.targetRate, this.stats.running)}
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderTemplatesTab(): string {
    return `
      <div class="panel-pane ${this.activeTab === 'templates' ? 'active' : ''}" id="templatesPane">
        <div class="templates-container">
          <div class="templates-list">
            ${TEMPLATES.map(t => `
              <div class="template-item ${this.selectedTemplate === t.key ? 'selected' : ''}" data-template="${t.key}">
                <div class="template-name">${t.name}</div>
                <div class="template-desc">${t.desc}</div>
              </div>
            `).join('')}
          </div>
          <div class="template-preview">
            ${this.selectedTemplate ? `
              <div class="preview-header">
                <span class="preview-title">Preview</span>
                <button class="cv-btn accent" id="applyTemplateBtn">Apply Template</button>
              </div>
              <pre class="preview-code">${this.getTemplateCode(this.selectedTemplate)}</pre>
            ` : `<div class="preview-empty">Select a template to preview</div>`}
          </div>
        </div>
      </div>
    `;
  }

  private renderStatsTab(): string {
    const statCards: StatCardDefinition[] = [
      { id: 'statFrames', label: 'Frames Sent', value: this.stats.frames_sent.toLocaleString() },
      { id: 'statElapsed', label: 'Elapsed Time', value: this.formatTime(this.stats.elapsed_secs) },
      { id: 'statRate', label: 'Actual Rate', sublabel: 'Mbit/s', value: this.stats.actual_rate_mbps.toFixed(3) },
      { id: 'statFps', label: 'Frames/sec', value: Math.round(this.stats.frames_per_sec).toLocaleString() },
      { id: 'statTarget', label: 'Target Rate', sublabel: 'Mbit/s', value: this.stats.target_rate_mbps.toFixed(2) },
      { id: 'statEfficiency', label: 'Efficiency', value: this.getEfficiency() },
    ];

    return `
      <div class="panel-pane ${this.activeTab === 'stats' ? 'active' : ''}" id="statsPane">
        <div class="stats-container">
          <div class="status-bar">
            <div class="cv-status-dot ${this.stats.running ? 'active pulse' : ''}"></div>
            <span>${this.stats.running ? 'Simulator Running' : 'Simulator Stopped'}</span>
          </div>
          <div class="stats-section">
            <div class="section-title">Performance</div>
            ${renderStatsGrid(statCards)}
          </div>
          <div class="stats-section">
            <div class="section-title">Log</div>
            ${renderLogContainer(this.logs)}
          </div>
        </div>
      </div>
    `;
  }

  private getInterfaceOptions(): SelectOption[] {
    if (this.interfaces.length === 0) {
      return [{ value: 'vcan0', label: 'vcan0' }];
    }
    return this.interfaces.map(i => ({
      value: i.name,
      label: i.available ? i.name : `${i.name} (n/a)`
    }));
  }

  private getEfficiency(): string {
    return this.stats.target_rate_mbps > 0
      ? `${((this.stats.actual_rate_mbps / this.stats.target_rate_mbps) * 100).toFixed(1)}%`
      : '0.0%';
  }

  private getTemplateCode(key: string): string {
    return getTemplate(key);
  }

  private formatTime(secs: number): string {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  }

  private bindEvents(): void {
    // Tab switching
    bindTabSwitching(this.shadow, (tabId) => {
      this.activeTab = tabId;
      switchTab(this.shadow, tabId);
    });

    // Script editor events
    this.editor?.addEventListener('script-change', ((e: CustomEvent) => {
      this.script = e.detail.script;
    }) as EventListener);

    this.editor?.addEventListener('validate', (async () => {
      await this.handleValidate();
    }) as EventListener);

    this.editor?.addEventListener('apply', (async () => {
      await this.handleApplyScript();
    }) as EventListener);

    // Sidebar controls
    this.shadow.querySelector('#sidebarInterface')?.addEventListener('change', (e) => {
      this.selectedInterface = (e.target as HTMLSelectElement).value;
      this.updateConfig();
    });

    this.shadow.querySelector('#sidebarRate')?.addEventListener('change', (e) => {
      this.targetRate = parseFloat((e.target as HTMLSelectElement).value);
      this.updateConfig();
    });

    // Template selection
    this.shadow.querySelectorAll('.template-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectedTemplate = (item as HTMLElement).dataset.template || null;
        this.updateTemplatesTab();
      });
    });

    // Apply template button
    this.shadow.querySelector('#applyTemplateBtn')?.addEventListener('click', () => {
      this.applySelectedTemplate();
    });
  }

  private updateTemplatesTab(): void {
    const templatesPane = this.shadow.querySelector('#templatesPane');
    if (!templatesPane) return;

    // Update selection state
    templatesPane.querySelectorAll('.template-item').forEach(item => {
      item.classList.toggle('selected', (item as HTMLElement).dataset.template === this.selectedTemplate);
    });

    // Update preview
    const preview = templatesPane.querySelector('.template-preview');
    if (preview && this.selectedTemplate) {
      preview.innerHTML = `
        <div class="preview-header">
          <span class="preview-title">Preview</span>
          <button class="cv-btn accent" id="applyTemplateBtn">Apply Template</button>
        </div>
        <pre class="preview-code">${this.getTemplateCode(this.selectedTemplate)}</pre>
      `;
      preview.querySelector('#applyTemplateBtn')?.addEventListener('click', () => {
        this.applySelectedTemplate();
      });
    } else if (preview) {
      preview.innerHTML = `<div class="preview-empty">Select a template to preview</div>`;
    }
  }

  private applySelectedTemplate(): void {
    if (!this.selectedTemplate) return;

    const code = this.getTemplateCode(this.selectedTemplate);
    this.script = code;
    if (this.editor) {
      this.editor.script = code;
    }

    this.addLog(`Loaded template: ${this.selectedTemplate}`, 'info');
    this.activeTab = 'script';
    switchTab(this.shadow, 'script');
  }

  private updateStatsDisplay(): void {
    updateStatValue(this.shadow, 'statFrames', this.stats.frames_sent.toLocaleString());
    updateStatValue(this.shadow, 'statElapsed', this.formatTime(this.stats.elapsed_secs));
    updateStatValue(this.shadow, 'statRate', this.stats.actual_rate_mbps.toFixed(3));
    updateStatValue(this.shadow, 'statFps', Math.round(this.stats.frames_per_sec).toLocaleString());
    updateStatValue(this.shadow, 'statTarget', this.stats.target_rate_mbps.toFixed(2));
    updateStatValue(this.shadow, 'statEfficiency', this.getEfficiency());

    // Update all status indicators
    this.updateAllStatusIndicators();
  }

  private updateAllStatusIndicators(): void {
    // Sidebar status
    updateStatusIndicator(this.shadow, this.stats.running);

    // Stats tab status bar
    const statusBar = this.shadow.querySelector('.status-bar');
    if (statusBar) {
      const dot = statusBar.querySelector('.cv-status-dot');
      const text = statusBar.querySelector('span');
      if (dot) {
        dot.classList.toggle('active', this.stats.running);
        dot.classList.toggle('pulse', this.stats.running);
      }
      if (text) text.textContent = this.stats.running ? 'Simulator Running' : 'Simulator Stopped';
    }

    // Disable controls when running
    const sidebarInterface = this.shadow.querySelector('#sidebarInterface') as HTMLSelectElement;
    const sidebarRate = this.shadow.querySelector('#sidebarRate') as HTMLSelectElement;
    if (sidebarInterface) sidebarInterface.disabled = this.stats.running;
    if (sidebarRate) sidebarRate.disabled = this.stats.running;
  }

  private async loadInterfaces(): Promise<void> {
    try {
      this.interfaces = await invoke<InterfaceInfo[]>('sim_list_interfaces');
      this.updateInterfaceSelect();
    } catch (e) {
      console.error('Failed to load interfaces:', e);
    }
  }

  private updateInterfaceSelect(): void {
    const select = this.shadow.querySelector('#sidebarInterface') as HTMLSelectElement;
    if (!select) return;
    select.innerHTML = this.getInterfaceOptions()
      .map(o => `<option value="${o.value}" ${o.value === this.selectedInterface ? 'selected' : ''}>${o.label}</option>`)
      .join('');
  }

  private async updateConfig(): Promise<void> {
    if (this.stats.running) return;
    try {
      await invoke<void>('sim_set_config', {
        config: { interface: this.selectedInterface, rate_mbps: this.targetRate }
      });
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  }

  addLog(text: string, type: LogEntry['type'] = 'info'): void {
    this.logs.unshift(createLogEntry(text, type));
    if (this.logs.length > 100) this.logs.pop();
    updateLogDisplay(this.shadow, this.logs);

    // Show toast for errors
    if (type === 'error') {
      showToast(this.shadow, text, 'error');
    }
  }

  private handleStartRequested = async (_e: SimulatorStartRequestedEvent): Promise<void> => {
    // Auto-apply script before starting
    if (this.script.trim()) {
      try {
        await invoke<void>('sim_load_script', { script: this.script });
        this.editor?.markApplied();
        this.addLog('Script loaded', 'info');
      } catch (e) {
        this.addLog(`Failed to load script: ${e}`, 'error');
        return;
      }
    }
    // Proceed with start
    try {
      await invoke<void>('sim_start');
      this.addLog('Simulator started', 'success');
      emitSimulatorStarted({ interface: this.selectedInterface });
      await this.loadStats();
    } catch (e) {
      this.addLog(`Start failed: ${e}`, 'error');
    }
  };

  private startPolling(): void {
    if (this.poller) return;
    this.poller = createVisibilityAwareInterval(() => this.pollStats(), 500);
    this.poller.start();
  }

  private stopPolling(): void {
    this.poller?.stop();
    this.poller = null;
  }

  private async pollStats(): Promise<void> {
    try {
      const wasRunning = this.stats.running;
      this.stats = await invoke<SimulatorStats>('sim_get_stats');
      this.updateStatsDisplay();
      events.emit('simulator:stats', { stats: this.stats });

      // Poll for script logs
      const logs = await invoke<string[]>('sim_get_logs');
      let hasError = false;
      for (const log of logs) {
        const isError = log.toLowerCase().includes('error');
        if (isError) hasError = true;
        this.addLog(log, isError ? 'error' : 'info');
      }

      // Detect unexpected stop
      if (wasRunning && !this.stats.running) {
        emitSimulatorStopped({ reason: hasError ? 'error' : 'script-end' });
      }
    } catch (e) {
      console.error('Failed to poll stats:', e);
    }
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats = await invoke<SimulatorStats>('sim_get_stats');
      this.updateStatsDisplay();
      events.emit('simulator:stats', { stats: this.stats });
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }

  private async handleValidate(): Promise<void> {
    try {
      const result = await invoke<{ valid: boolean; errors: string[]; warnings: string[] }>(
        'sim_validate_script',
        { script: this.script }
      );

      if (result.valid) {
        this.addLog('Script validation passed', 'success');
        result.warnings.forEach(w => this.addLog(`Warning: ${w}`, 'info'));
      } else {
        result.errors.forEach(e => this.addLog(e, 'error'));
      }
    } catch (e) {
      this.addLog(`Validation failed: ${e}`, 'error');
    }
  }

  private async handleApplyScript(): Promise<void> {
    try {
      await invoke<void>('sim_load_script', { script: this.script });
      this.editor?.markApplied();
      this.addLog('Script loaded successfully', 'success');
    } catch (e) {
      this.addLog(`Failed to load script: ${e}`, 'error');
    }
  }
}

customElements.define('cv-traffic-simulator', TrafficSimulatorElement);
