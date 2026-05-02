/**
 * Attributes editor component for managing DBC attributes.
 * Handles BA_DEF_ (definitions), BA_DEF_DEF_ (defaults), and BA_ (values).
 */

import type {
  AttributeDefinitionDto,
  AttributeDefaultDto,
  AttributeValueDto,
  AttributeValueType,
  AttributeTarget,
  MessageDto,
  NodeDto,
} from './types';
import { createEvent } from './utils';
import { escapeHtml } from '../../utils/html';
import { formatCanId } from '../../utils';
import styles from '../../../styles/pelorus-inspector.css?inline';

interface AttributesData {
  definitions: AttributeDefinitionDto[];
  defaults: AttributeDefaultDto[];
  values: AttributeValueDto[];
}

export class AttributesEditorElement extends HTMLElement {
  private definitions: AttributeDefinitionDto[] = [];
  private defaults: AttributeDefaultDto[] = [];
  private values: AttributeValueDto[] = [];
  private messages: MessageDto[] = [];
  private nodes: NodeDto[] = [];
  private activeSubtab: 'definitions' | 'defaults' | 'values' = 'definitions';
  private addingDef = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  setData(data: AttributesData) {
    this.definitions = data.definitions.map(d => ({ ...d, value_type: { ...d.value_type } }));
    this.defaults = data.defaults.map(d => ({ ...d }));
    this.values = data.values.map(v => ({ ...v, target: { ...v.target } }));
    this.render();
  }

  setMessages(messages: MessageDto[]) {
    this.messages = messages;
  }

  setNodes(nodes: NodeDto[]) {
    this.nodes = nodes;
  }

