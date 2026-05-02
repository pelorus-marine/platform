/**
 * Form Utilities
 *
 * Reusable form rendering and binding helpers for web components.
 */

import { escapeHtml } from './html';

// ─────────────────────────────────────────────────────────────────────────────
// Generic Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Debounce a function call */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}

/** Check if document is visible (for pausing polling) */
export function isDocumentVisible(): boolean {
  return document.visibilityState === 'visible';
}

/** Create a visibility-aware interval that pauses when tab is hidden */
export function createVisibilityAwareInterval(
  callback: () => void,
  intervalMs: number
): { start: () => void; stop: () => void } {
  let intervalId: number | null = null;

  const start = () => {
    if (intervalId !== null) return;
    if (isDocumentVisible()) {
      callback(); // Run immediately when visible
    }
    intervalId = window.setInterval(() => {
      if (isDocumentVisible()) callback();
    }, intervalMs);
  };

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return { start, stop };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface LogEntry {
  text: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export interface TabDefinition {
  id: string;
  label: string;
  badge?: string | number;
}

export interface StatCardDefinition {
  id: string;
  label: string;
  sublabel?: string;
  value: string | number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form Rendering
// ─────────────────────────────────────────────────────────────────────────────

export function renderSelect(
  id: string,
  label: string,
  options: SelectOption[],
  selected: string | number,
  hint?: string
): string {
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <select class="form-select" id="${id}">
        ${options.map(o => `<option value="${o.value}" ${o.disabled ? 'disabled' : ''} ${o.value === selected ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
      ${hint ? `<div class="form-hint">${hint}</div>` : ''}
    </div>
  `;
}

export function renderCheckbox(id: string, label: string, checked: boolean): string {
  return `
    <div class="form-group">
      <label class="form-checkbox">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
        ${label}
      </label>
    </div>
  `;
}

export function renderDetailRow(
  label: string,
  value: string | number | null | undefined,
  condition = true
): string {
  if (!condition || value === null || value === undefined) return '';
  return `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value}</span>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form Binding Helpers
// ─────────────────────────────────────────────────────────────────────────────

type ParseType = 'string' | 'int' | 'float';

export function bindSelectToState<T extends Record<string, unknown>>(
  shadow: ShadowRoot,
  id: string,
  state: T,
  key: keyof T,
  parse: ParseType = 'string'
): void {
  shadow.querySelector(`#${id}`)?.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    (state as Record<string, unknown>)[key as string] =
      parse === 'int' ? parseInt(value) :
      parse === 'float' ? parseFloat(value) :
      value;
  });
}

export function bindCheckboxToState<T extends Record<string, unknown>>(
  shadow: ShadowRoot,
  id: string,
  state: T,
  key: keyof T
): void {
  shadow.querySelector(`#${id}`)?.addEventListener('change', (e) => {
    (state as Record<string, unknown>)[key as string] = (e.target as HTMLInputElement).checked;
  });
}

export function bindInputToState<T extends Record<string, unknown>>(
  shadow: ShadowRoot,
  id: string,
  state: T,
  key: keyof T,
  parse: ParseType = 'string',
  event: 'change' | 'input' = 'change'
): void {
  shadow.querySelector(`#${id}`)?.addEventListener(event, (e) => {
    const value = (e.target as HTMLInputElement).value;
    (state as Record<string, unknown>)[key as string] =
      parse === 'int' ? parseInt(value) :
      parse === 'float' ? parseFloat(value) :
      value;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Log Management
// ─────────────────────────────────────────────────────────────────────────────

export function renderLogContainer(logs: LogEntry[], containerId = 'logContainer'): string {
  if (logs.length === 0) {
    return `<div class="log-container" id="${containerId}"><div class="log-empty">No log entries</div></div>`;
  }
  return `
    <div class="log-container" id="${containerId}">
      ${logs.map(l => `<div class="log-entry ${l.type}">${escapeHtml(l.text)}</div>`).join('')}
    </div>
  `;
}

export function updateLogDisplay(shadow: ShadowRoot, logs: LogEntry[], containerId = 'logContainer'): void {
  const container = shadow.querySelector(`#${containerId}`);
  if (!container) return;
  if (logs.length > 0) {
    container.innerHTML = logs.map(l => `<div class="log-entry ${l.type}">${escapeHtml(l.text)}</div>`).join('');
  } else {
    container.innerHTML = '<div class="log-empty">No log entries</div>';
  }
}

export function createLogEntry(message: string, type: LogEntry['type'] = 'info'): LogEntry {
  const time = new Date().toLocaleTimeString();
  return { text: `[${time}] ${message}`, type };
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────────────────────────────────────

export function showToast(
  shadow: ShadowRoot,
  message: string,
  type: 'error' | 'success' | 'info' = 'info',
  dismissable = true
): void {
  // Remove existing toast
  shadow.querySelector('.toast-dismissable, .toast')?.remove();

  const toast = document.createElement('div');
  toast.className = dismissable ? `toast-dismissable ${type}` : `toast ${type}`;

  if (dismissable) {
    toast.innerHTML = `
      <span class="toast-text">${escapeHtml(message)}</span>
      <button class="toast-close" title="Dismiss">&times;</button>
    `;
    toast.querySelector('.toast-close')?.addEventListener('click', () => toast.remove());
  } else {
    toast.textContent = message;
    setTimeout(() => toast.remove(), 3000);
  }

  shadow.appendChild(toast);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Panel Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function renderPanelTabs(tabs: TabDefinition[], activeTab: string): string {
  return `
    <div class="panel-tabs">
      ${tabs.map(t => `
        <button class="panel-tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
          ${t.label}${t.badge !== undefined ? `<span class="panel-tab-badge">${t.badge}</span>` : ''}
        </button>
      `).join('')}
    </div>
  `;
}

export function bindTabSwitching(
  shadow: ShadowRoot,
  onSwitch: (tabId: string) => void
): void {
  shadow.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = (tab as HTMLElement).dataset.tab;
      if (tabId) onSwitch(tabId);
    });
  });
}

export function switchTab(shadow: ShadowRoot, tabId: string): void {
  // Update tab buttons
  shadow.querySelectorAll('.panel-tab').forEach(t =>
    t.classList.toggle('active', (t as HTMLElement).dataset.tab === tabId)
  );
  // Update panes
  shadow.querySelectorAll('.panel-pane').forEach(p =>
    p.classList.toggle('active', p.id === `${tabId}Pane`)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Indicator
// ─────────────────────────────────────────────────────────────────────────────

export function renderStatusIndicator(running: boolean, runningText = 'Running', stoppedText = 'Stopped'): string {
  return `
    <div class="sidebar-status">
      <div class="cv-status-dot ${running ? 'active pulse' : ''}"></div>
      <span>${running ? runningText : stoppedText}</span>
    </div>
  `;
}

export function updateStatusIndicator(
  shadow: ShadowRoot,
  running: boolean,
  runningText = 'Running',
  stoppedText = 'Stopped',
  selector = '.sidebar-status'
): void {
  const status = shadow.querySelector(selector);
  if (!status) return;
  const dot = status.querySelector('.cv-status-dot');
  const text = status.querySelector('span');
  if (dot) {
    dot.classList.toggle('active', running);
    dot.classList.toggle('pulse', running);
  }
  if (text) text.textContent = running ? runningText : stoppedText;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function renderStatCard(stat: StatCardDefinition): string {
  return `
    <div class="stat-card">
      <div class="stat-value" id="${stat.id}">${stat.value}</div>
      <div class="stat-label">${stat.label}</div>
      ${stat.sublabel ? `<div class="stat-sublabel">${stat.sublabel}</div>` : ''}
    </div>
  `;
}

export function renderStatsGrid(stats: StatCardDefinition[]): string {
  return `<div class="stats-grid">${stats.map(renderStatCard).join('')}</div>`;
}

export function updateStatValue(shadow: ShadowRoot, id: string, value: string | number): void {
  const el = shadow.querySelector(`#${id}`);
  if (el) el.textContent = String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function renderSidebarSelect(
  id: string,
  label: string,
  options: SelectOption[],
  selected: string | number,
  disabled = false
): string {
  return `
    <div class="sidebar-row">
      <label class="sidebar-label">${label}</label>
      <select class="sidebar-select" id="${id}" ${disabled ? 'disabled' : ''}>
        ${options.map(o => `<option value="${o.value}" ${o.disabled ? 'disabled' : ''} ${o.value === selected ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
    </div>
  `;
}

export function renderSidebarSection(title: string, content: string): string {
  return `
    <div class="sidebar-section">
      <div class="sidebar-title">${title}</div>
      ${content}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────

export function renderConfirmDialog(
  title: string,
  message: string,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmClass = 'form-btn danger'
): string {
  return `
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <div class="confirm-title">${title}</div>
        <div class="confirm-message">${message}</div>
        <div class="confirm-actions">
          <button class="form-btn secondary" data-action="cancel">${cancelLabel}</button>
          <button class="${confirmClass}" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    </div>
  `;
}
