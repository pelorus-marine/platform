/**
 * CAN Configuration Panel
 *
 * Two-column layout:
 * - Left: Interface list table
 * - Right: Detail panel or Create form
 */

import { invoke } from '../ipc';
import { events } from '../events';
import { PelorusPanelBase } from '../editors/pelorus-panel-base.js';
import {
  renderDetailRow,
  bindSelectToState,
  bindCheckboxToState,
  bindInputToState,
  showToast,
  createVisibilityAwareInterval,
} from '../editors/form-helpers.js';
import {
  FORM_STYLES,
  DETAIL_STYLES,
  EMPTY_STATE_STYLES,
  LOADING_STYLES,
  TOAST_STYLES,
  CONFIRM_DIALOG_STYLES,
  STATUS_STYLES,
  BADGE_STYLES,
  ACTION_BUTTON_STYLES,
  TAB_STYLES,
} from '../editors/styles.js';
import {
  type CanInterfaceInfo,
  type CanConfigOptions,
  type SerialPortInfo,
  type CanGateway,
  type CanFilter,
  CanInterfaceType,
  formatBitrate,
  getStatusText,
  isUp,
  getTypeLabel,
  FILTER_PRESETS,
} from './types.js';
import { pelorusWorkspace } from '../store';
import canConfigStyles from './can-config.css?inline';
import {
  type FormConfig,
  type CreateType,
  getDefaultFormConfig,
  renderVcanForm,
  renderPhysicalForm,
  renderSlcanForm,
  renderGatewayForm,
  renderCreateForm,
  renderConfirmDialog,
  renderConfirmGatewayDialog,
  renderSocketFilterSection,
} from './can-config-forms.js';
import type { CanBpfFilter } from './types.js';

export class CanConfigElement extends PelorusPanelBase {
  private interfaces: CanInterfaceInfo[] = [];
  private gateways: CanGateway[] = [];
  private selectedInterface: string | null = null;
  private selectedGateway: { src: string; dst: string } | null = null;
  private poller: { start: () => void; stop: () => void } | null = null;
  private showCreateForm = false;
  private createType: CreateType = 'vcan';
  private serialPorts: SerialPortInfo[] = [];
  private confirmDelete: string | null = null;
  private confirmDeleteGateway: { src: string; dst: string } | null = null;
  private formConfig: FormConfig = getDefaultFormConfig();
  private filtersCollapsed = true; // Start collapsed

  override connectedCallback(): void {
    super.connectedCallback();
    this.loadInterfaces();
    this.loadGateways();
    this.startPolling();
    events.on('can:create-new', this.handleCreateNew);
    events.on('can:refresh', this.handleRefresh);
  }

  disconnectedCallback(): void {
    this.stopPolling();
    events.off('can:create-new', this.handleCreateNew);
    events.off('can:refresh', this.handleRefresh);
  }

  private handleCreateNew = (): void => {
    this.showCreateForm = true;
    this.selectedInterface = null;
    this.selectedGateway = null;
    this.safeRender();
  };

  private handleRefresh = async (): Promise<void> => {
    await Promise.all([this.loadInterfaces(), this.loadGateways()]);
  };

  protected getStyles(): string {
    return `
      ${canConfigStyles}
      ${FORM_STYLES}
      ${DETAIL_STYLES}
      ${EMPTY_STATE_STYLES}
      ${LOADING_STYLES}
      ${TOAST_STYLES}
      ${CONFIRM_DIALOG_STYLES}
      ${STATUS_STYLES}
      ${BADGE_STYLES}
      ${ACTION_BUTTON_STYLES}
      ${TAB_STYLES}
    `;
  }

  protected renderContent(): string {
    return `
      <div class="can-panel">
        ${this.state.status === 'loading' ? '<div class="loading-overlay"><div class="spinner"></div></div>' : ''}
        <div class="interface-list">
          <div class="list-header">CAN Interfaces</div>
          <div class="list-content">
            ${this.renderInterfaceTable()}
          </div>
        </div>
        <div class="detail-panel">
          ${this.showCreateForm ? this.renderCreateFormPanel() : this.renderDetailPanel()}
        </div>
      </div>
      ${this.confirmDelete ? renderConfirmDialog(this.confirmDelete) : ''}
      ${this.confirmDeleteGateway ? renderConfirmGatewayDialog(this.confirmDeleteGateway.src, this.confirmDeleteGateway.dst) : ''}
    `;
  }

