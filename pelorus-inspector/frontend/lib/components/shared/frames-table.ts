import type { CanFrame } from '../../types';
import { formatCanId, formatDataHex, formatFlags, formatTimestamp } from '../../utils';
import { escapeHtml } from '../../utils/html';

/** Maximum frames to render in the table for performance */
const MAX_DISPLAYED_FRAMES = 500;

/** Message info returned by lookup */
export interface MessageLookupResult {
  name: string;
  comment?: string;
}

/** Frames table component */
export class FramesTableElement extends HTMLElement {
  private frames: CanFrame[] = [];
  private selectedIndex: number | null = null;
  private messageInfoLookup: (canId: number) => MessageLookupResult = () => ({ name: '-' });
  private delegatedHandler: ((e: Event) => void) | null = null;

  constructor() {
    super();
  }

  connectedCallback(): void {
    this.setupEventDelegation();
  }

  disconnectedCallback(): void {
    this.removeEventDelegation();
  }

  private setupEventDelegation(): void {
    const tbody = this.querySelector('tbody');
    if (!tbody || this.delegatedHandler) return;

    this.delegatedHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const row = target.closest('tr.clickable') as HTMLElement;
      if (row?.dataset.index) {
        this.selectFrame(parseInt(row.dataset.index, 10));
      }
    };
    tbody.addEventListener('click', this.delegatedHandler);
  }

  private removeEventDelegation(): void {
    if (!this.delegatedHandler) return;
    const tbody = this.querySelector('tbody');
    if (tbody) {
      tbody.removeEventListener('click', this.delegatedHandler);
    }
    this.delegatedHandler = null;
  }

  /** Set the message name lookup function (legacy - returns string) */
  setMessageNameLookup(fn: (canId: number) => string): void {
    this.messageInfoLookup = (canId) => ({ name: fn(canId) });
  }

  /** Set the message info lookup function (returns name + optional comment) */
  setMessageInfoLookup(fn: (canId: number) => MessageLookupResult): void {
    this.messageInfoLookup = fn;
  }

  /** Update frames and re-render */
  setFrames(frames: CanFrame[]): void {
    this.frames = frames;
    this.render();
  }

  /** Get current frame count */
  get frameCount(): number {
    return this.frames.length;
  }

  /** Clear selection */
  clearSelection(): void {
    this.selectedIndex = null;
    this.updateSelection();
  }

  private render(): void {
    const tbody = this.querySelector('tbody');
    if (!tbody) return;

    // Only render the last N frames for performance
    const startIdx = Math.max(0, this.frames.length - MAX_DISPLAYED_FRAMES);
    const displayedFrames = this.frames.slice(startIdx);

    tbody.innerHTML = displayedFrames.map((frame, displayIdx) => {
      const actualIdx = startIdx + displayIdx;
      const msgInfo = this.messageInfoLookup(frame.can_id);
      const hasMatch = msgInfo.name !== '-';
      const classes = ['clickable', actualIdx === this.selectedIndex ? 'selected' : '', hasMatch ? 'matched' : ''].filter(Boolean).join(' ');
      const msgTitle = msgInfo.comment ? escapeHtml(msgInfo.comment) : '';
      return `
      <tr class="${classes}" data-index="${actualIdx}">
        <td class="cv-cell-dim">${formatTimestamp(frame.timestamp)}</td>
        <td>${frame.channel}</td>
        <td class="cv-cell-id" title="${frame.can_id}">${formatCanId(frame.can_id, frame.is_extended)}</td>
        <td class="${hasMatch ? 'cv-cell-name' : 'cv-cell-nomatch'}"${msgTitle ? ` title="${msgTitle}"` : ''}>${msgInfo.name}</td>
        <td>${frame.dlc}</td>
        <td class="cv-cell-data">${formatDataHex(frame.data)}</td>
        <td>${formatFlags(frame)}</td>
      </tr>
    `;
    }).join('');

    // Ensure event delegation is set up (in case tbody was recreated)
    if (!this.delegatedHandler) {
      this.setupEventDelegation();
    }
  }

  private selectFrame(index: number): void {
    this.selectedIndex = index;
    this.updateSelection();

    const frame = this.frames[index];
    if (frame) {
      this.dispatchEvent(new CustomEvent('frame-selected', {
        detail: { frame, index },
        bubbles: true,
      }));
    }
  }

  private updateSelection(): void {
    const tbody = this.querySelector('tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => {
        const rowIdx = parseInt((row as HTMLElement).dataset.index || '-1', 10);
        row.classList.toggle('selected', rowIdx === this.selectedIndex);
      });
    }
  }
}

customElements.define('cv-frames-table', FramesTableElement);
