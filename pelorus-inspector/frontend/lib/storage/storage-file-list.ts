/**
 * Storage File List Component
 *
 * Displays and manages a list of stored artifacts.
 * Supports export and delete actions.
 */

import type { ArtifactMeta, ArtifactType } from './types.js';
import { ARTIFACT_EXTENSIONS, ARTIFACT_LABELS } from './types.js';
import { invoke, dialogs } from '../ipc';
import { events, EMPTY_PAYLOAD } from '../events';

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const componentStyles = `
  :host {
    display: block;
    padding: 16px;
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: var(--cv-bg-alt);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius, 6px);
    gap: 12px;
    transition: border-color 0.15s ease;
  }

  .file-item:hover {
    border-color: var(--cv-accent);
  }

  .file-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cv-bg);
    border-radius: 6px;
    color: var(--cv-accent);
  }

  .file-icon svg {
    width: 18px;
    height: 18px;
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
  }

  .file-meta {
    font-size: 0.75rem;
    color: var(--cv-text-muted);
  }

  .file-actions {
    display: flex;
    gap: 6px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--cv-border);
    border-radius: 6px;
    background: var(--cv-bg);
    color: var(--cv-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-icon:hover {
    border-color: var(--cv-accent);
    color: var(--cv-accent);
  }

  .btn-icon.btn-danger:hover {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .btn-icon svg {
    width: 14px;
    height: 14px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--cv-text-muted);
  }

  .empty-state-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    color: var(--cv-border);
  }

  .empty-state-title {
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--cv-text);
  }

  .empty-state-text {
    font-size: 0.85rem;
  }
`;

// SVG Icons
const ICONS = {
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export class StorageFileListElement extends HTMLElement {
  private shadow: ShadowRoot;
  private _type: ArtifactType = 'dbc';
  private _artifacts: ArtifactMeta[] = [];

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  /** Set artifacts to display */
  setArtifacts(type: ArtifactType, artifacts: ArtifactMeta[]): void {
    this._type = type;
    this._artifacts = artifacts;
    this.render();
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private async handleExport(artifact: ArtifactMeta): Promise<void> {
    try {
      const extensions = ARTIFACT_EXTENSIONS[artifact.type];
      const path = await dialogs.save(
        [{ name: ARTIFACT_LABELS[artifact.type], extensions }],
        artifact.name
      );

      if (path) {
        await invoke('storage_export', {
          name: artifact.name,
          artifactType: artifact.type,
          path,
        });
      }
    } catch (e) {
      console.error('Export failed:', e);
      alert(`Export failed: ${e}`);
    }
  }

  private async handleDelete(artifact: ArtifactMeta): Promise<void> {
    if (!confirm(`Delete "${artifact.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await invoke('storage_delete', {
        name: artifact.name,
        artifactType: artifact.type,
      });
      events.emit('storage:refresh', EMPTY_PAYLOAD);
    } catch (e) {
      console.error('Delete failed:', e);
      alert(`Delete failed: ${e}`);
    }
  }

  private render(): void {
    if (this._artifacts.length === 0) {
      this.shadow.innerHTML = `
        <style>${componentStyles}</style>
        <div class="empty-state">
          <div class="empty-state-icon">${ICONS.folder}</div>
          <div class="empty-state-title">No ${ARTIFACT_LABELS[this._type]}</div>
          <div class="empty-state-text">Use the Import button in the toolbar to add files.</div>
        </div>
      `;
      return;
    }

    const items = this._artifacts
      .map(
        (a) => `
      <div class="file-item" data-name="${a.name}">
        <div class="file-icon">${ICONS.file}</div>
        <div class="file-info">
          <div class="file-name">${a.name}</div>
          <div class="file-meta">${this.formatSize(a.size)} &bull; ${this.formatDate(a.updatedAt)}</div>
        </div>
        <div class="file-actions">
          <button class="btn-icon" data-action="export" title="Export to file">
            ${ICONS.download}
          </button>
          <button class="btn-icon btn-danger" data-action="delete" title="Delete">
            ${ICONS.trash}
          </button>
        </div>
      </div>
    `
      )
      .join('');

    this.shadow.innerHTML = `
      <style>${componentStyles}</style>
      <div class="file-list">${items}</div>
    `;

    // Event handlers
    this.shadow.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        const name = (e.currentTarget as HTMLElement)
          .closest('.file-item')
          ?.getAttribute('data-name');
        const artifact = this._artifacts.find((a) => a.name === name);
        if (!artifact) return;

        if (action === 'export') this.handleExport(artifact);
        if (action === 'delete') this.handleDelete(artifact);
      });
    });
  }
}

customElements.define('cv-storage-file-list', StorageFileListElement);
