/**
 * Pelorus VSS (.vspec) catalog editor — tree browse, leaf table, YAML edit, semantic correlation with DBC decode.
 */

import type { FileFilter, VssCatalogDto, VssLeafDto, VssNodeDto, VssSnapshotDto } from '../../types';
import { escapeHtml } from '../../utils/html';
import { emitVssChanged, emitVssStateChange, events, type VssChangedEvent } from '../../events';
import { appStore } from '../../store';
import { createEvent, extractFilename } from '../../utils';
import styles from '../../../styles/pelorus-inspector.css?inline';

const EMPTY_VSS_TEMPLATE =
  'Vessel:\n  type: branch\n  description: Pelorus vessel signal catalog root (edit me).\n';

export interface VssEditorApi {
  loadVss(path: string): Promise<VssSnapshotDto>;
  saveVssContent(path: string, content: string): Promise<void>;
  clearVss(emitChanged?: boolean): Promise<void>;
  updateVssContent(content: string): Promise<string>;
  updateVssCatalog(dto: VssCatalogDto): Promise<VssSnapshotDto>;
  serializeVssCatalog(dto: VssCatalogDto): Promise<string>;
  getVssSnapshot(): Promise<VssSnapshotDto | null>;
  getVssPath(): Promise<string | null>;
  openFileDialog(): Promise<string | null>;
  saveFileDialog(filters: FileFilter[], defaultName?: string): Promise<string | null>;
}

function cloneDto(roots: VssNodeDto[]): VssNodeDto[] {
  return JSON.parse(JSON.stringify(roots)) as VssNodeDto[];
}

function findNode(roots: VssNodeDto[], path: string): VssNodeDto | null {
  for (const r of roots) {
    const hit = walk(r, path);
    if (hit) return hit;
  }
  return null;
}

function walk(n: VssNodeDto, path: string): VssNodeDto | null {
  if (n.path === path) return n;
  for (const c of n.children) {
    const hit = walk(c, path);
    if (hit) return hit;
  }
  return null;
}

function renderTreeHtml(roots: VssNodeDto[], selected: string | null, depth = 0): string {
  const pad = depth * 12;
  return roots
    .map(
      r => `
      <li style="margin-left:${pad}px">
        <button type="button" class="cv-btn link vss-tree-node" data-path="${escapeHtml(r.path)}"
          ${selected === r.path ? ' data-selected="1"' : ''}>${escapeHtml(r.segment)}</button>
        ${
          r.children.length
            ? `<ul class="vss-tree-list">${renderTreeHtml(r.children, selected, depth + 1)}</ul>`
            : ''
        }
      </li>`,
    )
    .join('');
}

