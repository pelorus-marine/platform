/**
 * Generic Rhai Script Editor Component
 *
 * Base class for code editors with syntax highlighting and autocomplete.
 * Extended by workflow-script-editor and sim-script-editor.
 */

import { CODE_EDITOR_STYLES, SYNTAX_HIGHLIGHT_STYLES, AUTOCOMPLETE_STYLES } from './styles.js';
import { debounce, escapeHtml } from './form-helpers.js';

/** Autocomplete suggestion */
export interface AutocompleteSuggestion {
  label: string;
  insert: string;
  detail: string;
}

/** API reference section */
export interface ApiSection {
  title: string;
  items: Array<{
    name: string;
    desc: string;
    fields?: Array<{ name: string; type: string }>;
    methods?: Array<{ name: string; desc: string }>;
  }>;
}

/** Configuration for the editor */
export interface RhaiEditorConfig {
  placeholder?: string;
  apiTitle?: string;
  apiSections?: ApiSection[];
  getAutocompleteSuggestions?: (context: string, prefix: string) => AutocompleteSuggestion[];
}

/** Base styles for all Rhai editors */
export const RHAI_EDITOR_BASE_STYLES = `
  :host {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .editor-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  .cv-btn.small { padding: 3px 8px; font-size: 0.7rem; }
  .api-panel {
    display: none;
    flex-direction: column;
    width: 280px;
    min-width: 280px;
    background: var(--cv-bg-alt);
    border-left: 1px solid var(--cv-border);
    overflow: hidden;
  }
  .api-panel.visible { display: flex; }
  .api-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--cv-bg);
    border-bottom: 1px solid var(--cv-border);
  }
  .api-title { font-weight: 600; font-size: 0.85rem; }
  .api-close {
    background: none;
    border: none;
    color: var(--cv-text-dim);
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
  }
  .api-close:hover { color: var(--cv-text); }
  .api-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }
  .api-section { margin-bottom: 16px; }
  .api-section-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--cv-text-dim);
    margin-bottom: 8px;
  }
  .api-item { margin-bottom: 8px; }
  .api-item-name {
    font-family: var(--cv-font-mono);
    font-size: 0.8rem;
    color: var(--cv-accent);
  }
  .api-item-desc {
    font-size: 0.75rem;
    color: var(--cv-text-muted);
  }
  .api-type-fields { margin-left: 12px; margin-top: 4px; }
  .api-field { font-size: 0.75rem; color: var(--cv-text-dim); }
  .api-field-name { font-family: var(--cv-font-mono); color: var(--cv-text-muted); }
`;

/** Get combined styles */
export function getRhaiEditorStyles(additionalStyles = ''): string {
  return CODE_EDITOR_STYLES + SYNTAX_HIGHLIGHT_STYLES + AUTOCOMPLETE_STYLES + RHAI_EDITOR_BASE_STYLES + additionalStyles;
}

/** Rhai syntax highlighter keywords */
const RHAI_KEYWORDS = [
  'let', 'const', 'if', 'else', 'while', 'loop', 'for', 'in', 'fn',
  'return', 'break', 'continue', 'throw', 'try', 'catch', 'switch',
  'this', 'private', 'import', 'export', 'as', 'is'
];
const RHAI_BOOLEANS = ['true', 'false', 'nil'];

/** Highlight Rhai code with syntax coloring */
export function highlightRhai(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    let highlighted = '';
    let i = 0;

    while (i < line.length) {
      // Comments
      if (line.slice(i, i + 2) === '//') {
        highlighted += `<span class="cmt">${escapeHtml(line.slice(i))}</span>`;
        break;
      }

      // Strings
      if (line[i] === '"' || line[i] === "'") {
        const quote = line[i];
        let end = i + 1;
        while (end < line.length && line[end] !== quote) {
          if (line[end] === '\\') end++;
          end++;
        }
        end++;
        highlighted += `<span class="str">${escapeHtml(line.slice(i, end))}</span>`;
        i = end;
        continue;
      }

      // Numbers (including hex)
      if (/\d/.test(line[i])) {
        let end = i;
        while (end < line.length && /[\d._xXa-fA-F]/.test(line[end])) end++;
        highlighted += `<span class="num">${escapeHtml(line.slice(i, end))}</span>`;
        i = end;
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(line[i])) {
        let end = i;
        while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) end++;
        const word = line.slice(i, end);
        const isFunction = line[end] === '(';

        if (RHAI_KEYWORDS.includes(word)) {
          highlighted += `<span class="kw">${word}</span>`;
        } else if (RHAI_BOOLEANS.includes(word)) {
          highlighted += `<span class="bool">${word}</span>`;
        } else if (isFunction) {
          highlighted += `<span class="fn">${word}</span>`;
        } else {
          highlighted += escapeHtml(word);
        }
        i = end;
        continue;
      }

      // Operators
      if (/[+\-*/%=<>!&|^~?:]/.test(line[i])) {
        highlighted += `<span class="op">${escapeHtml(line[i])}</span>`;
        i++;
        continue;
      }

      highlighted += escapeHtml(line[i]);
      i++;
    }

    result.push(highlighted);
  }

  return result.join('\n');
}