  getData(): AttributesData {
    return {
      definitions: this.definitions,
      defaults: this.defaults,
      values: this.values,
    };
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>${styles}
        :host { display: block; }
        .cv-attr-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--cv-border);
          padding-bottom: 8px;
        }
        .cv-attr-tab {
          padding: 6px 12px;
          background: none;
          border: 1px solid transparent;
          border-radius: var(--cv-radius) var(--cv-radius) 0 0;
          cursor: pointer;
          color: var(--cv-text-muted);
          font-size: 0.9rem;
        }
        .cv-attr-tab:hover {
          color: var(--cv-text);
        }
        .cv-attr-tab.active {
          color: var(--cv-accent);
          border-color: var(--cv-border);
          border-bottom-color: var(--cv-bg);
          background: var(--cv-bg);
        }
        .cv-attr-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        .cv-attr-item {
          padding: 10px 12px;
          background: var(--cv-bg-elevated);
          border: 1px solid var(--cv-border);
          border-radius: var(--cv-radius);
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .cv-attr-item:hover {
          border-color: var(--cv-accent);
        }
        .cv-attr-item.editing {
          cursor: default;
          border-color: var(--cv-accent);
        }
        .cv-attr-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cv-attr-name {
          font-weight: 600;
          color: var(--cv-text);
        }
        .cv-attr-type {
          font-size: 0.8rem;
          padding: 2px 6px;
          background: var(--cv-bg);
          border-radius: 4px;
          color: var(--cv-text-muted);
        }
        .cv-attr-meta {
          font-size: 0.85rem;
          color: var(--cv-text-muted);
          margin-top: 4px;
        }
        .cv-attr-form {
          display: grid;
          gap: 12px;
          margin-top: 12px;
        }
        .cv-attr-form-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .cv-attr-form-row .cv-form-group {
          flex: 1;
          min-width: 120px;
        }
        .cv-btn-icon {
          background: none;
          border: none;
          color: var(--cv-text-muted);
          cursor: pointer;
          font-size: 1.2rem;
          padding: 2px 6px;
          line-height: 1;
          margin-left: auto;
        }
        .cv-btn-icon:hover {
          color: var(--cv-danger);
        }
      </style>

      <div class="cv-attr-tabs">
        <button class="cv-attr-tab ${this.activeSubtab === 'definitions' ? 'active' : ''}" data-tab="definitions">
          Definitions (${this.definitions.length})
        </button>
        <button class="cv-attr-tab ${this.activeSubtab === 'defaults' ? 'active' : ''}" data-tab="defaults">
          Defaults (${this.defaults.length})
        </button>
        <button class="cv-attr-tab ${this.activeSubtab === 'values' ? 'active' : ''}" data-tab="values">
          Values (${this.values.length})
        </button>
      </div>

      ${this.activeSubtab === 'definitions' ? this.renderDefinitions() : ''}
      ${this.activeSubtab === 'defaults' ? this.renderDefaults() : ''}
      ${this.activeSubtab === 'values' ? this.renderValues() : ''}
    `;

    this.setupEventListeners();
  }

  private renderDefinitions(): string {
    const items = this.definitions.map(def => {
      const typeLabel = this.getTypeLabel(def.value_type);
      return `
        <div class="cv-attr-item" data-def="${escapeHtml(def.name)}">
          <div class="cv-attr-header">
            <span class="cv-attr-name">${escapeHtml(def.name)}</span>
            <span class="cv-attr-type">${escapeHtml(def.object_type)}</span>
            <span class="cv-attr-type">${escapeHtml(typeLabel)}</span>
            <button class="cv-btn-icon" data-delete-def="${escapeHtml(def.name)}">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${this.definitions.length === 0 ? `
        <p class="cv-empty-message" style="font-style: italic; margin-bottom: 12px;">
          No attribute definitions. Attribute definitions specify what attributes can be used.
        </p>
      ` : `
        <div class="cv-attr-list">${items}</div>
      `}

      ${this.addingDef ? this.renderAddDefForm() : `
        <button class="cv-btn primary" id="add-def-btn">Add Definition</button>
      `}
    `;
  }

  private renderAddDefForm(): string {
    return `
      <div class="cv-attr-item editing">
        <div class="cv-attr-form">
          <div class="cv-attr-form-row">
            <div class="cv-form-group">
              <label class="cv-label">Name</label>
              <input type="text" class="cv-input" id="new-def-name" placeholder="e.g., GenMsgCycleTime">
            </div>
            <div class="cv-form-group">
              <label class="cv-label">Object Type</label>
              <select class="cv-select" id="new-def-object">
                <option value="network">Network</option>
                <option value="node">Node</option>
                <option value="message">Message</option>
                <option value="signal">Signal</option>
              </select>
            </div>
          </div>
          <div class="cv-attr-form-row">
            <div class="cv-form-group">
              <label class="cv-label">Value Type</label>
              <select class="cv-select" id="new-def-type">
                <option value="int">Integer</option>
                <option value="float">Float</option>
                <option value="string">String</option>
                <option value="enum">Enum</option>
                <option value="hex">Hex</option>
              </select>
            </div>
            <div class="cv-form-group" id="new-def-min-group">
              <label class="cv-label">Min</label>
              <input type="number" class="cv-input" id="new-def-min" value="0">
            </div>
            <div class="cv-form-group" id="new-def-max-group">
              <label class="cv-label">Max</label>
              <input type="number" class="cv-input" id="new-def-max" value="65535">
            </div>
          </div>
          <div class="cv-form-group" id="new-def-enum-group" style="display: none;">
            <label class="cv-label">Enum Values (comma-separated)</label>
            <input type="text" class="cv-input" id="new-def-enum" placeholder="e.g., Off,On,Auto">
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="cv-btn small success" id="save-def-btn">Create</button>
            <button class="cv-btn small" id="cancel-def-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDefaults(): string {
    const items = this.defaults.map(def => {
      return `
        <div class="cv-attr-item" data-default="${escapeHtml(def.name)}">
          <div class="cv-attr-header">
            <span class="cv-attr-name">${escapeHtml(def.name)}</span>
            <span class="cv-attr-type">= ${escapeHtml(String(def.value))}</span>
            <button class="cv-btn-icon" data-delete-default="${escapeHtml(def.name)}">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    const availableAttrs = this.definitions.filter(
      d => !this.defaults.some(def => def.name === d.name)
    );

    return `
      ${this.defaults.length === 0 ? `
        <p class="cv-empty-message" style="font-style: italic; margin-bottom: 12px;">
          No attribute defaults. Defaults are used when an attribute is not explicitly set.
        </p>
      ` : `
        <div class="cv-attr-list">${items}</div>
      `}

      <div style="display: flex; gap: 8px; align-items: end; flex-wrap: wrap;">
        <div class="cv-form-group" style="flex: 1; min-width: 150px;">
          <label class="cv-label">Attribute</label>
          <select class="cv-select" id="add-default-attr">
            <option value="">Select attribute...</option>
            ${availableAttrs.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="cv-form-group" style="flex: 1; min-width: 100px;">
          <label class="cv-label">Default Value</label>
          <input type="text" class="cv-input" id="add-default-value" placeholder="Value">
        </div>
        <button class="cv-btn primary" id="add-default-btn">Add Default</button>
      </div>
    `;
  }

  private renderValues(): string {
    const items = this.values.map((val, i) => {
      const targetLabel = this.getTargetLabel(val.target);
      return `
        <div class="cv-attr-item" data-value-index="${i}">
          <div class="cv-attr-header">
            <span class="cv-attr-name">${escapeHtml(val.name)}</span>
            <span class="cv-attr-type">${escapeHtml(targetLabel)}</span>
            <span class="cv-attr-type">= ${escapeHtml(String(val.value))}</span>
            <button class="cv-btn-icon" data-delete-value="${i}">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${this.values.length === 0 ? `
        <p class="cv-empty-message" style="font-style: italic; margin-bottom: 12px;">
          No attribute values assigned. Values assign attributes to specific objects.
        </p>
      ` : `
        <div class="cv-attr-list">${items}</div>
      `}

      <div style="display: flex; gap: 8px; align-items: end; flex-wrap: wrap;">
        <div class="cv-form-group" style="flex: 1; min-width: 120px;">
          <label class="cv-label">Attribute</label>
          <select class="cv-select" id="add-value-attr">
            <option value="">Select...</option>
            ${this.definitions.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)} (${d.object_type})</option>`).join('')}
          </select>
        </div>
        <div class="cv-form-group" style="flex: 1; min-width: 120px;" id="add-value-target-group">
          <label class="cv-label">Target</label>
          <select class="cv-select" id="add-value-target">
            <option value="">Select attribute first</option>
          </select>
        </div>
        <div class="cv-form-group" style="flex: 1; min-width: 80px;">
          <label class="cv-label">Value</label>
          <input type="text" class="cv-input" id="add-value-value" placeholder="Value">
        </div>
        <button class="cv-btn primary" id="add-value-btn">Add Value</button>
      </div>
    `;
  }

  private getTypeLabel(type: AttributeValueType): string {
    switch (type.type) {
      case 'int':
        return `int [${type.min}, ${type.max}]`;
      case 'float':
        return `float [${type.min}, ${type.max}]`;
      case 'hex':
        return `hex [${type.min}, ${type.max}]`;
      case 'string':
        return 'string';
      case 'enum':
        return `enum (${type.values.join(', ')})`;
      default:
        return 'unknown';
    }
  }

  private getTargetLabel(target: AttributeTarget): string {
    switch (target.type) {
      case 'network':
        return 'Network';
      case 'node':
        return `Node: ${target.node_name}`;
      case 'message':
        return `Message: ${formatCanId(target.message_id, false)}`;
      case 'signal': {
        const msg = this.messages.find(m => m.id === target.message_id);
        const msgName = msg?.name || formatCanId(target.message_id, false);
        return `Signal: ${target.signal_name} (${msgName})`;
      }
      default:
        return 'Unknown';
    }
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    // Tab switching
    this.shadowRoot.querySelectorAll('.cv-attr-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeSubtab = (tab as HTMLElement).dataset.tab as typeof this.activeSubtab;
        this.render();
      });
    });

    // Definitions
    this.shadowRoot.getElementById('add-def-btn')?.addEventListener('click', () => {
      this.addingDef = true;
      this.render();
    });

    this.shadowRoot.getElementById('cancel-def-btn')?.addEventListener('click', () => {
      this.addingDef = false;
      this.render();
    });

    this.shadowRoot.getElementById('save-def-btn')?.addEventListener('click', () => {
      this.handleSaveDefinition();
    });

    this.shadowRoot.querySelectorAll('[data-delete-def]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = (btn as HTMLElement).dataset.deleteDef;
        if (name) {
          this.definitions = this.definitions.filter(d => d.name !== name);
          // Also remove related defaults and values
          this.defaults = this.defaults.filter(d => d.name !== name);
          this.values = this.values.filter(v => v.name !== name);
          this.notifyChange();
          this.render();
        }
      });
    });

    // Type change handler for definition form
    const typeSelect = this.shadowRoot.getElementById('new-def-type') as HTMLSelectElement;
    typeSelect?.addEventListener('change', () => {
      const minGroup = this.shadowRoot!.getElementById('new-def-min-group');
      const maxGroup = this.shadowRoot!.getElementById('new-def-max-group');
      const enumGroup = this.shadowRoot!.getElementById('new-def-enum-group');

      if (typeSelect.value === 'enum') {
        minGroup!.style.display = 'none';
        maxGroup!.style.display = 'none';
        enumGroup!.style.display = 'block';
      } else if (typeSelect.value === 'string') {
        minGroup!.style.display = 'none';
        maxGroup!.style.display = 'none';
        enumGroup!.style.display = 'none';
      } else {
        minGroup!.style.display = 'block';
        maxGroup!.style.display = 'block';
        enumGroup!.style.display = 'none';
      }
    });

    // Defaults
    this.shadowRoot.getElementById('add-default-btn')?.addEventListener('click', () => {
      this.handleAddDefault();
    });

    this.shadowRoot.querySelectorAll('[data-delete-default]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = (btn as HTMLElement).dataset.deleteDefault;
        if (name) {
          this.defaults = this.defaults.filter(d => d.name !== name);
          this.notifyChange();
          this.render();
        }
      });
    });

    // Values
    this.shadowRoot.getElementById('add-value-btn')?.addEventListener('click', () => {
      this.handleAddValue();
    });

    this.shadowRoot.querySelectorAll('[data-delete-value]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt((btn as HTMLElement).dataset.deleteValue || '0');
        this.values.splice(index, 1);
        this.notifyChange();
        this.render();
      });
    });

    // Attribute select change - update target options
    const attrSelect = this.shadowRoot.getElementById('add-value-attr') as HTMLSelectElement;
    attrSelect?.addEventListener('change', () => {
      this.updateTargetOptions(attrSelect.value);
    });
  }

  private updateTargetOptions(attrName: string) {
    const targetSelect = this.shadowRoot!.getElementById('add-value-target') as HTMLSelectElement;
    if (!targetSelect) return;

    const def = this.definitions.find(d => d.name === attrName);
    if (!def) {
      targetSelect.innerHTML = '<option value="">Select attribute first</option>';
      return;
    }

    let options = '';
    switch (def.object_type) {
      case 'network':
        options = '<option value="network">Network</option>';
        break;
      case 'node':
        options = this.nodes.map(n => `<option value="node:${escapeHtml(n.name)}">${escapeHtml(n.name)}</option>`).join('');
        break;
      case 'message':
        options = this.messages.map(m => `<option value="message:${m.id}">${escapeHtml(m.name)} (${formatCanId(m.id, m.is_extended)})</option>`).join('');
        break;
      case 'signal':
        for (const msg of this.messages) {
          for (const sig of msg.signals) {
            options += `<option value="signal:${msg.id}:${escapeHtml(sig.name)}">${escapeHtml(sig.name)} (${escapeHtml(msg.name)})</option>`;
          }
        }
        break;
    }

    targetSelect.innerHTML = options || '<option value="">No targets available</option>';
  }

  private handleSaveDefinition() {
    const name = (this.shadowRoot!.getElementById('new-def-name') as HTMLInputElement).value.trim();
    const objectType = (this.shadowRoot!.getElementById('new-def-object') as HTMLSelectElement).value as 'network' | 'node' | 'message' | 'signal';
    const valueTypeStr = (this.shadowRoot!.getElementById('new-def-type') as HTMLSelectElement).value;

    if (!name) {
      alert('Name is required');
      return;
    }

    if (this.definitions.some(d => d.name === name)) {
      alert('An attribute with this name already exists');
      return;
    }

    let valueType: AttributeValueType;
    if (valueTypeStr === 'int' || valueTypeStr === 'hex') {
      const min = parseInt((this.shadowRoot!.getElementById('new-def-min') as HTMLInputElement).value) || 0;
      const max = parseInt((this.shadowRoot!.getElementById('new-def-max') as HTMLInputElement).value) || 65535;
      valueType = { type: valueTypeStr, min, max };
    } else if (valueTypeStr === 'float') {
      const min = parseFloat((this.shadowRoot!.getElementById('new-def-min') as HTMLInputElement).value) || 0;
      const max = parseFloat((this.shadowRoot!.getElementById('new-def-max') as HTMLInputElement).value) || 1000;
      valueType = { type: 'float', min, max };
    } else if (valueTypeStr === 'enum') {
      const enumStr = (this.shadowRoot!.getElementById('new-def-enum') as HTMLInputElement).value;
      const values = enumStr.split(',').map(v => v.trim()).filter(v => v);
      if (values.length === 0) {
        alert('Enum requires at least one value');
        return;
      }
      valueType = { type: 'enum', values };
    } else {
      valueType = { type: 'string' };
    }

    this.definitions.push({
      name,
      object_type: objectType,
      value_type: valueType,
    });

    this.addingDef = false;
    this.notifyChange();
    this.render();
  }

  private handleAddDefault() {
    const attrSelect = this.shadowRoot!.getElementById('add-default-attr') as HTMLSelectElement;
    const valueInput = this.shadowRoot!.getElementById('add-default-value') as HTMLInputElement;

    if (!attrSelect.value || !valueInput.value) {
      alert('Please select an attribute and enter a value');
      return;
    }

    const def = this.definitions.find(d => d.name === attrSelect.value);
    let value: string | number = valueInput.value;

    // Convert to number if appropriate
    if (def && (def.value_type.type === 'int' || def.value_type.type === 'hex')) {
      value = parseInt(value) || 0;
    } else if (def && def.value_type.type === 'float') {
      value = parseFloat(value) || 0;
    }

    this.defaults.push({
      name: attrSelect.value,
      value,
    });

    this.notifyChange();
    this.render();
  }

  private handleAddValue() {
    const attrSelect = this.shadowRoot!.getElementById('add-value-attr') as HTMLSelectElement;
    const targetSelect = this.shadowRoot!.getElementById('add-value-target') as HTMLSelectElement;
    const valueInput = this.shadowRoot!.getElementById('add-value-value') as HTMLInputElement;

    if (!attrSelect.value || !targetSelect.value || !valueInput.value) {
      alert('Please fill in all fields');
      return;
    }

    let target: AttributeTarget;
    const targetValue = targetSelect.value;

    if (targetValue === 'network') {
      target = { type: 'network' };
    } else if (targetValue.startsWith('node:')) {
      target = { type: 'node', node_name: targetValue.substring(5) };
    } else if (targetValue.startsWith('message:')) {
      target = { type: 'message', message_id: parseInt(targetValue.substring(8)) };
    } else if (targetValue.startsWith('signal:')) {
      const parts = targetValue.substring(7).split(':');
      target = { type: 'signal', message_id: parseInt(parts[0]), signal_name: parts[1] };
    } else {
      alert('Invalid target');
      return;
    }

    const def = this.definitions.find(d => d.name === attrSelect.value);
    let value: string | number = valueInput.value;

    // Convert to number if appropriate
    if (def && (def.value_type.type === 'int' || def.value_type.type === 'hex')) {
      value = parseInt(value) || 0;
    } else if (def && def.value_type.type === 'float') {
      value = parseFloat(value) || 0;
    }

    this.values.push({
      name: attrSelect.value,
      target,
      value,
    });

    this.notifyChange();
    this.render();
  }

  private notifyChange() {
    this.dispatchEvent(createEvent('attributes-change', {
      definitions: this.definitions,
      defaults: this.defaults,
      values: this.values,
    }));
  }
}

customElements.define('cv-attributes-editor', AttributesEditorElement);