export class VssEditorElement extends HTMLElement {
  private api: VssEditorApi | null = null;
  private snapshot: VssSnapshotDto | null = null;
  private yamlDraft = '';
  private currentFile: string | null = null;
  private isDirty = false;
  private selectedPath: string | null = null;
  private activeTab: 'tree' | 'leaves' | 'yaml' = 'tree';
  private filterLeaves = '';
  private boundVssChanged = (e: VssChangedEvent) => this.onVssBusChanged(e);

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    events.on('vss:changed', this.boundVssChanged);
    this.render();
  }

  disconnectedCallback(): void {
    events.off('vss:changed', this.boundVssChanged);
  }

  /** Backend / mitt: full UI reset when catalog is cleared (no reload). */
  private onVssBusChanged(e: VssChangedEvent): void {
    if (e.action !== 'cleared') return;
    appStore.set({ vssFile: null });
    this.filterLeaves = '';
    this.selectedPath = null;
    this.activeTab = 'tree';
    this.applySnapshot(null, null);
  }

  setApi(api: VssEditorApi): void {
    this.api = api;
  }

  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  getIsDirty(): boolean {
    return this.isDirty;
  }

  private emitState(): void {
    const leafCount = this.snapshot?.leaf_count ?? 0;
    emitVssStateChange({
      isDirty: this.isDirty,
      isEditing: true,
      currentFile: this.currentFile,
      leafCount,
      branchCount: this.snapshot?.branch_count ?? 0,
    });
  }

  private applySnapshot(snap: VssSnapshotDto | null, filename: string | null, retainDirty = false): void {
    this.snapshot = snap;
    this.currentFile = filename;
    if (!retainDirty) {
      this.isDirty = false;
      this.selectedPath = null;
    }
    if (this.api && snap) {
      void this.api
        .serializeVssCatalog({ roots: cloneDto(snap.roots) })
        .then(y => {
          this.yamlDraft = y;
          this.render();
        })
        .catch(() => this.render());
    } else {
      this.yamlDraft = '';
      this.render();
    }
    this.emitState();
  }

  async loadFile(path: string): Promise<void> {
    if (!this.api) return;
    const snap = await this.api.loadVss(path);
    appStore.set({ vssFile: path });
    emitVssChanged({ action: 'loaded', snapshot: snap, filename: extractFilename(path) });
    this.applySnapshot(snap, path);
  }

  async handleClearCatalog(): Promise<void> {
    if (!this.api) return;
    try {
      await this.api.clearVss(true);
    } catch (err) {
      this.toast(`Clear catalog failed: ${err}`, 'error');
    }
  }

  async handleNew(): Promise<void> {
    if (!this.api) return;
    await this.api.clearVss(false);
    await this.api.updateVssContent(EMPTY_VSS_TEMPLATE);
    const snap = await this.api.getVssSnapshot();
    appStore.set({ vssFile: null });
    emitVssChanged({ action: 'new', snapshot: snap, filename: null });
    this.applySnapshot(snap, null);
  }

  async handleOpen(): Promise<void> {
    if (!this.api) return;
    const path = await this.api.openFileDialog();
    if (path) await this.loadFile(path);
  }

  async handleSave(): Promise<void> {
    if (!this.api || !this.currentFile) return;
    try {
      const content =
        this.activeTab === 'yaml' ? this.readYamlFromDom() : await this.serializeRoots();
      await this.api.saveVssContent(this.currentFile, content);
      const snap = await this.api.getVssSnapshot();
      appStore.set({ vssFile: this.currentFile });
      emitVssChanged({
        action: 'updated',
        snapshot: snap,
        filename: extractFilename(this.currentFile),
      });
      this.applySnapshot(snap, this.currentFile);
    } catch (e) {
      this.toast(`Save failed: ${e}`, 'error');
    }
  }

  async handleSaveAs(): Promise<void> {
    if (!this.api) return;
    const path = await this.api.saveFileDialog(
      [{ name: 'VSS / VSPEC', extensions: ['vspec', 'yaml', 'yml'] }],
      'catalog.vspec',
    );
    if (!path) return;
    try {
      const content =
        this.activeTab === 'yaml' ? this.readYamlFromDom() : await this.serializeRoots();
      await this.api.saveVssContent(path, content);
      const snap = await this.api.getVssSnapshot();
      this.currentFile = path;
      appStore.set({ vssFile: path });
      emitVssChanged({ action: 'updated', snapshot: snap, filename: extractFilename(path) });
      this.applySnapshot(snap, path);
    } catch (e) {
      this.toast(`Save failed: ${e}`, 'error');
    }
  }

  private readYamlFromDom(): string {
    const ta = this.shadowRoot?.querySelector('#vssYamlTa') as HTMLTextAreaElement | null;
    return ta?.value ?? this.yamlDraft;
  }

  private async serializeRoots(): Promise<string> {
    if (!this.api || !this.snapshot) return '';
    return this.api.serializeVssCatalog({ roots: cloneDto(this.snapshot.roots) });
  }

  private toast(msg: string, kind: 'success' | 'error'): void {
    this.dispatchEvent(createEvent('toast', { message: msg, kind }));
  }

  private render(): void {
    const snap = this.snapshot;
    const leaves = snap?.leaves ?? [];
    const f = this.filterLeaves.trim().toLowerCase();
    const filtered: VssLeafDto[] = f
      ? leaves.filter(
          l =>
            l.path.toLowerCase().includes(f) ||
            (l.description && l.description.toLowerCase().includes(f)),
        )
      : leaves;

    const treeInner = snap?.roots.length
      ? `<ul class="vss-tree-list root">${renderTreeHtml(snap.roots, this.selectedPath)}</ul>`
      : '<p class="cv-hint">No catalog loaded. Open a <code>.vspec</code>, start from New, or clear with toolbar <strong>Clear</strong>.</p>';

    const selected = this.selectedPath && snap ? findNode(snap.roots, this.selectedPath) : null;
    const meta = selected?.meta ?? {};

    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <style>
        .vss-wrap { display:flex; flex-direction:column; gap:0.75rem; height:100%; min-height:280px; }
        .vss-tabs { display:flex; gap:4px; flex-wrap:wrap; align-items:center; }
        .vss-panes { flex:1; min-height:0; overflow:auto; border:1px solid var(--cv-border,#333); border-radius:6px; padding:8px; }
        .vss-split { display:grid; grid-template-columns: minmax(200px,1fr) minmax(280px,1.2fr); gap:12px; }
        @media (max-width: 900px) { .vss-split { grid-template-columns: 1fr; } }
        .vss-tree-list { list-style:none; margin:0; padding:0; }
        .vss-tree-node { font-family:var(--cv-mono,monospace); font-size:13px; }
        textarea.vss-yaml { width:100%; min-height:320px; font-family:var(--cv-mono,monospace); font-size:12px; }
        .cv-btn.link { background:transparent; border:none; color:var(--cv-link,#6ae); cursor:pointer; text-align:left; padding:2px 4px; }
        .cv-btn.link[data-selected="1"] { font-weight:600; text-decoration:underline; }
        .mono { font-family:var(--cv-mono,monospace); font-size:12px; }
      </style>
      <div class="vss-wrap">
        <div class="vss-tabs">
          <button type="button" class="cv-btn ${this.activeTab === 'tree' ? 'primary' : ''}" data-tab="tree" title="Browse signal tree and edit node metadata">Browse</button>
          <button type="button" class="cv-btn ${this.activeTab === 'leaves' ? 'primary' : ''}" data-tab="leaves" title="Flat list of leaf signals">Leaves (${leaves.length})</button>
          <button type="button" class="cv-btn ${this.activeTab === 'yaml' ? 'primary' : ''}" data-tab="yaml" title="Raw YAML (.vspec) editor">YAML</button>
          <span class="cv-hint" style="margin-left:auto">COVESA VSS · Pelorus <code>Vessel.*</code></span>
        </div>
        <div class="vss-panes">
          ${
            this.activeTab === 'tree'
              ? `<div class="vss-split">
            <div>${treeInner}</div>
            <div class="vss-meta-panel">
              ${
                selected
                  ? `
                <h4 class="cv-card-title">${escapeHtml(selected.path)}</h4>
                <label class="cv-field-label">type</label>
                <input class="cv-input" data-meta-key="type" value="${escapeHtml(String(meta.type ?? ''))}" />
                <label class="cv-field-label">description</label>
                <textarea class="cv-input" rows="2" data-meta-key="description">${escapeHtml(String(meta.description ?? ''))}</textarea>
                <label class="cv-field-label">datatype</label>
                <input class="cv-input" data-meta-key="datatype" value="${escapeHtml(String(meta.datatype ?? ''))}" />
                <label class="cv-field-label">unit</label>
                <input class="cv-input" data-meta-key="unit" value="${escapeHtml(String(meta.unit ?? ''))}" />
                <label class="cv-field-label">min / max</label>
                <div style="display:flex;gap:8px">
                  <input class="cv-input" data-meta-key="min" placeholder="min" value="${escapeHtml(String(meta.min ?? ''))}" />
                  <input class="cv-input" data-meta-key="max" placeholder="max" value="${escapeHtml(String(meta.max ?? ''))}" />
                </div>
                <p class="cv-hint">Decode: DBC signal names match the last segment of a catalog leaf path.</p>
                <button type="button" class="cv-btn primary" id="vssApplyMeta">Apply node</button>
              `
                  : '<p class="cv-hint">Select a node in the tree to edit metadata.</p>'
              }
            </div>
          </div>`
              : ''
          }
          ${
            this.activeTab === 'leaves'
              ? `<div>
            <input type="search" class="cv-input" id="vssLeafFilter" placeholder="Filter paths…" value="${escapeHtml(this.filterLeaves)}" />
            <div class="cv-table-wrap" style="margin-top:8px">
              <table class="cv-table">
                <thead><tr><th>Path</th><th>Type</th><th>Datatype</th><th>Unit</th></tr></thead>
                <tbody>
                  ${filtered
                    .map(
                      l => `<tr><td class="mono">${escapeHtml(l.path)}</td>
                    <td>${escapeHtml(l.node_type ?? '')}</td>
                    <td>${escapeHtml(l.datatype ?? '')}</td>
                    <td>${escapeHtml(l.unit ?? '')}</td></tr>`,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>`
              : ''
          }
          ${
            this.activeTab === 'yaml'
              ? `<textarea id="vssYamlTa" class="vss-yaml cv-input" ${snap ? '' : 'readonly'}>${escapeHtml(this.yamlDraft)}</textarea>
            <p class="cv-hint">${snap ? 'Edit YAML, then apply — MDF4 / Signals views refresh vessel paths.' : 'No catalog in session. Use Open or New before editing YAML.'}</p>
            <p class="cv-hint"><button type="button" class="cv-btn link" id="vssLinkCovesa">COVESA VSS</button> specification (external)</p>
            <button type="button" class="cv-btn primary" id="vssApplyYaml" ${snap ? '' : 'disabled'}>Apply YAML to session</button>`
              : ''
          }
        </div>
      </div>`;

    this.bindUi();
  }

  private bindUi(): void {
    const root = this.shadowRoot;
    if (!root) return;

    root.querySelector('#vssLinkCovesa')?.addEventListener('click', () => {
      void import('@tauri-apps/plugin-shell').then(({ open }) =>
        open('https://covesa.github.io/vehicle_signal_specification/'),
      );
    });

    root.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'tree' | 'leaves' | 'yaml';
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        if (tab === 'yaml' && this.api && this.snapshot) {
          void this.api
            .serializeVssCatalog({ roots: cloneDto(this.snapshot.roots) })
            .then(y => {
              this.yamlDraft = y;
              this.render();
            });
        } else {
          this.render();
        }
      });
    });

    root.querySelectorAll('.vss-tree-node').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedPath = (btn as HTMLElement).dataset.path ?? null;
        this.render();
      });
    });

    root.querySelector('#vssLeafFilter')?.addEventListener('input', (e: Event) => {
      this.filterLeaves = (e.target as HTMLInputElement).value;
      this.render();
    });

    root.querySelector('#vssApplyYaml')?.addEventListener('click', async () => {
      if (!this.api) return;
      const y = this.readYamlFromDom();
      try {
        await this.api.updateVssContent(y);
        const snap = await this.api.getVssSnapshot();
        emitVssChanged({
          action: 'updated',
          snapshot: snap,
          filename: this.currentFile ? extractFilename(this.currentFile) : null,
        });
        this.applySnapshot(snap, this.currentFile, true);
        this.isDirty = true;
        this.emitState();
        this.toast('VSS catalog updated', 'success');
      } catch (err) {
        this.toast(String(err), 'error');
      }
    });

    root.querySelector('#vssApplyMeta')?.addEventListener('click', async () => {
      if (!this.api || !this.snapshot || !this.selectedPath) return;
      const roots = cloneDto(this.snapshot.roots);
      const node = findNode(roots, this.selectedPath);
      if (!node) return;
      root.querySelectorAll('[data-meta-key]').forEach(el => {
        const key = (el as HTMLElement).dataset.metaKey!;
        const val =
          el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement ? el.value.trim() : '';
        if (!val) {
          delete node.meta[key];
        } else {
          node.meta[key] = val;
        }
      });
      try {
        const snap = await this.api.updateVssCatalog({ roots });
        this.isDirty = true;
        emitVssChanged({
          action: 'updated',
          snapshot: snap,
          filename: this.currentFile ? extractFilename(this.currentFile) : null,
        });
        this.snapshot = snap;
        this.yamlDraft = await this.api.serializeVssCatalog({ roots: cloneDto(snap.roots) });
        this.emitState();
        this.render();
        this.toast('Node metadata updated', 'success');
      } catch (err) {
        this.toast(String(err), 'error');
      }
    });
  }
}

customElements.define('cv-vss-editor', VssEditorElement);
