/**
 * CAN Configuration Form Rendering
 *
 * Pure functions that render form HTML strings.
 */

import {
  renderSelect,
  renderCheckbox,
  type SelectOption,
} from '../editors/form-helpers.js';
import {
  type CanInterfaceInfo,
  type SerialPortInfo,
  type CanFilter,
  type CanBpfFilter,
  CanInterfaceType,
  BITRATES,
  DATA_BITRATES,
  SAMPLE_POINTS,
  SLCAN_SPEEDS,
  FILTER_PRESETS,
  isUp,
  formatFilterId,
  formatFilterMask,
} from './types.js';

/** Form configuration state */
export interface FormConfig {
  [key: string]: string | number | boolean | CanFilter[];  // Index signature for bindSelectToState/bindCheckboxToState
  vcanName: string;
  physicalInterface: string;
  bitrate: number;
  fdEnabled: boolean;
  dataBitrate: number;
  dsamplePoint: number;
  samplePoint: number;
  sjw: number;
  listenOnly: boolean;
  loopback: boolean;
  tripleSampling: boolean;
  oneShot: boolean;
  berrReporting: boolean;
  restartMs: number;
  serialPort: string;
  slcanName: string;
  slcanSpeed: number;
  gatewaySrc: string;
  gatewayDst: string;
  gatewayBidirectional: boolean;
  // Filter options
  gatewayFiltered: boolean;
  gatewayFilters: CanFilter[];
  filterCanId: string;  // Hex string for input
  filterMask: string;   // Hex string for input
  filterExtended: boolean;
}

export type CreateType = 'vcan' | 'physical' | 'slcan' | 'gateway';

/** Default form configuration */
export function getDefaultFormConfig(): FormConfig {
  return {
    vcanName: 'vcan0',
    physicalInterface: '',
    bitrate: 500000,
    fdEnabled: false,
    dataBitrate: 2000000,
    dsamplePoint: 0.75,
    samplePoint: 0.875,
    sjw: 1,
    listenOnly: false,
    loopback: false,
    tripleSampling: false,
    oneShot: false,
    berrReporting: false,
    restartMs: 100,
    serialPort: '',
    slcanName: 'slcan0',
    slcanSpeed: 6,
    gatewaySrc: '',
    gatewayDst: '',
    gatewayBidirectional: true,
    // Filter defaults
    gatewayFiltered: false,
    gatewayFilters: [],
    filterCanId: '',
    filterMask: '7FF',
    filterExtended: false,
  };
}

/** Render virtual CAN form */
export function renderVcanForm(formConfig: FormConfig, interfaces: CanInterfaceInfo[]): string {
  const vcanOptions: SelectOption[] = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const name = `vcan${i}`;
    const exists = interfaces.some(iface => iface.name === name);
    return { value: name, label: name + (exists ? ' (exists)' : ''), disabled: exists };
  });

  return `
    ${renderSelect('vcanName', 'Interface Name', vcanOptions, formConfig.vcanName, 'Virtual CAN interface for testing without hardware')}
    <div class="form-actions">
      <button class="form-btn secondary" id="cancelCreate">Cancel</button>
      <button class="form-btn success" id="createInterface">Create</button>
    </div>
  `;
}