  protected override afterRender(): void {
    this.bindEvents();
  }

  private renderInterfaceTable(): string {
    if (this.interfaces.length === 0 && this.gateways.length === 0) {
      return `
        <div class="empty-state" style="padding: 40px;">
          <p>No CAN interfaces found</p>
          <p style="font-size: 0.8rem; margin-top: 8px;">Click "Create New" to add an interface</p>
        </div>
      `;
    }

    return `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Bitrate</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.interfaces.map(iface => `
            <tr class="${this.selectedInterface === iface.name ? 'selected' : ''}" data-interface="${iface.name}">
              <td><strong>${iface.name}</strong></td>
              <td><span class="type-badge ${iface.interface_type.toLowerCase()}">${getTypeLabel(iface.interface_type)}</span></td>
              <td>
                <div class="status-cell">
                  <div class="cv-status-dot ${isUp(iface.status) ? 'active' : ''}"></div>
                  ${getStatusText(iface.status)}
                </div>
              </td>
              <td>${formatBitrate(iface.bitrate)}${iface.is_fd_capable ? ' (FD)' : ''}</td>
              <td>
                <div class="actions">
                  ${iface.interface_type === CanInterfaceType.Vcan
                    ? `<button class="action-btn danger" data-action="delete" data-interface="${iface.name}">Delete</button>`
                    : ''
                  }
                  ${isUp(iface.status)
                    ? `<button class="action-btn" data-action="down" data-interface="${iface.name}">Down</button>`
                    : `<button class="action-btn" data-action="up" data-interface="${iface.name}">Up</button>`
                  }
                </div>
              </td>
            </tr>
          `).join('')}
          ${this.gateways.map(gw => {
            const isSelected = this.selectedGateway?.src === gw.src && this.selectedGateway?.dst === gw.dst;
            return `
            <tr class="${isSelected ? 'selected' : ''}" data-gateway-src="${gw.src}" data-gateway-dst="${gw.dst}">
              <td><strong>${gw.src} → ${gw.dst}</strong></td>
              <td><span class="type-badge gateway">Gateway</span></td>
              <td>
                <div class="status-cell">
                  <div class="cv-status-dot active"></div>
                  Active
                </div>
              </td>
              <td>-</td>
              <td>
                <div class="actions">
                  <button class="action-btn danger" data-action="delete-gateway" data-gateway-src="${gw.src}" data-gateway-dst="${gw.dst}">Delete</button>
                </div>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;
  }

