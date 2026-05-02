/**
 * Workflow Script Editor Component
 *
 * Thin wrapper around RhaiScriptEditor configured for workflow scripts.
 * Used inside the script modal in workflow-editor.
 */

import {
  WORKFLOW_SCRIPT_API,
  WORKFLOW_SCRIPT_TEMPLATES,
  DEFAULT_WORKFLOW_SCRIPT,
  getWorkflowAutocompleteSuggestions,
} from './workflow-script-api.js';
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
      title: 'Callback',
      items: Object.entries(WORKFLOW_SCRIPT_API.callbacks).map(([name, desc]) => ({ name, desc })),
    },
    {
      title: 'Output Functions',
      items: Object.entries(WORKFLOW_SCRIPT_API.functions)
        .filter(([fn]) => fn.startsWith('emit') || fn.startsWith('drop'))
        .map(([name, desc]) => ({ name, desc })),
    },
    {
      title: 'Frame Type',
      items: Object.entries(WORKFLOW_SCRIPT_API.types).map(([name, type]) => ({
        name,
        desc: type.description,
        fields: Object.entries(type.fields).map(([fname, info]) => ({ name: fname, type: info.type })),
        methods: type.methods ? Object.entries(type.methods).map(([mname, mdesc]) => ({ name: mname, desc: mdesc })) : undefined,
      })),
    },
    {
      title: 'Utility Functions',
      items: Object.entries(WORKFLOW_SCRIPT_API.functions)
        .filter(([fn]) => !fn.startsWith('emit') && !fn.startsWith('drop'))
        .map(([name, desc]) => ({ name, desc })),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

function buildTemplates(): ScriptTemplate[] {
  return WORKFLOW_SCRIPT_TEMPLATES.map(t => ({
    key: t.key,
    name: t.name,
    desc: t.desc,
    code: t.code,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Autocomplete
// ─────────────────────────────────────────────────────────────────────────────

function getWorkflowAutocomplete(context: string, _prefix: string, _fullText: string): AutocompleteSuggestion[] {
  return getWorkflowAutocompleteSuggestions(context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export class WorkflowScriptEditorElement extends HTMLElement {
  private editor: RhaiScriptEditorElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes(): string[] {
    return ['disabled'];
  }

  get script(): string { return this.editor?.script ?? DEFAULT_WORKFLOW_SCRIPT; }
  set script(value: string) { if (this.editor) this.editor.script = value; }

  get disabled(): boolean { return this.editor?.disabled ?? false; }
  set disabled(value: boolean) { if (this.editor) this.editor.disabled = value; }

  attributeChangedCallback(name: string, _old: string, value: string): void {
    if (name === 'disabled' && this.editor) {
      this.editor.disabled = value !== null;
    }
  }

  connectedCallback(): void {
    // Create the unified editor
    this.shadowRoot!.innerHTML = `
      <style>
        :host { display: flex; flex: 1; min-width: 0; min-height: 0; }
        rhai-script-editor { flex: 1; }
      </style>
      <rhai-script-editor></rhai-script-editor>
    `;

    this.editor = this.shadowRoot!.querySelector('rhai-script-editor');

    // Set initial script
    this.editor?.setScript(DEFAULT_WORKFLOW_SCRIPT, true);

    // Configure for workflow use (no file controls, no apply button - modal handles save)
    this.editor?.configure({
      templates: buildTemplates(),
      apiTitle: 'Workflow Script API',
      apiSections: buildApiSections(),
      getAutocompleteSuggestions: getWorkflowAutocomplete,
      showFileControls: false,
      showApplyButton: false,
      showValidateButton: false,
      placeholder: 'Write your workflow script here...',
    });

    // Forward events
    this.editor?.addEventListener('script-change', (e) => {
      this.dispatchEvent(new CustomEvent('script-change', { detail: (e as CustomEvent).detail }));
    });
  }
}

customElements.define('workflow-script-editor', WorkflowScriptEditorElement);