/** Render physical CAN form */
export function renderPhysicalForm(formConfig: FormConfig, interfaces: CanInterfaceInfo[]): string {
  const physicalInterfaces = interfaces.filter(i => i.interface_type === CanInterfaceType.Physical);

  if (physicalInterfaces.length === 0) {
    return `
      <div class="empty-state" style="padding: 20px;">
        <p>No physical CAN interfaces detected</p>
        <p style="font-size: 0.8rem; margin-top: 8px;">Connect a CAN adapter and click Refresh</p>
      </div>
      <div class="form-actions">
        <button class="form-btn secondary" id="cancelCreate">Cancel</button>
      </div>
    `;
  }

  const ifaceOptions: SelectOption[] = physicalInterfaces.map(i => ({ value: i.name, label: i.name }));
  const sjwOptions: SelectOption[] = [1, 2, 3, 4].map(s => ({ value: s, label: String(s) }));

  return `
    ${renderSelect('physicalInterface', 'Interface', ifaceOptions, formConfig.physicalInterface)}
    ${renderSelect('bitrate', 'Bitrate', BITRATES, formConfig.bitrate)}
    ${renderCheckbox('fdEnabled', 'Enable CAN FD', formConfig.fdEnabled)}
    <div id="fdOptionsGroup" style="${formConfig.fdEnabled ? '' : 'display: none;'}">
      <div class="form-row">
        ${renderSelect('dataBitrate', 'Data Bitrate', DATA_BITRATES, formConfig.dataBitrate)}
        ${renderSelect('dsamplePoint', 'Data Sample Pt', SAMPLE_POINTS, formConfig.dsamplePoint)}
      </div>
    </div>
    <div class="form-row">
      ${renderSelect('samplePoint', 'Sample Point', SAMPLE_POINTS, formConfig.samplePoint)}
      ${renderSelect('sjw', 'SJW', sjwOptions, formConfig.sjw)}
    </div>
    <div class="form-group">
      <label class="form-label">Restart-ms</label>
      <input type="number" class="form-input" id="restartMs" value="${formConfig.restartMs}" min="0" max="10000">
      <div class="form-hint">Auto restart on bus-off (0 = disabled)</div>
    </div>
    <div class="form-row">
      ${renderCheckbox('listenOnly', 'Listen-only', formConfig.listenOnly)}
      ${renderCheckbox('loopback', 'Loopback', formConfig.loopback)}
    </div>
    <div class="form-row">
      ${renderCheckbox('tripleSampling', 'Triple sampling', formConfig.tripleSampling)}
      ${renderCheckbox('oneShot', 'One-shot', formConfig.oneShot)}
    </div>
    ${renderCheckbox('berrReporting', 'Bus error reporting', formConfig.berrReporting)}
    <div class="form-actions">
      <button class="form-btn secondary" id="cancelCreate">Cancel</button>
      <button class="form-btn success" id="createInterface">Apply</button>
    </div>
  `;
}

/** Render slcan/serial form */
export function renderSlcanForm(formConfig: FormConfig, serialPorts: SerialPortInfo[]): string {
  if (serialPorts.length === 0) {
    return `
      <div class="empty-state" style="padding: 20px;">
        <p>No serial ports detected</p>
        <p style="font-size: 0.8rem; margin-top: 8px;">Connect a USB-CAN adapter and click Refresh</p>
      </div>
      <div class="form-actions">
        <button class="form-btn secondary" id="cancelCreate">Cancel</button>
      </div>
    `;
  }

  const portOptions: SelectOption[] = serialPorts.map(p => ({
    value: p.path,
    label: p.path + (p.description ? ` - ${p.description}` : ''),
  }));
  const speedOptions: SelectOption[] = SLCAN_SPEEDS.map(s => ({ value: s.code, label: s.label }));

  return `
    ${renderSelect('serialPort', 'Serial Port', portOptions, formConfig.serialPort)}
    <div class="form-group">
      <label class="form-label">Interface Name</label>
      <input type="text" class="form-input" id="slcanName" value="${formConfig.slcanName}" placeholder="slcan0">
    </div>
    ${renderSelect('slcanSpeed', 'Bitrate', speedOptions, formConfig.slcanSpeed)}
    <div class="form-actions">
      <button class="form-btn secondary" id="cancelCreate">Cancel</button>
      <button class="form-btn success" id="createInterface">Create</button>
    </div>
  `;
}

