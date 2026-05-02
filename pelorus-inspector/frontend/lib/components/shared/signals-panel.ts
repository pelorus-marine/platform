import type { CanFrame, DecodedSignal } from '../../types';
import { formatSignalValue } from '../../utils';
import { escapeHtml } from '../../utils/html';
import { events, type FrameSelectedEvent, type DbcChangedEvent, type VssChangedEvent } from '../../events';

/** API interface for signals panel (fallback decoding) */
export interface SignalsPanelApi {
  decodeFrames(frames: CanFrame[]): Promise<{ signals: DecodedSignal[]; errors: string[] }>;
}

/** Signals panel component - listens to frame:selected events */
export class SignalsPanelElement extends HTMLElement {
  private signals: DecodedSignal[] = [];
  private errors: string[] = [];
  private api: SignalsPanelApi | null = null;
  private currentFrame: CanFrame | null = null;

  private handleFrameSelected = (event: FrameSelectedEvent) => this.onFrameSelected(event);
  private handleDbcChanged = (event: DbcChangedEvent) => this.onDbcChanged(event);
  private handleVssChanged = (_event: VssChangedEvent) => this.onVssChanged();

  constructor() {
    super();
  }

  connectedCallback(): void {
    events.on('frame:selected', this.handleFrameSelected);
    events.on('dbc:changed', this.handleDbcChanged);
    events.on('vss:changed', this.handleVssChanged);
  }

  disconnectedCallback(): void {
    events.off('frame:selected', this.handleFrameSelected);
    events.off('dbc:changed', this.handleDbcChanged);
    events.off('vss:changed', this.handleVssChanged);
  }

  /** Set the API for fallback decoding (when DBC loaded after MDF4) */
  setApi(api: SignalsPanelApi): void {
    this.api = api;
  }

  /** Handle frame selected event */
  private async onFrameSelected(event: FrameSelectedEvent): Promise<void> {
    this.currentFrame = event.frame;

    // Use signals from event if available (pre-decoded by Rust)
    if (event.signals.length > 0) {
      this.setSignals(event.signals, []);
      return;
    }

    // Fallback: decode via API (for when DBC loaded after MDF4)
    await this.decodeCurrentFrame();
  }

  /** Handle DBC changed - re-decode current frame if selected */
  private async onDbcChanged(event: DbcChangedEvent): Promise<void> {
    if (event.action === 'cleared') {
      if (this.currentFrame) {
        this.setSignals([], []);
      }
      return;
    }
    // DBC loaded/updated - re-decode current frame via API
    if (this.currentFrame) {
      await this.decodeCurrentFrame();
    }
  }

  private async onVssChanged(): Promise<void> {
    if (this.currentFrame) {
      await this.decodeCurrentFrame();
    }
  }

  /** Decode the currently selected frame via API */
  private async decodeCurrentFrame(): Promise<void> {
    const frame = this.currentFrame;
    if (!frame || !this.api) {
      this.setSignals([], []);
      return;
    }

    try {
      const response = await this.api.decodeFrames([frame]);
      // Only update if this is still the selected frame
      if (this.currentFrame === frame) {
        this.setSignals(response.signals, response.errors);
      }
    } catch (err) {
      console.error('Failed to decode frame:', err);
      if (this.currentFrame === frame) {
        this.setSignals([], []);
      }
    }
  }

  /** Update signals and re-render (can still be called directly if needed) */
  setSignals(signals: DecodedSignal[], errors: string[] = []): void {
    this.signals = signals;
    this.errors = errors;
    this.render();
  }

  /** Show empty state */
  showEmpty(): void {
    this.signals = [];
    this.errors = [];
    const tbody = this.querySelector('tbody');
    const count = this.querySelector('#signalsCount');
    const errorContainer = this.querySelector('.cv-decode-error');

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="cv-signals-empty">Select a frame to view decoded signals</td></tr>';
    }
    if (count) {
      count.textContent = 'Select a frame';
    }
    if (errorContainer) {
      errorContainer.textContent = '';
      errorContainer.classList.add('hidden');
    }
  }

  /** Clear current selection */
  clear(): void {
    this.currentFrame = null;
    this.showEmpty();
  }

  private render(): void {
    const tbody = this.querySelector('tbody');
    const count = this.querySelector('#signalsCount');
    const errorContainer = this.querySelector('.cv-decode-error');

    if (tbody) {
      if (this.signals.length === 0 && this.errors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="cv-signals-empty">No signals decoded</td></tr>';
      } else {
        tbody.innerHTML = this.signals.map(sig => {
          // If there's a value description, show it prominently with numeric value secondary
          const valueDisplay = sig.description
            ? `<span class="cv-value-desc">${escapeHtml(sig.description)}</span> <span class="cv-value-num">(${formatSignalValue(sig.value)})</span>`
            : formatSignalValue(sig.value);
          const vessel = sig.vessel_path
            ? `<span class="cv-vessel-path" title="Pelorus VSS">${escapeHtml(sig.vessel_path)}</span>`
            : '<span class="cv-muted">—</span>';
          return `
            <tr>
              <td class="cv-signal-name">${escapeHtml(sig.signal_name)}</td>
              <td class="cv-physical-value">${valueDisplay}</td>
              <td class="cv-unit-highlight">${sig.unit || '-'}</td>
              <td class="cv-vessel-cell">${vessel}</td>
            </tr>
          `;
        }).join('');
      }
    }

    if (count) {
      count.textContent = `${this.signals.length} signals`;
    }

    // Show decode errors if any
    if (errorContainer) {
      if (this.errors.length > 0) {
        errorContainer.textContent = this.errors.join('; ');
        errorContainer.classList.remove('hidden');
      } else {
        errorContainer.textContent = '';
        errorContainer.classList.add('hidden');
      }
    }
  }
}

customElements.define('cv-signals-panel', SignalsPanelElement);
