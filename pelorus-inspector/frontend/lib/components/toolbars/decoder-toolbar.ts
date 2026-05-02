/**
 * Decoder Toolbar Component
 *
 * Toolbar for Message Decoder tab with message ID selection.
 */

import { events, emitDecoderMessageSelected, type Mdf4ChangedEvent, type DbcChangedEvent } from '../../events.js';
import { appStore, type AppState } from '../../store.js';

export class DecoderToolbarElement extends HTMLElement {
  private unsubscribeStore: (() => void) | null = null;
  private availableIds: Array<{ id: number; extended: boolean; count: number; name?: string }> = [];
  private selectedId: number | null = null;
  private selectedExtended = false;

  connectedCallback(): void {
    this.render();
    this.bindEvents();

    // Subscribe to store changes
    this.unsubscribeStore = appStore.subscribe((state) => this.onStoreChange(state));

    // Subscribe to MDF4 and DBC changes
    events.on('mdf4:changed', this.handleMdf4Changed);
    events.on('dbc:changed', this.handleDbcChanged);

    // Initial load
    this.updateAvailableIds();
  }

  disconnectedCallback(): void {
    this.unsubscribeStore?.();
    events.off('mdf4:changed', this.handleMdf4Changed);
    events.off('dbc:changed', this.handleDbcChanged);
  }

  private handleMdf4Changed = (_e: Mdf4ChangedEvent) => {
    this.updateAvailableIds();
  };

  private handleDbcChanged = (_e: DbcChangedEvent) => {
    this.updateAvailableIds();
  };

  private onStoreChange(_state: AppState): void {
    // Could react to real-time frame updates if needed
  }

  private updateAvailableIds(): void {
    const frames = appStore.get().mdf4Frames;

    // Count frames per ID
    const idCounts = new Map<string, { id: number; extended: boolean; count: number }>();

    frames.forEach(f => {
      const key = `${f.can_id}-${f.is_extended}`;
      const existing = idCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        idCounts.set(key, { id: f.can_id, extended: f.is_extended, count: 1 });
      }
    });

    // Sort by count (most frequent first)
    this.availableIds = Array.from(idCounts.values())
      .sort((a, b) => b.count - a.count);

    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'decoderTab';

    const hasFrames = this.availableIds.length > 0;

    this.innerHTML = `
      <label>Message ID:</label>
      <select class="cv-select" id="messageSelect" ${!hasFrames ? 'disabled' : ''}>
        <option value="">Select message...</option>
        ${this.availableIds.map(m => {
          const idHex = m.id.toString(16).toUpperCase().padStart(m.extended ? 8 : 3, '0');
          const selected = m.id === this.selectedId && m.extended === this.selectedExtended;
          return `<option value="${m.id}-${m.extended}" ${selected ? 'selected' : ''}>
            0x${idHex} (${m.count} frames)
          </option>`;
        }).join('')}
      </select>
      <button class="cv-btn" id="analyzeBtn" ${!this.selectedId ? 'disabled' : ''}>Analyze</button>
      <button class="cv-btn" id="refreshBtn">↻</button>
      <span class="cv-status">
        <span id="statusText">${hasFrames ? `${this.availableIds.length} unique IDs` : 'No frames loaded'}</span>
      </span>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#messageSelect')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      if (value) {
        const [id, extended] = value.split('-');
        this.selectedId = parseInt(id);
        this.selectedExtended = extended === 'true';
        this.emitSelection();
      } else {
        this.selectedId = null;
      }
      this.render();
      this.bindEvents();
    });

    this.querySelector('#analyzeBtn')?.addEventListener('click', () => {
      if (this.selectedId !== null) {
        this.emitSelection();
      }
    });

    this.querySelector('#refreshBtn')?.addEventListener('click', () => {
      this.updateAvailableIds();
    });
  }

  private emitSelection(): void {
    if (this.selectedId === null) return;

    const frames = appStore.get().mdf4Frames.filter(
      f => f.can_id === this.selectedId && f.is_extended === this.selectedExtended
    );

    emitDecoderMessageSelected({
      messageId: this.selectedId,
      isExtended: this.selectedExtended,
      frames,
    });
  }
}

customElements.define('cv-decoder-toolbar', DecoderToolbarElement);