/** Render gateway form */
export function renderGatewayForm(formConfig: FormConfig, interfaces: CanInterfaceInfo[]): string {
  const upInterfaces = interfaces.filter(i => isUp(i.status));

  if (upInterfaces.length < 2) {
    return `
      <div class="empty-state" style="padding: 20px;">
        <p>Need at least 2 active interfaces</p>
        <p style="font-size: 0.8rem; margin-top: 8px;">Create and bring up interfaces first</p>
      </div>
      <div class="form-actions">
        <button class="form-btn secondary" id="cancelCreate">Cancel</button>
      </div>
    `;
  }

  const ifaceOptions: SelectOption[] = upInterfaces.map(i => ({ value: i.name, label: i.name }));
  const presetOptions: SelectOption[] = FILTER_PRESETS.map((p, i) => ({ value: i, label: p.name }));

  return `
    ${renderSelect('gatewaySrc', 'Source', ifaceOptions, formConfig.gatewaySrc)}
    ${renderSelect('gatewayDst', 'Destination', ifaceOptions, formConfig.gatewayDst)}
    ${renderCheckbox('gatewayBidirectional', 'Bidirectional', formConfig.gatewayBidirectional)}
    <div class="form-hint" style="margin-top: -8px;">
      Forwards CAN frames between interfaces using cangw
    </div>

    <div class="form-divider"></div>
    ${renderCheckbox('gatewayFiltered', 'Enable ID filtering', formConfig.gatewayFiltered)}
    <div id="filterOptionsGroup" style="${formConfig.gatewayFiltered ? '' : 'display: none;'}">
      <div class="form-hint">Only forward frames matching these CAN IDs</div>
      ${renderSelect('filterPreset', 'Preset', presetOptions, 0)}
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">CAN ID (hex)</label>
          <input type="text" class="form-input mono" id="filterCanId" value="${formConfig.filterCanId}" placeholder="7DF">
        </div>
        <div class="form-group">
          <label class="form-label">Mask (hex)</label>
          <input type="text" class="form-input mono" id="filterMask" value="${formConfig.filterMask}" placeholder="7FF">
        </div>
      </div>
      ${renderCheckbox('filterExtended', 'Extended ID (29-bit)', formConfig.filterExtended)}
      <button class="form-btn secondary" id="addFilter" style="width: 100%; margin-top: 8px;">+ Add Filter</button>
      ${renderFilterList(formConfig.gatewayFilters)}
    </div>

    <div class="form-actions">
      <button class="form-btn secondary" id="cancelCreate">Cancel</button>
      <button class="form-btn success" id="createInterface">Create Gateway</button>
    </div>
  `;
}

/** Render the list of configured filters */
function renderFilterList(filters: CanFilter[]): string {
  if (filters.length === 0) {
    return '<div class="form-hint" style="text-align: center; padding: 8px;">No filters configured</div>';
  }

  return `
    <div class="filter-list" style="margin-top: 12px;">
      <div class="form-label">Active Filters</div>
      ${filters.map((f, i) => `
        <div class="filter-item" style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: var(--cv-bg-tertiary); border-radius: 4px; margin-top: 4px;">
          <span class="mono" style="flex: 1;">${formatFilterId(f)} / ${formatFilterMask(f)}</span>
          <span class="type-badge ${f.is_extended ? 'extended' : 'standard'}" style="font-size: 0.7rem;">${f.is_extended ? 'EXT' : 'STD'}</span>
          <button class="action-btn danger" data-remove-filter="${i}" style="padding: 2px 6px;">×</button>
        </div>
      `).join('')}
    </div>
  `;
}

/** Render the create form container with tabs */
export function renderCreateForm(createType: CreateType, formContent: string): string {
  return `
    <div class="panel-header">
      <span>${createType === 'gateway' ? 'Create Gateway' : 'Create Interface'}</span>
      <button class="action-btn" id="closeForm">Cancel</button>
    </div>
    <div class="panel-content">
      <div class="form-tabs">
        <button class="form-tab ${createType === 'vcan' ? 'active' : ''}" data-type="vcan">Virtual</button>
        <button class="form-tab ${createType === 'physical' ? 'active' : ''}" data-type="physical">Physical</button>
        <button class="form-tab ${createType === 'slcan' ? 'active' : ''}" data-type="slcan">Serial</button>
        <button class="form-tab ${createType === 'gateway' ? 'active' : ''}" data-type="gateway">Gateway</button>
      </div>
      ${formContent}
    </div>
  `;
}

/** Render confirm delete dialog */
export function renderConfirmDialog(interfaceName: string): string {
  return `
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <div class="confirm-title">Delete Interface</div>
        <div class="confirm-message">
          Are you sure you want to delete <strong>${interfaceName}</strong>?
        </div>
        <div class="confirm-actions">
          <button class="form-btn secondary" id="confirmCancel">Cancel</button>
          <button class="form-btn danger" id="confirmDelete">Delete</button>
        </div>
      </div>
    </div>
  `;
}

