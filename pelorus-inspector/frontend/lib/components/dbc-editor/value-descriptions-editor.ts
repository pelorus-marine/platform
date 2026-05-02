/**
 * Value Descriptions editor component for managing VAL_ entries.
 * Allows editing value-to-text mappings for signals.
 *
 * Workflow:
 * 1. Click "+ New" and select a signal to create a value description entry
 * 2. Add value->description pairs within each entry's box
 */

import type { SignalValueDescriptions, MessageDto } from './types';
import { createEvent } from './utils';
import { escapeHtml } from '../../utils/html';
import { formatCanId } from '../../utils';
import styles from '../../../styles/pelorus-inspector.css?inline';

export class ValueDescriptionsEditorElement extends HTMLElement {
  private valueDescriptions: SignalValueDescriptions[] = [];
  private messages: MessageDto[] = [];
  private expandedKey: string | null = null;
  private availableSignals: { messageId: number; signalName: string; messageName: string }[] = [];
  private showingCreateForm = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  setValueDescriptions(valueDescriptions: SignalValueDescriptions[]) {
    this.valueDescriptions = valueDescriptions.map(vd => ({
      ...vd,
      descriptions: vd.descriptions.map(d => ({ ...d })),
    }));
    this.render();
  }

  setMessages(messages: MessageDto[]) {
    this.messages = messages;
    this.render();
  }

  getValueDescriptions(): SignalValueDescriptions[] {
    return this.valueDescriptions;
  }

  private getKey(vd: SignalValueDescriptions): string {
    return `${vd.message_id}:${vd.signal_name}`;
  }

