/**
 * Storage Toolbar Component
 *
 * Provides import functionality for adding files to storage,
 * plus database-wide export/import operations.
 * Matches other toolbar layouts (cv-toolbar pattern).
 */

import type { StorageTab } from './types.js';
import { ARTIFACT_EXTENSIONS, ARTIFACT_LABELS } from './types.js';
import { invoke, dialogs } from '../ipc';
import { events, EMPTY_PAYLOAD } from '../events';
import { toast } from '../components/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export class StorageToolbarElement extends HTMLElement {
  private _currentTab: StorageTab = 'dbc';
  private _busy = false;

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    events.on('storage:tab-changed', this.handleTabChanged);
  }

  disconnectedCallback(): void {
    events.off('storage:tab-changed', this.handleTabChanged);
  }

  private handleTabChanged = (e: { tab: StorageTab }): void => {
    this._currentTab = e.tab;
  };

  private async handleImport(): Promise<void> {
    if (this._busy) return;

    const btn = this.querySelector('#importBtn') as HTMLButtonElement;

    try {
      this._busy = true;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Importing...';
      }

      const extensions = ARTIFACT_EXTENSIONS[this._currentTab];
      const path = await dialogs.open([{ name: ARTIFACT_LABELS[this._currentTab], extensions }]);

      if (path && typeof path === 'string') {
        const name = path.split('/').pop() || path.split('\\').pop() || 'unnamed';

        await invoke('storage_import', {
          path,
          name,
          artifactType: this._currentTab,
        });

        events.emit('storage:refresh', EMPTY_PAYLOAD);
        toast.success(`Imported ${name}`);
      }
    } catch (e) {
      console.error('Import failed:', e);
      toast.error(`Import failed: ${e}`);
    } finally {
      this._busy = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Import';
      }
    }
  }

  private async handleExportAll(): Promise<void> {
    if (this._busy) return;

    const btn = this.querySelector('#exportAllBtn') as HTMLButtonElement;

    try {
      this._busy = true;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Exporting...';
      }

      const path = await dialogs.save(
        [{ name: 'Storage Archive', extensions: ['zip'] }],
        'can-viewer-storage.zip'
      );

      if (path) {
        const count = await invoke<number>('storage_export_all', { path });
        toast.success(`Exported ${count} artifact${count !== 1 ? 's' : ''}`);
      }
    } catch (e) {
      console.error('Export failed:', e);
      toast.error(`Export failed: ${e}`);
    } finally {
      this._busy = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Export All';
      }
    }
  }

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'storageTab';
    this.innerHTML = `
      <button class="cv-btn primary" id="importBtn">Import</button>
      <span class="cv-toolbar-sep"></span>
      <button class="cv-btn" id="exportAllBtn">Export All</button>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#importBtn')?.addEventListener('click', () => {
      this.handleImport();
    });
    this.querySelector('#exportAllBtn')?.addEventListener('click', () => {
      this.handleExportAll();
    });
  }
}

customElements.define('cv-storage-toolbar', StorageToolbarElement);