/** Render API reference panel HTML */
export function renderApiPanel(title: string, sections: ApiSection[], visible: boolean): string {
  return `
    <div class="api-panel ${visible ? 'visible' : ''}" id="api-panel">
      <div class="api-header">
        <span class="api-title">${title}</span>
        <button class="api-close" id="api-close">&times;</button>
      </div>
      <div class="api-content">
        ${sections.map(section => `
          <div class="api-section">
            <div class="api-section-title">${section.title}</div>
            ${section.items.map(item => `
              <div class="api-item">
                <span class="api-item-name">${item.name}</span>
                <div class="api-item-desc">${item.desc}</div>
                ${item.fields ? `
                  <div class="api-type-fields">
                    ${item.fields.map(f => `
                      <div class="api-field">
                        <span class="api-field-name">.${f.name}:</span> ${f.type}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                ${item.methods ? `
                  <div class="api-type-fields">
                    ${item.methods.map(m => `
                      <div class="api-field">
                        <span class="api-field-name">.${m.name}</span> - ${m.desc}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Mixin that adds script editor functionality to a component.
 * Provides line numbers, syntax highlighting, autocomplete UI.
 */
export class RhaiEditorMixin {
  shadow: ShadowRoot;
  _script = '';
  _disabled = false;
  autocompleteVisible = false;
  autocompleteItems: AutocompleteSuggestion[] = [];
  autocompleteIndex = 0;
  autocompletePrefix = '';
  apiRefVisible = false;

  debouncedHighlight: () => void;

  constructor(shadow: ShadowRoot) {
    this.shadow = shadow;
    this.debouncedHighlight = debounce(() => this.updateHighlight(), 50);
  }

  get script(): string { return this._script; }
  set script(value: string) {
    this._script = value;
    const textarea = this.shadow.querySelector('textarea');
    if (textarea && textarea.value !== value) {
      textarea.value = value;
      this.updateLineNumbers();
      this.updateHighlight();
    }
  }

  get disabled(): boolean { return this._disabled; }
  set disabled(value: boolean) {
    this._disabled = value;
    const textarea = this.shadow.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) textarea.disabled = value;
  }

  /** Update line numbers display */
  updateLineNumbers(): void {
    const textarea = this.shadow.querySelector('textarea');
    const lineNumbers = this.shadow.querySelector('#line-numbers');
    if (!textarea || !lineNumbers) return;

    const lines = textarea.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) =>
      `<span class="line-number">${i + 1}</span>`
    ).join('');
  }

  /** Update syntax highlighting */
  updateHighlight(): void {
    const textarea = this.shadow.querySelector('textarea');
    const highlight = this.shadow.querySelector('#highlight-layer');
    if (!textarea || !highlight) return;
    highlight.innerHTML = highlightRhai(textarea.value);
  }

  /** Sync scroll between textarea and highlight layer */
  syncScroll(): void {
    const textarea = this.shadow.querySelector('textarea');
    const highlight = this.shadow.querySelector('#highlight-layer') as HTMLElement;
    const lineNumbers = this.shadow.querySelector('#line-numbers') as HTMLElement;

    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
    if (textarea && lineNumbers) {
      lineNumbers.scrollTop = textarea.scrollTop;
    }
  }

  /** Show autocomplete popup */
  showAutocompletePopup(textarea: HTMLTextAreaElement, text: string, currentLine: string): void {
    if (this.autocompleteItems.length === 0) {
      this.hideAutocomplete();
      return;
    }

    const popup = this.shadow.querySelector('#autocomplete') as HTMLElement;
    if (popup) {
      const textareaRect = textarea.getBoundingClientRect();
      const style = getComputedStyle(textarea);
      const lineHeight = parseFloat(style.lineHeight) || 20;
      const paddingTop = parseFloat(style.paddingTop) || 12;
      const paddingLeft = parseFloat(style.paddingLeft) || 12;

      const lineNum = text.split('\n').length;
      const col = currentLine.length;

      const top = textareaRect.top + paddingTop + (lineNum * lineHeight) - textarea.scrollTop;
      const left = textareaRect.left + paddingLeft + Math.min(col * 7.5, 200);

      popup.style.top = `${Math.min(top, window.innerHeight - 220)}px`;
      popup.style.left = `${Math.min(left, window.innerWidth - 300)}px`;

      popup.innerHTML = this.autocompleteItems.map((item, i) => `
        <div class="autocomplete-item ${i === this.autocompleteIndex ? 'selected' : ''}" data-index="${i}">
          <span class="autocomplete-label">${item.label}</span>
          <span class="autocomplete-detail">${item.detail}</span>
        </div>
      `).join('');

      popup.classList.add('visible');
      this.autocompleteVisible = true;

      popup.querySelectorAll('.autocomplete-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt((el as HTMLElement).dataset.index || '0');
          this.acceptAutocomplete(textarea, idx);
        });
      });
    }
  }

  /** Hide autocomplete popup */
  hideAutocomplete(): void {
    this.shadow.querySelector('#autocomplete')?.classList.remove('visible');
    this.autocompleteVisible = false;
  }

  /** Update selected autocomplete item */
  updateAutocompleteSelection(): void {
    const popup = this.shadow.querySelector('#autocomplete');
    popup?.querySelectorAll('.autocomplete-item').forEach((el, i) => {
      el.classList.toggle('selected', i === this.autocompleteIndex);
    });
    popup?.querySelector('.autocomplete-item.selected')?.scrollIntoView({ block: 'nearest' });
  }

  /** Accept autocomplete selection */
  acceptAutocomplete(textarea: HTMLTextAreaElement, index?: number): void {
    const item = this.autocompleteItems[index ?? this.autocompleteIndex];
    if (!item) return;

    const cursorPos = textarea.selectionStart;
    const before = textarea.value.substring(0, cursorPos - this.autocompletePrefix.length);
    const after = textarea.value.substring(cursorPos);

    textarea.value = before + item.insert + after;
    textarea.selectionStart = textarea.selectionEnd = before.length + item.insert.length;
    this._script = textarea.value;

    this.hideAutocomplete();
    textarea.focus();
  }

  /** Handle common keyboard events */
  handleKeyDown(e: KeyboardEvent, textarea: HTMLTextAreaElement, onShowAutocomplete: () => void): boolean {
    if (this.autocompleteVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.autocompleteIndex = Math.min(this.autocompleteIndex + 1, this.autocompleteItems.length - 1);
        this.updateAutocompleteSelection();
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.autocompleteIndex = Math.max(this.autocompleteIndex - 1, 0);
        this.updateAutocompleteSelection();
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.acceptAutocomplete(textarea);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideAutocomplete();
        return true;
      }
    }

    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      onShowAutocomplete();
      return true;
    }

    if (e.key === 'F1') {
      e.preventDefault();
      this.toggleApiReference();
      return true;
    }

    if (e.key === 'Tab' && !this.autocompleteVisible) {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 4;
      this._script = textarea.value;
      return true;
    }

    return false;
  }

  /** Show API reference panel */
  showApiReference(): void {
    this.apiRefVisible = true;
    this.shadow.querySelector('#api-panel')?.classList.add('visible');
  }

  /** Hide API reference panel */
  hideApiReference(): void {
    this.apiRefVisible = false;
    this.shadow.querySelector('#api-panel')?.classList.remove('visible');
  }

  /** Toggle API reference panel */
  toggleApiReference(): void {
    if (this.apiRefVisible) {
      this.hideApiReference();
    } else {
      this.showApiReference();
    }
  }

  /** Bind API close button */
  bindApiCloseButton(): void {
    this.shadow.querySelector('#api-close')?.addEventListener('click', () => this.hideApiReference());
  }
}
