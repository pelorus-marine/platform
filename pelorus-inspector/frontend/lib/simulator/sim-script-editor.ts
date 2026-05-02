/**
 * Simulator Script Editor Component
 *
 * Thin wrapper around RhaiScriptEditor configured for simulator scripts.
 * Provides simulator-specific templates, API, and DBC signal autocomplete.
 */

import { SCRIPT_API, getAutocompleteSuggestions, getAllSignalSuggestions, loadDbcData } from './script-api.js';
import { getTemplates } from './script-templates.js';
import { RhaiScriptEditorElement, type ScriptTemplate } from '../editors/rhai-script-editor.js';
import type { ApiSection, AutocompleteSuggestion } from '../editors/rhai-editor.js';

// Import the unified editor component
import '../editors/rhai-script-editor.js';

// ─────────────────────────────────────────────────────────────────────────────
// API Sections for Reference Panel
// ─────────────────────────────────────────────────────────────────────────────

function buildApiSections(): ApiSection[] {
  return [
    {
      title: 'Types',
      items: Object.entries(SCRIPT_API.types).map(([name, type]) => ({
        name,
        desc: type.description,
        fields: Object.entries(type.fields).map(([fname, info]) => ({ name: fname, type: info.type })),
        methods: type.methods ? Object.entries(type.methods).map(([mname, mdesc]) => ({ name: mname, desc: mdesc })) : undefined,
      })),
    },
    {
      title: 'Callbacks',
      items: Object.entries(SCRIPT_API.callbacks).map(([name, desc]) => ({ name, desc })),
    },
    {
      title: 'Functions',
      items: Object.entries(SCRIPT_API.functions).map(([name, desc]) => ({ name, desc })),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

function buildTemplates(): ScriptTemplate[] {
  const templates = getTemplates();
  return [
    { key: 'default', name: 'Default', desc: 'DBC-aware starter script', code: templates.default },
    { key: 'basic', name: 'Basic', desc: 'Simple periodic message', code: templates.basic },
    { key: 'dbc_signals', name: 'DBC Signals', desc: 'Signal-based encoding', code: templates.dbc_signals },
    { key: 'obd2', name: 'OBD-II', desc: 'OBD-II response simulator', code: templates.obd2 },
    { key: 'sweep', name: 'Sweep Test', desc: 'Signal range sweep', code: templates.sweep },
    { key: 'noise', name: 'Noise', desc: 'Random data generator', code: templates.noise },
    { key: 'can_fd', name: 'CAN FD', desc: '64-byte FD frames', code: templates.can_fd },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Autocomplete
// ─────────────────────────────────────────────────────────────────────────────

function getSimulatorAutocompleteSuggestions(context: string, _prefix: string, fullText: string): AutocompleteSuggestion[] {
  // Check if we're inside set_signal( - show DBC signals
  const lines = fullText.split('\n');
  const lastLine = lines[lines.length - 1];
  const setSignalMatch = lastLine.match(/set_signal\s*\(\s*("[^"]*"?\s*,?\s*)?("[^"]*)?$/);

  if (setSignalMatch) {
    return getAllSignalSuggestions();
  }

  // Standard context-based suggestions
  return getAutocompleteSuggestions(context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export class SimScriptEditorElement extends HTMLElement {
  private editor: RhaiScriptEditorElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes(): string[] {
    return ['disabled'];
  }

  get script(): string { return this.editor?.script ?? ''; }
  set script(value: string) { if (this.editor) this.editor.script = value; }

  get disabled(): boolean { return this.editor?.disabled ?? false; }
  set disabled(value: boolean) { if (this.editor) this.editor.disabled = value; }

  get hasChanges(): boolean { return this.editor?.hasChanges ?? false; }

  markApplied(): void { this.editor?.markApplied(); }

  loadTemplate(key: string): void { this.editor?.loadTemplate(key); }

  attributeChangedCallback(name: string, _old: string, value: string): void {
    if (name === 'disabled' && this.editor) {
      this.editor.disabled = value !== null;
    }
  }

  connectedCallback(): void {
    // Load DBC data for autocomplete
    loadDbcData();

    // Create the unified editor
    this.shadowRoot!.innerHTML = `
      <style>
        :host { display: flex; flex: 1; min-width: 0; }
        rhai-script-editor { flex: 1; }
      </style>
      <rhai-script-editor></rhai-script-editor>
    `;

    this.editor = this.shadowRoot!.querySelector('rhai-script-editor');

    // Configure for simulator use
    this.editor?.configure({
      templates: buildTemplates(),
      apiTitle: 'Script API Reference',
      apiSections: buildApiSections(),
      getAutocompleteSuggestions: getSimulatorAutocompleteSuggestions,
      loadEventName: 'simulator:script-load-requested',
      saveEventName: 'simulator:script-save-requested',
      showFileControls: true,
      showApplyButton: true,
      showValidateButton: true,
      placeholder: 'Write your simulation script here...',
    });

    // Forward events
    this.editor?.addEventListener('script-change', (e) => {
      this.dispatchEvent(new CustomEvent('script-change', { detail: (e as CustomEvent).detail }));
    });
    this.editor?.addEventListener('validate', (e) => {
      this.dispatchEvent(new CustomEvent('validate', { detail: (e as CustomEvent).detail }));
    });
    this.editor?.addEventListener('apply', (e) => {
      this.dispatchEvent(new CustomEvent('apply', { detail: (e as CustomEvent).detail }));
    });
  }
}

customElements.define('sim-script-editor', SimScriptEditorElement);