  private render() {
    if (!this.shadowRoot) return;

    this.availableSignals = this.getAvailableSignals();

    const items = this.valueDescriptions.map(vd => {
      const key = this.getKey(vd);
      const isExpanded = this.expandedKey === key;
      const msg = this.messages.find(m => m.id === vd.message_id);
      const msgName = msg?.name || formatCanId(vd.message_id, false);

      return `
        <div class="cv-vd-item ${isExpanded ? 'expanded' : ''}" data-key="${key}">
          <div class="cv-vd-header" data-toggle="${key}">
            <span class="cv-vd-expand">${isExpanded ? '▼' : '▶'}</span>
            <span class="cv-vd-signal">${escapeHtml(vd.signal_name)}</span>
            <span class="cv-vd-message">${escapeHtml(msgName)}</span>
            <span class="cv-vd-count">${vd.descriptions.length} value${vd.descriptions.length !== 1 ? 's' : ''}</span>
            <button class="cv-btn-icon delete-btn" data-delete="${key}" title="Delete">&times;</button>
          </div>
          ${isExpanded ? this.renderEntries(vd, key) : this.renderChips(vd)}
        </div>
      `;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>${styles}
        :host { display: block; }
        .cv-vd-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cv-vd-item {
          background: var(--cv-bg-elevated);
          border: 1px solid var(--cv-border);
          border-radius: var(--cv-radius);
          overflow: hidden;
        }
        .cv-vd-item.expanded {
          border-color: var(--cv-accent);
        }
        .cv-vd-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          user-select: none;
        }
        .cv-vd-header:hover {
          background: var(--cv-bg-hover);
        }
        .cv-vd-expand {
          font-size: 0.7rem;
          color: var(--cv-text-muted);
          width: 12px;
        }
        .cv-vd-signal {
          font-weight: 600;
          color: var(--cv-text);
        }
        .cv-vd-message {
          font-size: 0.85rem;
          color: var(--cv-text-muted);
        }
        .cv-vd-count {
          font-size: 0.8rem;
          color: var(--cv-text-muted);
          margin-left: auto;
          margin-right: 8px;
        }
        .cv-vd-chips {
          padding: 0 12px 10px 32px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .cv-vd-chip {
          padding: 2px 8px;
          background: var(--cv-bg);
          border: 1px solid var(--cv-border);
          border-radius: 12px;
          font-size: 0.8rem;
          font-family: var(--cv-font-mono);
        }
        .cv-vd-entries {
          padding: 12px;
          padding-left: 32px;
          border-top: 1px solid var(--cv-border);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cv-vd-entry {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .cv-vd-entry input.value-input {
          width: 80px;
          flex-shrink: 0;
        }
        .cv-vd-entry input.desc-input {
          flex: 1;
        }
        .cv-vd-add-entry {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed var(--cv-border);
        }
        .cv-vd-add-entry input.value-input {
          width: 80px;
          flex-shrink: 0;
        }
        .cv-vd-add-entry input.desc-input {
          flex: 1;
        }
        .cv-btn-icon {
          background: none;
          border: none;
          color: var(--cv-text-muted);
          cursor: pointer;
          font-size: 1.1rem;
          padding: 2px 6px;
          line-height: 1;
          border-radius: 4px;
        }
        .cv-btn-icon:hover {
          background: var(--cv-danger);
          color: white;
        }
        .cv-vd-footer {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--cv-border);
        }
        .cv-vd-create-inline {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .cv-vd-create-inline select {
          flex: 1;
          max-width: 300px;
        }
      </style>

      ${this.valueDescriptions.length > 0 ? `
        <div class="cv-vd-list">${items}</div>
      ` : `
        <p style="color: var(--cv-text-muted); font-style: italic; margin: 0 0 12px 0;">
          No value descriptions defined.
        </p>
      `}

      <div class="cv-vd-footer">
        ${this.showingCreateForm ? `
          <div class="cv-vd-create-inline">
            <select class="cv-select" id="signal-select">
              <option value="">Select signal...</option>
              ${this.availableSignals.map((s, idx) => `
                <option value="${idx}">${escapeHtml(s.signalName)} (${escapeHtml(s.messageName)})</option>
              `).join('')}
            </select>
            <button class="cv-btn primary small" id="confirm-create-btn">Create</button>
            <button class="cv-btn small" id="cancel-create-btn">Cancel</button>
          </div>
        ` : `
          <button class="cv-btn primary" id="new-btn" ${this.availableSignals.length === 0 ? 'disabled title="All signals already have value descriptions"' : ''}>
            + New Value Description
          </button>
        `}
      </div>
    `;

    this.setupEventListeners();
  }

  private renderChips(vd: SignalValueDescriptions): string {
    if (vd.descriptions.length === 0) {
      return `<div class="cv-vd-chips"><em style="color: var(--cv-text-muted); font-size: 0.85rem;">Click to add values</em></div>`;
    }
    const maxShow = 5;
    const chips = vd.descriptions.slice(0, maxShow).map(d =>
      `<span class="cv-vd-chip">${d.value} = ${escapeHtml(d.description)}</span>`
    ).join('');
    const more = vd.descriptions.length > maxShow
      ? `<span class="cv-vd-chip">+${vd.descriptions.length - maxShow} more</span>`
      : '';
    return `<div class="cv-vd-chips">${chips}${more}</div>`;
  }

  private renderEntries(vd: SignalValueDescriptions, key: string): string {
    const entries = vd.descriptions.map((d, i) => `
      <div class="cv-vd-entry">
        <input type="number" class="cv-input value-input" data-key="${key}" data-idx="${i}" value="${d.value}">
        <span>=</span>
        <input type="text" class="cv-input desc-input" data-key="${key}" data-idx="${i}" value="${escapeHtml(d.description)}">
        <button class="cv-btn-icon remove-btn" data-key="${key}" data-idx="${i}" title="Remove">&times;</button>
      </div>
    `).join('');

    return `
      <div class="cv-vd-entries">
        ${entries || '<em style="color: var(--cv-text-muted);">No values yet</em>'}
        <div class="cv-vd-add-entry">
          <input type="number" class="cv-input value-input" id="add-value-${key}" placeholder="Value">
          <span>=</span>
          <input type="text" class="cv-input desc-input" id="add-desc-${key}" placeholder="Description">
          <button class="cv-btn small primary add-btn" data-key="${key}">Add</button>
        </div>
      </div>
    `;
  }

  private getAvailableSignals(): { messageId: number; signalName: string; messageName: string }[] {
    const signals: { messageId: number; signalName: string; messageName: string }[] = [];
    for (const msg of this.messages) {
      for (const sig of msg.signals) {
        const exists = this.valueDescriptions.some(
          vd => vd.message_id === msg.id && vd.signal_name === sig.name
        );
        if (!exists) {
          signals.push({
            messageId: msg.id,
            signalName: sig.name,
            messageName: msg.name,
          });
        }
      }
    }
    return signals;
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    // Toggle expand/collapse
    this.shadowRoot.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.cv-btn-icon')) return;
        const key = (el as HTMLElement).dataset.toggle!;
        this.expandedKey = this.expandedKey === key ? null : key;
        this.render();
      });
    });

    // Delete entire value description
    this.shadowRoot.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = (btn as HTMLElement).dataset.delete!;
        const [msgId, sigName] = this.parseKey(key);
        this.valueDescriptions = this.valueDescriptions.filter(
          vd => !(vd.message_id === msgId && vd.signal_name === sigName)
        );
        if (this.expandedKey === key) this.expandedKey = null;
        this.notifyChange();
        this.render();
      });
    });

    // Show create form
    this.shadowRoot.getElementById('new-btn')?.addEventListener('click', () => {
      this.showingCreateForm = true;
      this.render();
    });

    // Cancel create
    this.shadowRoot.getElementById('cancel-create-btn')?.addEventListener('click', () => {
      this.showingCreateForm = false;
      this.render();
    });

    // Confirm create
    this.shadowRoot.getElementById('confirm-create-btn')?.addEventListener('click', () => {
      const select = this.shadowRoot!.getElementById('signal-select') as HTMLSelectElement;
      if (select.value === '') {
        alert('Please select a signal');
        return;
      }
      const signal = this.availableSignals[parseInt(select.value)];
      if (!signal) return;

      const newVd: SignalValueDescriptions = {
        message_id: signal.messageId,
        signal_name: signal.signalName,
        descriptions: [],
      };
      this.valueDescriptions.push(newVd);
      this.expandedKey = this.getKey(newVd);
      this.showingCreateForm = false;
      this.notifyChange();
      this.render();
    });

    // Add entry
    this.shadowRoot.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.key!;
        const valueInput = this.shadowRoot!.getElementById(`add-value-${key}`) as HTMLInputElement;
        const descInput = this.shadowRoot!.getElementById(`add-desc-${key}`) as HTMLInputElement;

        if (!valueInput.value || !descInput.value.trim()) return;

        const [msgId, sigName] = this.parseKey(key);
        const vd = this.valueDescriptions.find(
          v => v.message_id === msgId && v.signal_name === sigName
        );
        if (vd) {
          vd.descriptions.push({
            value: parseInt(valueInput.value),
            description: descInput.value.trim(),
          });
          this.notifyChange();
          this.render();
        }
      });
    });

    // Remove entry
    this.shadowRoot.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.key!;
        const idx = parseInt((btn as HTMLElement).dataset.idx!);
        const [msgId, sigName] = this.parseKey(key);
        const vd = this.valueDescriptions.find(
          v => v.message_id === msgId && v.signal_name === sigName
        );
        if (vd) {
          vd.descriptions.splice(idx, 1);
          this.notifyChange();
          this.render();
        }
      });
    });

    // Update on input change
    this.shadowRoot.querySelectorAll('.cv-vd-entry input').forEach(input => {
      input.addEventListener('change', () => {
        const key = (input as HTMLElement).dataset.key!;
        const idx = parseInt((input as HTMLElement).dataset.idx!);
        const [msgId, sigName] = this.parseKey(key);
        const vd = this.valueDescriptions.find(
          v => v.message_id === msgId && v.signal_name === sigName
        );
        if (vd && vd.descriptions[idx]) {
          if (input.classList.contains('value-input')) {
            vd.descriptions[idx].value = parseInt((input as HTMLInputElement).value);
          } else {
            vd.descriptions[idx].description = (input as HTMLInputElement).value.trim();
          }
          this.notifyChange();
        }
      });
    });
  }

  private parseKey(key: string): [number, string] {
    const colonIdx = key.indexOf(':');
    return [parseInt(key.substring(0, colonIdx)), key.substring(colonIdx + 1)];
  }

  private notifyChange() {
    this.dispatchEvent(createEvent('value-descriptions-change', { valueDescriptions: this.valueDescriptions }));
  }
}

customElements.define('cv-value-descriptions-editor', ValueDescriptionsEditorElement);