  private renderDetailPanel(): string {
    if (this.selectedGateway) {
      return this.renderGatewayDetailPanel();
    }

    if (!this.selectedInterface) {
      return `
        <div class="panel-header">Details</div>
        <div class="panel-content">
          <div class="empty-state">
            <p>Select an interface or gateway to view details</p>
          </div>
        </div>
      `;
    }

    const iface = this.interfaces.find(i => i.name === this.selectedInterface);
    if (!iface) return '';

    // Get configured filters for this interface
    const filters = pelorusWorkspace.get().interfaceFilters[iface.name] || [];

    return `
      <div class="panel-header">
        <span>${iface.name}</span>
        <span class="type-badge ${iface.interface_type.toLowerCase()}">${getTypeLabel(iface.interface_type)}</span>
      </div>
      <div class="panel-content">
        <div class="detail-section">
          <div class="detail-section-title">Status</div>
          ${renderDetailRow('State', getStatusText(iface.status))}
          ${renderDetailRow('CAN State', iface.state)}
          ${renderDetailRow('Driver', iface.driver)}
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Configuration</div>
          ${renderDetailRow('Bitrate', formatBitrate(iface.bitrate))}
          ${renderDetailRow('CAN FD', `Yes${iface.data_bitrate ? ` (${formatBitrate(iface.data_bitrate)})` : ''}`, iface.is_fd_capable)}
          ${renderDetailRow('Sample Point', iface.sample_point ? `${(iface.sample_point * 100).toFixed(1)}%` : null)}
          ${renderDetailRow('SJW', iface.sjw)}
          ${renderDetailRow('Restart-ms', iface.restart_ms ? `${iface.restart_ms} ms` : null)}
          ${renderDetailRow('Listen-only', iface.is_listen_only ? 'Yes' : 'No')}
          ${renderDetailRow('Loopback', iface.is_loopback ? 'Yes' : 'No')}
        </div>

        ${renderSocketFilterSection(filters, iface.name, this.filtersCollapsed)}

        <div class="detail-actions">
          ${isUp(iface.status)
            ? `<button class="detail-btn secondary" data-action="down">Bring Down</button>`
            : `<button class="detail-btn primary" data-action="up">Bring Up</button>`
          }
          ${iface.interface_type === CanInterfaceType.Vcan ? `
            <button class="detail-btn danger" data-action="delete">Delete</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderGatewayDetailPanel(): string {
    const gw = this.selectedGateway!;
    const srcIface = this.interfaces.find(i => i.name === gw.src);
    const dstIface = this.interfaces.find(i => i.name === gw.dst);

    return `
      <div class="panel-header">
        <span>Gateway</span>
        <span class="type-badge gateway">Gateway</span>
      </div>
      <div class="panel-content">
        <div class="detail-section">
          <div class="detail-section-title">Configuration</div>
          ${renderDetailRow('Source', gw.src)}
          ${renderDetailRow('Destination', gw.dst)}
          ${renderDetailRow('Direction', 'Unidirectional')}
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Source Interface</div>
          ${srcIface ? `
            ${renderDetailRow('Type', getTypeLabel(srcIface.interface_type))}
            ${renderDetailRow('Status', getStatusText(srcIface.status))}
            ${renderDetailRow('Bitrate', formatBitrate(srcIface.bitrate))}
          ` : renderDetailRow('Status', 'Not found')}
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Destination Interface</div>
          ${dstIface ? `
            ${renderDetailRow('Type', getTypeLabel(dstIface.interface_type))}
            ${renderDetailRow('Status', getStatusText(dstIface.status))}
            ${renderDetailRow('Bitrate', formatBitrate(dstIface.bitrate))}
          ` : renderDetailRow('Status', 'Not found')}
        </div>

        <div class="detail-actions">
          <button class="detail-btn danger" data-action="delete-gateway">Delete Gateway</button>
        </div>
      </div>
    `;
  }

  /** Update gateway form defaults when interfaces change */
  private updateGatewayDefaults(): void {
    const upInterfaces = this.interfaces.filter(i => isUp(i.status));
    const ifaceNames = upInterfaces.map(i => i.name);

    if (!this.formConfig.gatewaySrc || !ifaceNames.includes(this.formConfig.gatewaySrc)) {
      this.formConfig.gatewaySrc = upInterfaces[0]?.name || '';
    }
    if (!this.formConfig.gatewayDst || !ifaceNames.includes(this.formConfig.gatewayDst)) {
      this.formConfig.gatewayDst = upInterfaces[1]?.name || upInterfaces[0]?.name || '';
    }
  }

  private renderCreateFormPanel(): string {
    // Update gateway defaults before rendering
    this.updateGatewayDefaults();

    let formContent: string;
    switch (this.createType) {
      case 'vcan':
        formContent = renderVcanForm(this.formConfig, this.interfaces);
        break;
      case 'physical':
        formContent = renderPhysicalForm(this.formConfig, this.interfaces);
        break;
      case 'slcan':
        formContent = renderSlcanForm(this.formConfig, this.serialPorts);
        break;
      case 'gateway':
        formContent = renderGatewayForm(this.formConfig, this.interfaces);
        break;
    }

    return renderCreateForm(this.createType, formContent);
  }

  private bindEvents(): void {
    // Interface row selection
    this.$$<HTMLTableRowElement>('tr[data-interface]').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.actions')) return;
        this.selectedInterface = row.dataset.interface || null;
        this.selectedGateway = null;
        this.showCreateForm = false;
        this.safeRender();
      });
    });

    // Gateway row selection
    this.$$<HTMLTableRowElement>('tr[data-gateway-src]').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.actions')) return;
        this.selectedGateway = {
          src: row.dataset.gatewaySrc || '',
          dst: row.dataset.gatewayDst || '',
        };
        this.selectedInterface = null;
        this.showCreateForm = false;
        this.safeRender();
      });
    });

    // Action buttons in table
    this.$$<HTMLButtonElement>('.action-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const { action, interface: iface, gatewaySrc, gatewayDst } = btn.dataset;
        if (action === 'delete-gateway' && gatewaySrc && gatewayDst) {
          this.confirmDeleteGateway = { src: gatewaySrc, dst: gatewayDst };
          this.safeRender();
          return;
        }
        if (action && iface) await this.handleAction(action, iface);
      });
    });

    // Detail panel action buttons
    this.$$<HTMLButtonElement>('.detail-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'delete-gateway' && this.selectedGateway) {
          this.confirmDeleteGateway = { ...this.selectedGateway };
          this.safeRender();
          return;
        }
        if (action && this.selectedInterface) await this.handleAction(action, this.selectedInterface);
      });
    });

    // Close/cancel form (both buttons do the same thing)
    const closeForm = () => {
      this.showCreateForm = false;
      this.safeRender();
    };
    this.$('#closeForm')?.addEventListener('click', closeForm);
    this.$('#cancelCreate')?.addEventListener('click', closeForm);

    // Form tabs
    this.$$<HTMLButtonElement>('.form-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        this.createType = tab.dataset.type as CreateType;
        if (this.createType === 'slcan') await this.loadSerialPorts();
        if (this.createType === 'physical') {
          const physical = this.interfaces.find(i => i.interface_type === CanInterfaceType.Physical);
          if (physical) this.formConfig.physicalInterface = physical.name;
        }
        this.safeRender();
      });
    });

    // Create button
    this.$('#createInterface')?.addEventListener('click', () => this.createInterface());

    // Form bindings using shared helpers
    bindSelectToState(this.shadow, 'vcanName', this.formConfig, 'vcanName');
    bindSelectToState(this.shadow, 'physicalInterface', this.formConfig, 'physicalInterface');
    bindSelectToState(this.shadow, 'bitrate', this.formConfig, 'bitrate', 'int');
    bindSelectToState(this.shadow, 'dataBitrate', this.formConfig, 'dataBitrate', 'int');
    bindSelectToState(this.shadow, 'dsamplePoint', this.formConfig, 'dsamplePoint', 'float');
    bindSelectToState(this.shadow, 'samplePoint', this.formConfig, 'samplePoint', 'float');
    bindSelectToState(this.shadow, 'sjw', this.formConfig, 'sjw', 'int');
    bindSelectToState(this.shadow, 'serialPort', this.formConfig, 'serialPort');
    bindSelectToState(this.shadow, 'slcanSpeed', this.formConfig, 'slcanSpeed', 'int');

    bindCheckboxToState(this.shadow, 'fdEnabled', this.formConfig, 'fdEnabled');
    bindCheckboxToState(this.shadow, 'listenOnly', this.formConfig, 'listenOnly');
    bindCheckboxToState(this.shadow, 'loopback', this.formConfig, 'loopback');
    bindCheckboxToState(this.shadow, 'tripleSampling', this.formConfig, 'tripleSampling');
    bindCheckboxToState(this.shadow, 'oneShot', this.formConfig, 'oneShot');
    bindCheckboxToState(this.shadow, 'berrReporting', this.formConfig, 'berrReporting');

    bindInputToState(this.shadow, 'restartMs', this.formConfig, 'restartMs', 'int');
    bindInputToState(this.shadow, 'slcanName', this.formConfig, 'slcanName', 'string', 'input');

    // FD toggle special handling
    this.$('#fdEnabled')?.addEventListener('change', () => {
      const group = this.$<HTMLElement>('#fdOptionsGroup');
      if (group) group.style.display = this.formConfig.fdEnabled ? '' : 'none';
    });

    // Confirm dialog buttons
    this.$('#confirmCancel')?.addEventListener('click', () => {
      this.confirmDelete = null;
      this.safeRender();
    });

    this.$('#confirmDelete')?.addEventListener('click', () => {
      if (this.confirmDelete) this.doDelete(this.confirmDelete);
    });

    // Gateway form bindings
    bindSelectToState(this.shadow, 'gatewaySrc', this.formConfig, 'gatewaySrc');
    bindSelectToState(this.shadow, 'gatewayDst', this.formConfig, 'gatewayDst');
    bindCheckboxToState(this.shadow, 'gatewayBidirectional', this.formConfig, 'gatewayBidirectional');
    bindCheckboxToState(this.shadow, 'gatewayFiltered', this.formConfig, 'gatewayFiltered');
    bindCheckboxToState(this.shadow, 'filterExtended', this.formConfig, 'filterExtended');
    bindInputToState(this.shadow, 'filterCanId', this.formConfig, 'filterCanId', 'string', 'input');
    bindInputToState(this.shadow, 'filterMask', this.formConfig, 'filterMask', 'string', 'input');

    // Filter toggle
    this.$('#gatewayFiltered')?.addEventListener('change', () => {
      const group = this.$<HTMLElement>('#filterOptionsGroup');
      if (group) group.style.display = this.formConfig.gatewayFiltered ? '' : 'none';
    });

    // Filter preset selector
    this.$('#filterPreset')?.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLSelectElement).value, 10);
      const preset = FILTER_PRESETS[idx];
      if (preset) {
        this.formConfig.filterCanId = preset.can_id.toString(16).toUpperCase();
        this.formConfig.filterMask = preset.mask.toString(16).toUpperCase();
        this.formConfig.filterExtended = preset.is_extended;
        this.safeRender();
      }
    });

    // Add filter button
    this.$('#addFilter')?.addEventListener('click', () => {
      const canId = parseInt(this.formConfig.filterCanId as string, 16);
      const mask = parseInt(this.formConfig.filterMask as string, 16);
      if (isNaN(canId)) {
        showToast(this.shadow, 'Invalid CAN ID (hex)', 'error', false);
        return;
      }
      const filter: CanFilter = {
        can_id: canId,
        mask: isNaN(mask) ? 0x7FF : mask,
        is_extended: this.formConfig.filterExtended as boolean,
      };
      (this.formConfig.gatewayFilters as CanFilter[]).push(filter);
      this.formConfig.filterCanId = '';
      this.safeRender();
    });

    // Remove filter buttons
    this.$$<HTMLButtonElement>('[data-remove-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeFilter || '0', 10);
        (this.formConfig.gatewayFilters as CanFilter[]).splice(idx, 1);
        this.safeRender();
      });
    });

    // Gateway confirm dialog
    this.$('#confirmGatewayCancel')?.addEventListener('click', () => {
      this.confirmDeleteGateway = null;
      this.safeRender();
    });

    this.$('#confirmGatewayDelete')?.addEventListener('click', () => {
      if (this.confirmDeleteGateway) {
        this.doDeleteGateway(this.confirmDeleteGateway.src, this.confirmDeleteGateway.dst);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Socket BPF Filter handlers
    // ─────────────────────────────────────────────────────────────────────────

    // Toggle filters section collapse
    this.$('#toggleSocketFilters')?.addEventListener('click', () => {
      this.filtersCollapsed = !this.filtersCollapsed;
      this.safeRender();
    });

    // Socket filter preset selector
    this.$('#socketFilterPreset')?.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLSelectElement).value, 10);
      if (isNaN(idx)) return;
      const preset = FILTER_PRESETS[idx];
      if (preset) {
        const canIdInput = this.$<HTMLInputElement>('#socketFilterCanId');
        const maskInput = this.$<HTMLInputElement>('#socketFilterMask');
        const extendedInput = this.$<HTMLInputElement>('#socketFilterExtended');
        if (canIdInput) canIdInput.value = preset.can_id.toString(16).toUpperCase();
        if (maskInput) maskInput.value = preset.mask.toString(16).toUpperCase();
        if (extendedInput) extendedInput.checked = preset.is_extended;
      }
    });

    // Add socket filter button
    this.$('#addSocketFilter')?.addEventListener('click', () => {
      const interfaceName = this.selectedInterface;
      if (!interfaceName) return;

      const canIdInput = this.$<HTMLInputElement>('#socketFilterCanId');
      const maskInput = this.$<HTMLInputElement>('#socketFilterMask');
      const extendedInput = this.$<HTMLInputElement>('#socketFilterExtended');
      const invertedInput = this.$<HTMLInputElement>('#socketFilterInverted');

      const canIdStr = canIdInput?.value.trim() || '';
      const maskStr = maskInput?.value.trim() || '7FF';

      const canId = parseInt(canIdStr, 16);
      if (isNaN(canId)) {
        showToast(this.shadow, 'Invalid CAN ID (hex)', 'error', false);
        return;
      }

      const mask = parseInt(maskStr, 16);
      const filter: CanBpfFilter = {
        can_id: canId,
        mask: isNaN(mask) ? 0x7FF : mask,
        is_extended: extendedInput?.checked || false,
        inverted: invertedInput?.checked || false,
      };

      // Add to pelorusWorkspace
      const currentFilters = pelorusWorkspace.get().interfaceFilters;
      const interfaceFilters = currentFilters[interfaceName] || [];
      pelorusWorkspace.set({
        interfaceFilters: {
          ...currentFilters,
          [interfaceName]: [...interfaceFilters, filter],
        },
      });

      // Clear input
      if (canIdInput) canIdInput.value = '';

      showToast(this.shadow, 'Filter added', 'success', false);
      this.safeRender();
    });

    // Remove socket filter buttons
    this.$$<HTMLButtonElement>('[data-remove-socket-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeSocketFilter || '0', 10);
        const interfaceName = btn.dataset.interface;
        if (!interfaceName) return;

        const currentFilters = pelorusWorkspace.get().interfaceFilters;
        const interfaceFilters = [...(currentFilters[interfaceName] || [])];
        interfaceFilters.splice(idx, 1);

        pelorusWorkspace.set({
          interfaceFilters: {
            ...currentFilters,
            [interfaceName]: interfaceFilters,
          },
        });

        this.safeRender();
      });
    });

    // Clear all socket filters button
    this.$('#clearSocketFilters')?.addEventListener('click', () => {
      const interfaceName = this.$<HTMLButtonElement>('#clearSocketFilters')?.dataset.interface;
      if (!interfaceName) return;

      const currentFilters = pelorusWorkspace.get().interfaceFilters;
      pelorusWorkspace.set({
        interfaceFilters: {
          ...currentFilters,
          [interfaceName]: [],
        },
      });

      showToast(this.shadow, 'Filters cleared', 'success', false);
      this.safeRender();
    });
  }

  private async handleAction(action: string, iface: string): Promise<void> {
    if (action === 'delete') {
      this.confirmDelete = iface;
      this.safeRender();
      return;
    }

    await this.withLoading(async () => {
      switch (action) {
        case 'up':
          await invoke<string>('can_interface_up', { interface: iface });
          showToast(this.shadow, `${iface} is up`, 'success', false);
          break;
        case 'down':
          await invoke<string>('can_interface_down', { interface: iface });
          showToast(this.shadow, `${iface} is down`, 'success', false);
          break;
      }
      await this.loadInterfacesQuiet();
    });
  }

  private async doDelete(iface: string): Promise<void> {
    this.confirmDelete = null;

    await this.withLoading(async () => {
      await invoke<string>('can_delete_vcan', { interface: iface });
      showToast(this.shadow, `${iface} deleted`, 'success', false);
      if (this.selectedInterface === iface) this.selectedInterface = null;
      await this.loadInterfacesQuiet();
    });
  }

  private async createInterface(): Promise<void> {
    await this.withLoading(async () => {
      switch (this.createType) {
        case 'vcan':
          await invoke<string>('can_create_vcan', { name: this.formConfig.vcanName });
          showToast(this.shadow, `${this.formConfig.vcanName} created`, 'success', false);
          break;
        case 'physical':
          await invoke<string>('can_configure_interface', {
            interface: this.formConfig.physicalInterface,
            config: {
              bitrate: this.formConfig.bitrate,
              sample_point: this.formConfig.samplePoint,
              sjw: this.formConfig.sjw,
              fd_enabled: this.formConfig.fdEnabled,
              data_bitrate: this.formConfig.fdEnabled ? this.formConfig.dataBitrate : null,
              dsample_point: this.formConfig.fdEnabled ? this.formConfig.dsamplePoint : null,
              loopback: this.formConfig.loopback,
              listen_only: this.formConfig.listenOnly,
              triple_sampling: this.formConfig.tripleSampling,
              one_shot: this.formConfig.oneShot,
              berr_reporting: this.formConfig.berrReporting,
              restart_ms: this.formConfig.restartMs > 0 ? this.formConfig.restartMs : null,
            } as CanConfigOptions,
          });
          showToast(this.shadow, `${this.formConfig.physicalInterface} configured`, 'success', false);
          break;
        case 'slcan':
          await invoke<string>('can_create_slcan', {
            serialPort: this.formConfig.serialPort,
            interfaceName: this.formConfig.slcanName,
            speed: this.formConfig.slcanSpeed,
          });
          showToast(this.shadow, `${this.formConfig.slcanName} created`, 'success', false);
          break;
        case 'gateway': {
          if (!this.formConfig.gatewaySrc || !this.formConfig.gatewayDst) {
            showToast(this.shadow, 'Select source and destination interfaces', 'error', false);
            throw new Error('Select source and destination interfaces');
          }
          if (this.formConfig.gatewaySrc === this.formConfig.gatewayDst) {
            showToast(this.shadow, 'Source and destination must be different', 'error', false);
            throw new Error('Source and destination must be different');
          }

          const filters = this.formConfig.gatewayFilters as CanFilter[];
          if (this.formConfig.gatewayFiltered && filters.length > 0) {
            // Use filtered gateway command
            await invoke<string>('can_create_filtered_gateway', {
              src: this.formConfig.gatewaySrc,
              dst: this.formConfig.gatewayDst,
              filters: filters,
              mode: 'Pass',
            });
            const filterCount = filters.length;
            showToast(this.shadow, `Filtered gateway created (${filterCount} filter${filterCount > 1 ? 's' : ''})`, 'success', false);
            // Reset filters after creation
            this.formConfig.gatewayFilters = [];
          } else {
            // Use regular gateway command
            await invoke<string>('can_create_gateway', {
              src: this.formConfig.gatewaySrc,
              dst: this.formConfig.gatewayDst,
              bidirectional: this.formConfig.gatewayBidirectional,
            });
            const arrow = this.formConfig.gatewayBidirectional ? '↔' : '→';
            showToast(this.shadow, `Gateway ${this.formConfig.gatewaySrc} ${arrow} ${this.formConfig.gatewayDst} created`, 'success', false);
          }
          await this.loadGateways();
          break;
        }
      }
      this.showCreateForm = false;
      await this.loadInterfacesQuiet();
    });
  }

  private async doDeleteGateway(src: string, dst: string): Promise<void> {
    this.confirmDeleteGateway = null;

    await this.withLoading(async () => {
      await invoke<string>('can_delete_gateway', { src, dst });
      showToast(this.shadow, `Gateway ${src} → ${dst} deleted`, 'success', false);
      if (this.selectedGateway?.src === src && this.selectedGateway?.dst === dst) {
        this.selectedGateway = null;
      }
      await this.loadGateways();
    });
  }

  private async loadInterfaces(): Promise<void> {
    try {
      this.interfaces = await invoke<CanInterfaceInfo[]>('can_list_interfaces');
      this.syncWorkspacePaths();
      this.safeRender();
      events.emit('can:interfaces-loaded', { count: this.interfaces.filter(i => isUp(i.status)).length });
    } catch (e) {
      console.error('Failed to load interfaces:', e);
    }
  }

  // Load without re-render (for polling) - only re-renders if data changed
  private async loadInterfacesQuiet(): Promise<void> {
    const newInterfaces = await invoke<CanInterfaceInfo[]>('can_list_interfaces');

    // Check if anything actually changed to avoid unnecessary re-renders
    const hasChanged = JSON.stringify(newInterfaces) !== JSON.stringify(this.interfaces);

    this.interfaces = newInterfaces;
    this.syncWorkspacePaths();
    events.emit('can:interfaces-loaded', { count: this.interfaces.filter(i => isUp(i.status)).length });

    // Only re-render if interfaces changed (preserves scroll when nothing changed)
    if (hasChanged) {
      this.safeRender();
    }
  }

  private syncWorkspacePaths(): void {
    pelorusWorkspace.set({
      canInterfaces: this.interfaces
        .filter(i => isUp(i.status))
        .map(i => ({ path: i.name, name: i.name })),
    });
  }

  private async loadSerialPorts(): Promise<void> {
    try {
      this.serialPorts = await invoke<SerialPortInfo[]>('can_list_serial_ports');
      if (this.serialPorts.length > 0 && !this.formConfig.serialPort) {
        this.formConfig.serialPort = this.serialPorts[0].path;
      }
    } catch (e) {
      console.error('Failed to load serial ports:', e);
    }
  }

  private async loadGateways(): Promise<void> {
    try {
      this.gateways = await invoke<CanGateway[]>('can_list_gateways');
      pelorusWorkspace.set({
        gateways: this.gateways.map(({ id, src, dst }) => ({ id, src, dst })),
      });
      events.emit('can:gateways-loaded', { count: this.gateways.length });
      this.safeRender();
    } catch (e) {
      console.error('Failed to load gateways:', e);
      this.gateways = [];
    }
  }

  private startPolling(): void {
    if (this.poller) return;
    // Use quiet loading during polling to avoid scroll reset
    this.poller = createVisibilityAwareInterval(() => this.loadInterfacesQuiet(), 3000);
    this.poller.start();
  }

  private stopPolling(): void {
    this.poller?.stop();
    this.poller = null;
  }
}

customElements.define('cv-can-config', CanConfigElement);
