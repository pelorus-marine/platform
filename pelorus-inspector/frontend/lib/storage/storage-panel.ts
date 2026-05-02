/**
 * Storage Panel Component
 *
 * Tabbed interface for managing stored artifacts.
 * Sub-tabs for DBC, MDF4, Rhai Scripts, and Workflows.
 */

import type { ArtifactMeta, ArtifactType, StorageTab } from './types.js';
import { ARTIFACT_LABELS } from './types.js';
import { invoke } from '../ipc.js';
import { artifactIndex } from '../store.js';
import { events } from '../events.js';
import './storage-file-list.js';

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const componentStyles = `
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--cv-bg);
  }

  .storage-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .storage-tabs {
    display: flex;
    border-bottom: 1px solid var(--cv-border);
    background: var(--cv-bg-alt);
    padding: 0 12px;
    gap: 4px;
  }

  .storage-tab {
    padding: 10px 16px;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--cv-text-muted);
    font-size: 0.85rem;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .storage-tab:hover {
    color: var(--cv-text);
  }

  .storage-tab.active {
    color: var(--cv-accent);
    border-bottom-color: var(--cv-accent);
  }

  .badge {
    font-size: 0.75rem;
    color: var(--cv-text-dim);
    margin-left: 6px;
    padding: 2px 6px;
    background: var(--cv-bg);
    border-radius: 3px;
  }

  .storage-tab.active .badge {
    background: rgba(59, 130, 246, 0.2);
    color: var(--cv-accent);
  }

  .storage-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export class StoragePanelElement extends HTMLElement {
  private shadow: ShadowRoot;
  private activeTab: StorageTab = 'dbc';
  private artifacts: Record<ArtifactType, ArtifactMeta[]> = {
    dbc: [],
    mdf4: [],
    rhai: [],
    workflow: [],
  };

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  async connectedCallback(): Promise<void> {
    this.render();
    await this.loadAllArtifacts();
    this.setupEventListeners();
  }

  disconnectedCallback(): void {
    events.off('storage:refresh', this.handleRefresh);
  }

  private handleRefresh = (): void => {
    this.loadAllArtifacts();
  };

  private async loadAllArtifacts(): Promise<void> {
    const types: ArtifactType[] = ['dbc', 'mdf4', 'rhai', 'workflow'];
    await Promise.all(types.map((type) => this.loadArtifacts(type)));
    this.updateStore();
    this.render();
  }

  private async loadArtifacts(type: ArtifactType): Promise<void> {
    try {
      this.artifacts[type] = await invoke<ArtifactMeta[]>('storage_list', {
        artifactType: type,
      });
    } catch (e) {
      console.error(`Failed to load ${type} artifacts:`, e);
      this.artifacts[type] = [];
    }
  }

  private updateStore(): void {
    artifactIndex.set({
      dbcArtifacts: this.artifacts.dbc,
      mdf4Artifacts: this.artifacts.mdf4,
      rhaiArtifacts: this.artifacts.rhai,
      workflowArtifacts: this.artifacts.workflow,
    });
  }

  private setupEventListeners(): void {
    events.on('storage:refresh', this.handleRefresh);
  }

  private switchTab(tab: StorageTab): void {
    this.activeTab = tab;
    events.emit('storage:tab-changed', { tab });
    this.render();
  }

  private render(): void {
    const tabs = (['dbc', 'mdf4', 'rhai', 'workflow'] as StorageTab[])
      .map(
        (tab) => `
      <button class="storage-tab ${this.activeTab === tab ? 'active' : ''}" data-tab="${tab}">
        ${ARTIFACT_LABELS[tab]}
        <span class="badge">${this.artifacts[tab].length}</span>
      </button>
    `
      )
      .join('');

    this.shadow.innerHTML = `
      <style>${componentStyles}</style>
      <div class="storage-container">
        <div class="storage-tabs">${tabs}</div>
        <div class="storage-content">
          <cv-storage-file-list id="file-list"></cv-storage-file-list>
        </div>
      </div>
    `;

    // Update file list with current artifacts
    const fileList = this.shadow.getElementById(
      'file-list'
    ) as HTMLElement & { setArtifacts: (type: ArtifactType, artifacts: ArtifactMeta[]) => void };
    if (fileList && fileList.setArtifacts) {
      fileList.setArtifacts(this.activeTab, this.artifacts[this.activeTab]);
    }

    // Tab click handlers
    this.shadow.querySelectorAll('.storage-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.getAttribute('data-tab') as StorageTab);
      });
    });
  }
}

customElements.define('cv-storage-panel', StoragePanelElement);
