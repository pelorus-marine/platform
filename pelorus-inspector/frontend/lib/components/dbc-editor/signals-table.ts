/**
 * Signals table component for displaying signals in a message.
 */

import type { SignalDto } from './types';
import { createEvent } from './utils';
import styles from '../../../styles/pelorus-inspector.css?inline';

export class SignalsTableElement extends HTMLElement {
  private signals: SignalDto[] = [];
  private selectedName: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  setSignals(signals: SignalDto[]) {
    this.signals = signals;
    this.render();
  }

  setSelected(name: string | null) {
    this.selectedName = name;
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;

    const rows = this.signals.map((sig) => {
      const isSelected = this.selectedName === sig.name;
      const byteOrder = sig.byte_order === 'little_endian' ? 'LE' : 'BE';
      const signed = sig.is_unsigned ? '+' : '±';
      const unit = sig.unit || '';
      const mux = sig.is_multiplexer ? 'M' :
                  sig.multiplexer_value !== null ? `m${sig.multiplexer_value}` : '';
      const bits = `${sig.start_bit}:${sig.length}`;
      const range = `${sig.min}…${sig.max}`;

      return `
        <tr class="${isSelected ? 'selected' : ''}" data-name="${sig.name}" title="Factor: ${sig.factor}, Offset: ${sig.offset}">
          <td class="sig-name">${sig.name}</td>
          <td class="sig-mono">${bits}</td>
          <td class="sig-center">${byteOrder}${signed}</td>
          <td class="sig-mono">${range}</td>
          <td>${unit}</td>
          <td class="sig-center">${mux}</td>
        </tr>
      `;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>${styles}
        :host { display: block; }
        .sig-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sig-mono { font-family: var(--cv-font-mono); white-space: nowrap; }
        .sig-center { text-align: center; }
      </style>

      ${this.signals.length === 0 ? `
        <div class="cv-empty-message">No signals defined. Click "Add Signal" to create one.</div>
      ` : `
        <table class="cv-table cv-table-compact">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Bit:Len</th>
              <th>Type</th>
              <th>Range</th>
              <th>Unit</th>
              <th>Mux</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    `;

    // Row click handlers (for selection)
    this.shadowRoot.querySelectorAll('tbody tr').forEach((row) => {
      row.addEventListener('click', () => {
        const name = (row as HTMLElement).dataset.name;
        if (name) {
          this.dispatchEvent(createEvent('signal-select', { name }));
        }
      });
    });
  }
}

customElements.define('cv-signals-table', SignalsTableElement);
