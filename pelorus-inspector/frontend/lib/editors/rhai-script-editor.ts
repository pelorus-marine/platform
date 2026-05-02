/**
 * Unified Rhai Script Editor Component
 *
 * Full-featured code editor with:
 * - Syntax highlighting and autocomplete
 * - Templates dropdown
 * - File load/save with change tracking
 * - Apply/Validate buttons
 * - API reference panel
 *
 * Configurable for different use cases (simulator, workflow, etc.)
 */

import { invoke } from '../ipc.js';
import { events, subscribeRhaiScriptBridge, type RhaiScriptBridgeEvent, EMPTY_PAYLOAD } from '../events.js';
import { toast } from '../components/shared';
import { artifactIndex } from '../store.js';
import {
  RhaiEditorMixin,
  getRhaiEditorStyles,
  renderApiPanel,
  type ApiSection,
  type AutocompleteSuggestion,
} from './rhai-editor.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScriptTemplate {
  key: string;
  name: string;
  desc: string;
  code: string | (() => string);
}

export interface RhaiScriptEditorConfig {
  /** Templates shown in dropdown */
  templates?: ScriptTemplate[];
  /** API reference panel title */
  apiTitle?: string;
  /** API reference sections */
  apiSections?: ApiSection[];
  /** Custom autocomplete function */
  getAutocompleteSuggestions?: (context: string, prefix: string, text: string) => AutocompleteSuggestion[];
  /** Bus event for toolbar-driven load dialog (subset of {@link RhaiScriptBridgeEvent}). */
  loadEventName?: RhaiScriptBridgeEvent;
  /** Bus event for toolbar-driven save dialog. */
  saveEventName?: RhaiScriptBridgeEvent;
  /** Show file load/save controls */
  showFileControls?: boolean;
  /** Show Apply button */
  showApplyButton?: boolean;
  /** Show Validate button */
  showValidateButton?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const componentStyles = `
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    position: relative;
  }
  .file-name {
    font-size: 0.7rem;
    color: var(--cv-text-dim);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .changed-indicator {
    color: var(--cv-warning, #f59e0b);
    margin-left: 4px;
  }
  .template-dropdown {
    position: relative;
  }
  .template-menu {
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--cv-bg-alt);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    box-shadow: var(--pro-shadow-lg);
    z-index: 100;
    min-width: 220px;
    max-height: 300px;
    overflow-y: auto;
    display: none;
  }
  .template-menu.visible { display: block; }
  .template-item {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 0.8rem;
    border-bottom: 1px solid var(--cv-border);
  }
  .template-item:last-child { border-bottom: none; }
  .template-item:hover {
    background: var(--cv-bg);
  }
  .template-item-name { font-weight: 500; }
  .template-item-desc {
    font-size: 0.7rem;
    color: var(--cv-text-dim);
    margin-top: 2px;
  }
  .api-panel {
    position: absolute;
    top: 40px;
    right: 12px;
    width: 350px;
    max-height: 70%;
    background: var(--cv-bg-alt);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    box-shadow: var(--pro-shadow-lg);
    z-index: 999;
    display: none;
    overflow: hidden;
  }
  .api-panel.visible {
    display: flex;
    flex-direction: column;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const styles = getRhaiEditorStyles(componentStyles);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export class RhaiScriptEditorElement extends HTMLElement {
  private shadow: ShadowRoot;
  private editor: RhaiEditorMixin;
  private _config: RhaiScriptEditorConfig = {};
  private _appliedScript = '';
  private _filePath: string | null = null;
  private templateMenuVisible = false;
  private _scriptBridgeUnsubs: Array<() => void> = [];

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.editor = new RhaiEditorMixin(this.shadow);
  }

  static get observedAttributes(): string[] {
    return ['disabled'];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  get script(): string { return this.editor.script; }
  set script(value: string) { this.editor.script = value; }

  get disabled(): boolean { return this.editor.disabled; }
  set disabled(value: boolean) { this.editor.disabled = value; }

  get hasChanges(): boolean { return this.editor._script !== this._appliedScript; }

  get filePath(): string | null { return this._filePath; }

  /** Configure the editor */
  configure(config: RhaiScriptEditorConfig): void {
    this._config = { ...this._config, ...config };
    if (this.isConnected) {
      this.render();
      this.bindEvents();
      this.editor.updateLineNumbers();
      this.editor.updateHighlight();
    }
  }

  /** Mark current script as applied (clears change indicator) */
  markApplied(): void {
    this._appliedScript = this.editor._script;
    this.updateHeaderDisplay();
  }

  /** Load a template by key */
  loadTemplate(key: string): void {
    const template = this._config.templates?.find(t => t.key === key);
    if (template) {
      const code = typeof template.code === 'function' ? template.code() : template.code;
      this.editor._script = code;
      this._appliedScript = '';
      this._filePath = null;
      const textarea = this.shadow.querySelector('textarea');
      if (textarea) textarea.value = code;
      this.editor.updateLineNumbers();
      this.editor.updateHighlight();
      this.updateHeaderDisplay();
      this.dispatchEvent(new CustomEvent('script-change', { detail: { script: code } }));
    }
  }

  /** Set script content programmatically */
  setScript(script: string, markAsApplied = false): void {
    this.editor._script = script;
    if (markAsApplied) {
      this._appliedScript = script;
    }
    const textarea = this.shadow.querySelector('textarea');
    if (textarea) textarea.value = script;
    this.editor.updateLineNumbers();
    this.editor.updateHighlight();
    this.updateHeaderDisplay();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  attributeChangedCallback(name: string, _old: string, value: string): void {
    if (name === 'disabled') this.editor._disabled = value !== null;
  }

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    this.editor.updateLineNumbers();
    this.editor.updateHighlight();

    this._scriptBridgeUnsubs = [];
    if (this._config.loadEventName) {
      this._scriptBridgeUnsubs.push(
        subscribeRhaiScriptBridge(this._config.loadEventName, () => {
          void this.handleLoad();
        }),
      );
    }
    if (this._config.saveEventName) {
      this._scriptBridgeUnsubs.push(
        subscribeRhaiScriptBridge(this._config.saveEventName, () => {
          void this.handleSave();
        }),
      );
    }
  }

  disconnectedCallback(): void {
    for (const unsub of this._scriptBridgeUnsubs) {
      unsub();
    }
    this._scriptBridgeUnsubs = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  private render(): void {
    const {
      templates = [],
      apiTitle = 'API Reference',
      apiSections = [],
      showFileControls = true,
      showApplyButton = true,
      showValidateButton = true,
      placeholder = 'Write your script here...',
    } = this._config;

    const fileName = this._filePath ? this._filePath.split('/').pop() : '(unsaved)';
    const changedIndicator = this.hasChanges ? '<span class="changed-indicator">●</span>' : '';
    const hasTemplates = templates.length > 0;
    const hasApiSections = apiSections.length > 0;

    this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="editor-header">
        <div class="header-left">
          ${showFileControls ? `
            <span class="file-name" id="file-name" title="${this._filePath || 'Unsaved'}">
              ${fileName}${changedIndicator}
            </span>
          ` : ''}
          ${hasTemplates ? `
            <div class="template-dropdown">
              <button class="cv-btn small" id="template-btn">Templates</button>
              <div class="template-menu" id="template-menu">
                ${templates.map(t => `
                  <div class="template-item" data-template="${t.key}">
                    <div class="template-item-name">${t.name}</div>
                    <div class="template-item-desc">${t.desc}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="editor-actions">
          ${hasApiSections ? `
            <button class="cv-btn small" id="api-ref-btn" title="API Reference (F1)">?</button>
          ` : ''}
          ${showValidateButton ? `
            <button class="cv-btn small" id="validate-btn">Validate</button>
          ` : ''}
          ${showApplyButton ? `
            <button class="cv-btn small accent" id="apply-btn" ${!this.hasChanges ? 'disabled' : ''}>Apply</button>
          ` : ''}
        </div>
      </div>
      <div class="code-area">
        <div class="line-numbers" id="line-numbers"></div>
        <div class="editor-wrapper">
          <pre class="highlight-layer" id="highlight-layer"></pre>
          <textarea class="code-textarea" spellcheck="false" placeholder="${placeholder}" ${this.editor._disabled ? 'disabled' : ''}>${this.editor._script}</textarea>
        </div>
        <div class="autocomplete" id="autocomplete"></div>
      </div>
      ${hasApiSections ? renderApiPanel(apiTitle, apiSections, this.editor.apiRefVisible) : ''}
    `;
  }

  private bindEvents(): void {
    const textarea = this.shadow.querySelector('textarea') as HTMLTextAreaElement;

    // Text input
    textarea?.addEventListener('input', () => {
      this.editor._script = textarea.value;
      this.editor.updateLineNumbers();
      this.editor.debouncedHighlight();
      this.updateHeaderDisplay();
      this.dispatchEvent(new CustomEvent('script-change', { detail: { script: this.editor._script } }));

      // Trigger autocomplete on dot
      const pos = textarea.selectionStart;
      const char = textarea.value[pos - 1];
      if (char === '.') this.showAutocomplete(textarea);
    });

    // Scroll sync
    textarea?.addEventListener('scroll', () => this.editor.syncScroll());

    // Keyboard handling
    textarea?.addEventListener('keydown', (e) => {
      this.editor.handleKeyDown(e, textarea, () => this.showAutocomplete(textarea));
    });

    // Hide autocomplete on blur
    textarea?.addEventListener('blur', () => {
      setTimeout(() => this.editor.hideAutocomplete(), 150);
    });

    // Template dropdown
    this.shadow.querySelector('#template-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.templateMenuVisible = !this.templateMenuVisible;
      this.shadow.querySelector('#template-menu')?.classList.toggle('visible', this.templateMenuVisible);
    });

    // Template items
    this.shadow.querySelectorAll('.template-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = (item as HTMLElement).dataset.template;
        if (key) this.loadTemplate(key);
        this.templateMenuVisible = false;
        this.shadow.querySelector('#template-menu')?.classList.remove('visible');
      });
    });

    // Close template menu on outside click
    this.shadow.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.template-dropdown')) {
        this.templateMenuVisible = false;
        this.shadow.querySelector('#template-menu')?.classList.remove('visible');
      }
    });

    // API reference
    this.shadow.querySelector('#api-ref-btn')?.addEventListener('click', () => this.editor.toggleApiReference());
    this.editor.bindApiCloseButton();

    // Validate button
    this.shadow.querySelector('#validate-btn')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('validate', { detail: { script: this.editor._script } }));
    });

    // Apply button
    this.shadow.querySelector('#apply-btn')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('apply', { detail: { script: this.editor._script } }));
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Header Display
  // ─────────────────────────────────────────────────────────────────────────

  private updateHeaderDisplay(): void {
    // Update apply button state
    const applyBtn = this.shadow.querySelector('#apply-btn') as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = !this.hasChanges;
      applyBtn.title = this.hasChanges ? 'Apply changes' : 'No changes to apply';
    }

    // Update file name display
    const fileNameEl = this.shadow.querySelector('#file-name');
    if (fileNameEl) {
      const name = this._filePath ? this._filePath.split('/').pop() : '(unsaved)';
      const indicator = this.hasChanges ? '<span class="changed-indicator">●</span>' : '';
      fileNameEl.innerHTML = `${name}${indicator}`;
      fileNameEl.setAttribute('title', this._filePath || 'Unsaved');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File I/O
  // ─────────────────────────────────────────────────────────────────────────

  private async handleLoad(): Promise<void> {
    try {
      // Get list of stored Rhai scripts
      const scripts = artifactIndex.get().rhaiArtifacts;

      if (scripts.length === 0) {
        toast.info('No saved scripts. Use Storage tab to import.');
        return;
      }

      // Show picker
      const names = scripts.map(s => s.name);
      const selected = prompt(
        `Load script:\n\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEnter number or name:`
      );

      if (!selected) return; // User cancelled

      // Find the script by number or name
      let name: string;
      const num = parseInt(selected);
      if (!isNaN(num) && num >= 1 && num <= names.length) {
        name = names[num - 1];
      } else {
        const found = names.find(n => n.toLowerCase() === selected.toLowerCase());
        if (!found) {
          toast.error(`Script not found: ${selected}`);
          return;
        }
        name = found;
      }

      // Load from storage
      const contentBytes = await invoke<number[] | null>('storage_get', {
        name,
        artifactType: 'rhai',
      });

      if (!contentBytes) {
        toast.error(`Script not found: ${name}`);
        return;
      }

      const content = new TextDecoder().decode(new Uint8Array(contentBytes));
      this.editor._script = content;
      this._appliedScript = content;
      this._filePath = name;
      const textarea = this.shadow.querySelector('textarea');
      if (textarea) textarea.value = content;
      this.editor.updateLineNumbers();
      this.editor.updateHighlight();
      this.updateHeaderDisplay();
      toast.success(`Loaded: ${name}`);
      this.dispatchEvent(new CustomEvent('script-change', { detail: { script: content } }));
      this.dispatchEvent(new CustomEvent('file-loaded', { detail: { path: name, script: content } }));
    } catch (e) {
      console.error('Failed to load script:', e);
      toast.error(`Failed to load: ${e}`);
    }
  }

  private async handleSave(): Promise<void> {
    try {
      const defaultName = this._filePath || 'script.rhai';
      const name = prompt('Save script as:', defaultName);

      if (!name) return; // User cancelled

      const content = new TextEncoder().encode(this.editor._script);
      await invoke('storage_store', {
        name,
        artifactType: 'rhai',
        content: Array.from(content),
      });

      this._filePath = name;
      this._appliedScript = this.editor._script;
      this.updateHeaderDisplay();

      // Refresh storage store
      events.emit('storage:refresh', EMPTY_PAYLOAD);

      toast.success(`Saved: ${name}`);
      this.dispatchEvent(new CustomEvent('file-saved', { detail: { path: name, script: this.editor._script } }));
    } catch (e) {
      console.error('Failed to save script:', e);
      toast.error(`Failed to save: ${e}`);
    }
  }

  /** Programmatically trigger load dialog */
  async load(): Promise<void> {
    await this.handleLoad();
  }

  /** Programmatically trigger save */
  async save(): Promise<void> {
    await this.handleSave();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Autocomplete
  // ─────────────────────────────────────────────────────────────────────────

  private showAutocomplete(textarea: HTMLTextAreaElement): void {
    const cursorPos = textarea.selectionStart;
    const text = textarea.value.substring(0, cursorPos);
    const lines = text.split('\n');
    const currentLine = lines[lines.length - 1];

    // Determine context and prefix
    const dotMatch = currentLine.match(/(\w+)\.\s*(\w*)$/);
    let context = 'global';
    let prefix = '';

    if (dotMatch) {
      const varName = dotMatch[1].toLowerCase();
      // Try to infer type from variable name
      if (varName === 'frame' || varName.includes('frame')) {
        context = 'frame';
      } else if (varName.includes('signal')) {
        context = 'signal';
      } else if (varName.includes('msg') || varName.includes('message')) {
        context = 'message';
      }
      prefix = dotMatch[2] || '';
    } else {
      const wordMatch = currentLine.match(/(\w+)$/);
      prefix = wordMatch ? wordMatch[1] : '';
    }

    // Get suggestions from config or use empty array
    this.editor.autocompletePrefix = prefix;
    let items: AutocompleteSuggestion[] = [];

    if (this._config.getAutocompleteSuggestions) {
      items = this._config.getAutocompleteSuggestions(context, prefix, textarea.value);
    }

    // Filter by prefix
    if (prefix) {
      items = items.filter(item => item.label.toLowerCase().startsWith(prefix.toLowerCase()));
    }

    this.editor.autocompleteItems = items;
    this.editor.autocompleteIndex = 0;
    this.editor.showAutocompletePopup(textarea, text, currentLine);
  }
}

customElements.define('rhai-script-editor', RhaiScriptEditorElement);