/** Render confirm gateway delete dialog */
export function renderConfirmGatewayDialog(src: string, dst: string): string {
  return `
    <div class="confirm-overlay">
      <div class="confirm-dialog">
        <div class="confirm-title">Delete Gateway</div>
        <div class="confirm-message">
          Remove gateway <strong>${src} → ${dst}</strong>?
        </div>
        <div class="confirm-actions">
          <button class="form-btn secondary" id="confirmGatewayCancel">Cancel</button>
          <button class="form-btn danger" id="confirmGatewayDelete">Delete</button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket BPF Filter Section (for interface detail panel)
// ─────────────────────────────────────────────────────────────────────────────

/** Format BPF filter for display */
export function formatBpfFilter(filter: CanBpfFilter): string {
  const idHex = filter.can_id.toString(16).toUpperCase();
  const padLen = filter.is_extended ? 8 : 3;
  const id = `0x${idHex.padStart(padLen, '0')}`;
  const mask = `0x${filter.mask.toString(16).toUpperCase().padStart(padLen, '0')}`;
  return `${id} / ${mask}`;
}

/** Render socket BPF filter configuration section */
export function renderSocketFilterSection(filters: CanBpfFilter[], interfaceName: string, collapsed: boolean = false): string {
  const presetOptions = FILTER_PRESETS.map((p, i) =>
    `<option value="${i}">${p.name}</option>`
  ).join('');

  const filterCount = filters.length;
  const badge = filterCount > 0 ? `<span class="type-badge success" style="font-size: 0.65rem; margin-left: 6px;">${filterCount}</span>` : '';

  return `
    <div class="detail-section">
      <div class="detail-section-title collapsible" id="toggleSocketFilters" style="cursor: pointer; user-select: none; display: flex; align-items: center;">
        <span style="margin-right: 6px; font-size: 0.7rem; opacity: 0.6;">${collapsed ? '▶' : '▼'}</span>
        <span>Capture Filters (BPF)</span>
        ${badge}
      </div>

      <div id="socketFiltersContent" style="${collapsed ? 'display: none;' : ''}">
        <div class="form-hint" style="margin-bottom: 8px;">
          Kernel-level filters applied when capturing from this interface
        </div>

        <div class="socket-filter-form" style="background: var(--cv-bg-tertiary); padding: 12px; border-radius: 6px;">
          <div class="form-group" style="margin-bottom: 8px;">
            <label class="form-label" style="font-size: 0.75rem;">Preset</label>
            <select class="form-select" id="socketFilterPreset" style="font-size: 0.8rem;">
              <option value="">Custom...</option>
              ${presetOptions}
            </select>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.75rem;">CAN ID (hex)</label>
              <input type="text" class="form-input mono" id="socketFilterCanId" placeholder="7DF" style="font-size: 0.8rem;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.75rem;">Mask (hex)</label>
              <input type="text" class="form-input mono" id="socketFilterMask" value="7FF" placeholder="7FF" style="font-size: 0.8rem;">
            </div>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; cursor: pointer;">
              <input type="checkbox" id="socketFilterExtended"> Extended (29-bit)
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; cursor: pointer;">
              <input type="checkbox" id="socketFilterInverted"> Inverted (block)
            </label>
          </div>
          <button class="form-btn secondary" id="addSocketFilter" data-interface="${interfaceName}" style="width: 100%; margin-top: 8px; font-size: 0.8rem;">
            + Add Filter
          </button>
        </div>

        ${renderSocketFilterList(filters, interfaceName)}
      </div>
    </div>
  `;
}

/** Render the list of configured socket filters */
function renderSocketFilterList(filters: CanBpfFilter[], interfaceName: string): string {
  if (filters.length === 0) {
    return `
      <div class="form-hint" style="text-align: center; padding: 12px; margin-top: 8px;">
        No filters configured - all frames will be captured
      </div>
    `;
  }

  return `
    <div class="socket-filter-list" style="margin-top: 12px;">
      ${filters.map((f, i) => `
        <div class="filter-item" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--cv-bg-tertiary); border-radius: 4px; margin-top: 4px;">
          <span class="mono" style="flex: 1; font-size: 0.8rem;">${formatBpfFilter(f)}</span>
          <span class="type-badge ${f.is_extended ? 'extended' : 'standard'}" style="font-size: 0.65rem;">${f.is_extended ? 'EXT' : 'STD'}</span>
          ${f.inverted ? '<span class="type-badge danger" style="font-size: 0.65rem;">BLOCK</span>' : '<span class="type-badge success" style="font-size: 0.65rem;">PASS</span>'}
          <button class="action-btn danger" data-remove-socket-filter="${i}" data-interface="${interfaceName}" style="padding: 2px 6px;">×</button>
        </div>
      `).join('')}
      <button class="form-btn danger" id="clearSocketFilters" data-interface="${interfaceName}" style="width: 100%; margin-top: 8px; font-size: 0.8rem;">
        Clear All Filters
      </button>
    </div>
  `;
}
