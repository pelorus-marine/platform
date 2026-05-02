/**
 * Messages list component for displaying CAN messages.
 * Uses light DOM like other shared components.
 */

import type { MessageDto } from './types';
import { formatCanId } from './utils';

export class MessagesListElement extends HTMLElement {
  private messages: MessageDto[] = [];
  private selectedId: number | null = null;
  private selectedIsExtended = false;
  private delegatedHandler: ((e: Event) => void) | null = null;

  constructor() {
    super();
  }

  connectedCallback() {
    this.setupEventDelegation();
  }

  disconnectedCallback() {
    this.removeEventDelegation();
  }

  private setupEventDelegation(): void {
    const wrap = this.querySelector('.cv-table-wrap');
    if (!wrap || this.delegatedHandler) return;

    this.delegatedHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const row = target.closest('tr.clickable') as HTMLElement;
      if (row?.dataset.id) {
        const id = parseInt(row.dataset.id, 10);
        const isExtended = row.dataset.extended === 'true';
        this.dispatchEvent(new CustomEvent('message-select', {
          detail: { id, isExtended },
          bubbles: true,
        }));
      }
    };
    wrap.addEventListener('click', this.delegatedHandler);
  }

  private removeEventDelegation(): void {
    if (!this.delegatedHandler) return;
    const wrap = this.querySelector('.cv-table-wrap');
    if (wrap) {
      wrap.removeEventListener('click', this.delegatedHandler);
    }
    this.delegatedHandler = null;
  }

  setMessages(messages: MessageDto[]) {
    this.messages = messages;
    this.render();
  }

  setSelected(id: number | null, isExtended: boolean) {
    this.selectedId = id;
    this.selectedIsExtended = isExtended;
    this.updateSelection();
  }

  private render() {
    // Find or create table wrap
    let wrap = this.querySelector('.cv-table-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'cv-table-wrap';
      this.appendChild(wrap);
    }

    const rows = this.messages.map((msg) => {
      const isSelected = this.selectedId === msg.id && this.selectedIsExtended === msg.is_extended;
      const idHex = formatCanId(msg.id, msg.is_extended);

      return `
        <tr class="clickable ${isSelected ? 'selected' : ''}"
            data-id="${msg.id}"
            data-extended="${msg.is_extended}">
          <td class="cv-cell-id">${idHex}</td>
          <td class="cv-cell-name">${msg.name || '(unnamed)'}</td>
          <td class="cv-cell-dim">${msg.dlc}</td>
          <td class="cv-cell-dim">${msg.signals.length}</td>
          <td class="cv-cell-dim">${msg.sender}</td>
        </tr>
      `;
    }).join('');

    wrap.innerHTML = `
      <table class="cv-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>DLC</th>
            <th>Signals</th>
            <th>Sender</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Re-setup event delegation after render
    this.removeEventDelegation();
    this.setupEventDelegation();
  }

  private updateSelection() {
    const tbody = this.querySelector('tbody');
    if (!tbody) return;

    tbody.querySelectorAll('tr').forEach(row => {
      const rowId = parseInt((row as HTMLElement).dataset.id || '-1', 10);
      const rowExtended = (row as HTMLElement).dataset.extended === 'true';
      const isSelected = rowId === this.selectedId && rowExtended === this.selectedIsExtended;
      row.classList.toggle('selected', isSelected);
    });
  }
}

customElements.define('cv-messages-list', MessagesListElement);
