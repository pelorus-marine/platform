/**
 * Message editor component for editing a CAN message.
 */

import type { MessageDto, SignalDto } from './types';
import type { CanFrame } from '../../types';
import { createDefaultMessage, createDefaultSignal } from './types';
import { detectDlcFromFrames } from '../../utils';
import { escapeHtml } from '../../utils/html';
import { deepClone, getSignalColor, getLinearBitPosition, getSliderConstraints } from './utils';
import styles from '../../../styles/pelorus-inspector.css?inline';
import './signals-table';
import './signal-editor';
import type { SignalsTableElement } from './signals-table';
import type { SignalEditorElement } from './signal-editor';

export class MessageEditorElement extends HTMLElement {
  private message: MessageDto = createDefaultMessage();
  private originalMessage: MessageDto = createDefaultMessage();
  private availableNodes: string[] = [];
  private frames: CanFrame[] = [];
  private selectedSignal: string | null = null;
  private editingSignal: SignalDto | null = null;
  private isAddingSignal = false;
  private isEditingSignal = false;
  private isEditingMessage = false;
  private isNewMessage = false;
  private parentEditMode = false;

  static get observedAttributes() {
    return ['data-edit-mode'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.parentEditMode = this.dataset.editMode === 'true';
    this.render();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === 'data-edit-mode' && oldValue !== newValue) {
      this.parentEditMode = newValue === 'true';
      this.render();
    }
  }

  setMessage(message: MessageDto | null, isNew: boolean) {
    this.message = message ? deepClone(message) : createDefaultMessage();
    this.originalMessage = deepClone(this.message);
    this.selectedSignal = null;
    this.editingSignal = null;
    this.isAddingSignal = false;
    this.isNewMessage = isNew;
    this.isEditingMessage = isNew;
    this.render();
  }

  setAvailableNodes(nodes: string[]) {
    this.availableNodes = nodes;
    this.render();
  }

  setFrames(frames: CanFrame[]) {
    this.frames = frames;
  }

  getMessage(): MessageDto {
    return this.message;
  }

  isInEditMode(): boolean {
    return this.isEditingMessage;
  }

  private renderMessageViewMode(idHex: string): string {
    const idDecimal = this.message.id;
    return `
      <div class="cv-card-header cv-msg-card-header">
        <div class="cv-msg-header">
          <div class="cv-msg-header-info">
            <span class="cv-msg-title">${this.message.name || '(unnamed)'}</span>
            <span class="cv-msg-id">${idHex} (${idDecimal})</span>
            <span class="cv-msg-meta">DLC: ${this.message.dlc}</span>
            ${this.message.sender ? `<span class="cv-msg-meta">TX: ${this.message.sender}</span>` : ''}
            ${this.message.is_extended ? `<span class="cv-msg-meta">Extended</span>` : ''}
            ${this.message.comment ? `<span class="cv-msg-meta dimmed">${escapeHtml(this.message.comment)}</span>` : ''}
          </div>
          ${this.parentEditMode ? `
            <div class="cv-msg-actions">
              <button class="cv-btn primary small" id="edit-msg-btn">Edit</button>
              <button class="cv-btn danger small" id="delete-msg-btn">Delete</button>
            </div>
          ` : ''}
        </div>
        ${this.renderBitLayout()}
      </div>
    `;
  }

  private renderMessageEditMode(idHex: string): string {
    return `
      <div class="cv-card-header cv-msg-card-header">
        <div class="cv-msg-header">
          <div class="cv-form-group" style="flex: 1; margin-bottom: 0; margin-right: 16px;">
            <label class="cv-label">Name</label>
            <input type="text" class="cv-input" id="msg_name" value="${this.message.name}" placeholder="Message Name">
          </div>
          <div class="cv-msg-actions" style="align-self: flex-end;">
            <button class="cv-btn success small" id="done-msg-btn">Done</button>
            <button class="cv-btn small" id="cancel-msg-btn">Cancel</button>
          </div>
        </div>

        <div class="cv-form-row">
          <div class="cv-form-group">
            <label class="cv-label">Message ID <span class="cv-id-display">(${idHex})</span></label>
            <input type="number" class="cv-input" id="msg_id" value="${this.message.id}" min="0" max="536870911">
          </div>
          <div class="cv-form-group">
            <label class="cv-label">DLC</label>
            <select class="cv-select" id="msg_dlc">
              ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64].map(
                dlc => `<option value="${dlc}" ${this.message.dlc === dlc ? 'selected' : ''}>${dlc}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="cv-form-row">
          <div class="cv-form-group">
            <label class="cv-label">Sender</label>
            <select class="cv-select" id="msg_sender">
              <option value="Vector__XXX" ${this.message.sender === 'Vector__XXX' ? 'selected' : ''}>Vector__XXX</option>
              ${this.availableNodes.map(
                node => `<option value="${node}" ${this.message.sender === node ? 'selected' : ''}>${node}</option>`
              ).join('')}
            </select>
          </div>
          <div class="cv-form-group">
            <div class="cv-checkbox-group" style="margin-top: 20px;">
              <input type="checkbox" class="cv-checkbox" id="msg_extended" ${this.message.is_extended ? 'checked' : ''}>
              <span>Extended ID (29-bit)</span>
            </div>
          </div>
        </div>

        <div class="cv-form-group">
          <label class="cv-label">Comment</label>
          <textarea class="cv-textarea" id="msg_comment" rows="2" placeholder="Optional description">${this.message.comment || ''}</textarea>
        </div>

        ${this.renderBitLayout()}
      </div>
    `;
  }

  private getActiveSignals(): SignalDto[] {
    const currentSignal = this.editingSignal;
    const currentMuxValue = currentSignal?.multiplexer_value;

    return this.message.signals.filter(sig => {
      if (sig.is_multiplexer) return true;
      if (sig.multiplexer_value === null) return true;
      if (currentMuxValue !== null && sig.multiplexer_value === currentMuxValue) return true;
      if (currentMuxValue === null) return false;
      return false;
    });
  }

  private renderBitLayout(): string {
    const totalBits = this.message.dlc * 8;
    if (totalBits === 0) return '';

    const currentSignal = this.editingSignal;
    const currentStart = currentSignal?.start_bit ?? 0;
    const currentLength = currentSignal?.length ?? 1;

    const activeSignals = this.getActiveSignals();
    const getLinearPos = (sig: SignalDto) => getLinearBitPosition(sig.start_bit, sig.length, sig.byte_order);

    const hasOverlap = (sig: SignalDto): boolean => {
      const pos = getLinearPos(sig);
      for (const other of activeSignals) {
        if (other.name === sig.name) continue;
        const otherPos = getLinearPos(other);
        if (pos.start <= otherPos.end && otherPos.start <= pos.end) {
          return true;
        }
      }
      return false;
    };

    const segments = activeSignals.map((sig, idx) => {
      const isCurrent = currentSignal && sig.name === currentSignal.name;
      const isOverlapping = hasOverlap(sig);
      const pos = getLinearPos(sig);
      const left = (pos.start / totalBits) * 100;
      const width = (sig.length / totalBits) * 100;
      const color = isOverlapping ? '#ef4444' : (isCurrent ? '#3b82f6' : getSignalColor(idx));
      const opacity = isCurrent ? 1 : 0.5;
      const classes = ['cv-bit-segment', isCurrent ? 'current' : '', isOverlapping ? 'overlap' : ''].filter(Boolean).join(' ');
      const byteOrderLabel = sig.byte_order === 'big_endian' ? 'BE' : 'LE';

      return `<div class="${classes}"
                   style="left: ${left}%; width: ${width}%; background: ${color}; opacity: ${opacity};"
                   title="${sig.name} (${byteOrderLabel}): bits ${pos.start}-${pos.end}${isOverlapping ? ' (OVERLAP!)' : ''}">
                ${width > 8 ? sig.name : ''}
              </div>`;
    }).join('');

    const markers: string[] = [];
    for (let i = 0; i <= Math.min(8, this.message.dlc); i++) {
      markers.push(`<span>${i * 8}</span>`);
    }
    if (this.message.dlc > 8) {
      markers.push(`<span>${totalBits}</span>`);
    }

    return `
      <div class="cv-bit-layout">
        <div class="cv-bit-layout-header">
          <span>Bit Layout (${totalBits} bits)</span>
          <span>${currentSignal?.name || ''}: ${currentStart} - ${currentStart + currentLength - 1}</span>
        </div>
        <div class="cv-bit-bar">
          ${segments}
        </div>
        <div class="cv-bit-markers">
          ${markers.join('')}
        </div>
        ${(this.isAddingSignal || this.isEditingSignal) ? (() => {
          const byteOrder = currentSignal?.byte_order ?? 'little_endian';
          const constraints = getSliderConstraints(totalBits, currentStart, currentLength, byteOrder);
          return `
          <div class="cv-bit-sliders">
            <div class="cv-bit-slider-group">
              <div class="cv-bit-slider-label">
                <span>Start Bit</span>
                <span class="cv-bit-slider-value" id="start-bit-value">${currentStart}</span>
              </div>
              <input type="range" class="cv-bit-slider" id="start-bit-slider"
                     min="${constraints.startMin}" max="${constraints.startMax}" value="${currentStart}">
            </div>
            <div class="cv-bit-slider-group">
              <div class="cv-bit-slider-label">
                <span>Length</span>
                <span class="cv-bit-slider-value" id="length-value">${currentLength}</span>
              </div>
              <input type="range" class="cv-bit-slider" id="length-slider"
                     min="${constraints.lenMin}" max="${constraints.lenMax}" value="${currentLength}">
            </div>
          </div>
        `;
        })() : ''}
      </div>
    `;
  }

  private updateBitBar() {
    if (!this.shadowRoot || !this.editingSignal) return;

    const totalBits = this.message.dlc * 8;
    if (totalBits === 0) return;

    const currentStart = this.editingSignal.start_bit;
    const currentLength = this.editingSignal.length;

    const headerRight = this.shadowRoot.querySelector('.cv-bit-layout-header span:last-child');
    if (headerRight) {
      headerRight.textContent = `${this.editingSignal.name || ''}: ${currentStart} - ${currentStart + currentLength - 1}`;
    }

    const bitBar = this.shadowRoot.querySelector('.cv-bit-bar');
    if (bitBar) {
      const activeSignals = this.getActiveSignals();
      const currentByteOrder = this.editingSignal.byte_order;

      const getPos = (start: number, len: number, order: 'little_endian' | 'big_endian') =>
        getLinearBitPosition(start, len, order);

      const hasOverlap = (sigStart: number, sigLength: number, sigOrder: 'little_endian' | 'big_endian', excludeName: string): boolean => {
        const pos = getPos(sigStart, sigLength, sigOrder);
        for (const other of activeSignals) {
          if (other.name === excludeName) continue;
          const isOtherCurrent = other.name === this.editingSignal!.name;
          const otherStart = isOtherCurrent ? currentStart : other.start_bit;
          const otherLength = isOtherCurrent ? currentLength : other.length;
          const otherOrder = isOtherCurrent ? currentByteOrder : other.byte_order;
          const otherPos = getPos(otherStart, otherLength, otherOrder);
          if (pos.start <= otherPos.end && otherPos.start <= pos.end) {
            return true;
          }
        }
        return false;
      };

      const segments = activeSignals.map((sig, idx) => {
        const isCurrent = sig.name === this.editingSignal!.name;
        const sigStart = isCurrent ? currentStart : sig.start_bit;
        const sigLength = isCurrent ? currentLength : sig.length;
        const sigOrder = isCurrent ? currentByteOrder : sig.byte_order;
        const pos = getPos(sigStart, sigLength, sigOrder);
        const left = (pos.start / totalBits) * 100;
        const width = (sigLength / totalBits) * 100;
        const isOverlapping = hasOverlap(sigStart, sigLength, sigOrder, sig.name);
        const color = isOverlapping ? '#ef4444' : (isCurrent ? '#3b82f6' : getSignalColor(idx));
        const opacity = isCurrent ? 1 : 0.5;
        const byteOrderLabel = sigOrder === 'big_endian' ? 'BE' : 'LE';
        const classes = ['cv-bit-segment', isCurrent ? 'current' : '', isOverlapping ? 'overlap' : ''].filter(Boolean).join(' ');

        return `<div class="${classes}"
                     style="left: ${left}%; width: ${width}%; background: ${color}; opacity: ${opacity};"
                     title="${sig.name} (${byteOrderLabel}): bits ${pos.start}-${pos.end}${isOverlapping ? ' (OVERLAP!)' : ''}">
                  ${width > 8 ? sig.name : ''}
                </div>`;
      }).join('');

      if (this.isAddingSignal && this.editingSignal) {
        const pos = getPos(currentStart, currentLength, currentByteOrder);
        const left = (pos.start / totalBits) * 100;
        const width = (currentLength / totalBits) * 100;
        const isOverlapping = hasOverlap(currentStart, currentLength, currentByteOrder, '');
        const color = isOverlapping ? '#ef4444' : '#3b82f6';
        const byteOrderLabel = currentByteOrder === 'big_endian' ? 'BE' : 'LE';
        const classes = ['cv-bit-segment', 'current', isOverlapping ? 'overlap' : ''].filter(Boolean).join(' ');
        const segment = `<div class="${classes}"
                              style="left: ${left}%; width: ${width}%; background: ${color}; opacity: 1;"
                              title="New (${byteOrderLabel}): bits ${pos.start}-${pos.end}${isOverlapping ? ' (OVERLAP!)' : ''}">
                           ${width > 8 ? (this.editingSignal.name || 'New') : ''}
                         </div>`;
        bitBar.innerHTML = segments + segment;
      } else {
        bitBar.innerHTML = segments;
      }
    }
  }

  private setupSliderListeners() {
    if (!this.shadowRoot) return;

    const startBitSlider = this.shadowRoot.getElementById('start-bit-slider') as HTMLInputElement;
    const lengthSlider = this.shadowRoot.getElementById('length-slider') as HTMLInputElement;
    const totalBits = this.message.dlc * 8;

    const updateSliderConstraints = () => {
      if (!this.editingSignal || !startBitSlider || !lengthSlider) return;
      const constraints = getSliderConstraints(totalBits, this.editingSignal.start_bit, this.editingSignal.length, this.editingSignal.byte_order);
      startBitSlider.min = String(constraints.startMin);
      startBitSlider.max = String(constraints.startMax);
      lengthSlider.min = String(constraints.lenMin);
      lengthSlider.max = String(constraints.lenMax);
    };

    startBitSlider?.addEventListener('input', () => {
      const value = parseInt(startBitSlider.value, 10);
      if (this.editingSignal) {
        this.editingSignal.start_bit = value;
        this.shadowRoot!.getElementById('start-bit-value')!.textContent = String(value);
        updateSliderConstraints();
        const constraints = getSliderConstraints(totalBits, value, this.editingSignal.length, this.editingSignal.byte_order);
        if (this.editingSignal.length > constraints.lenMax) {
          this.editingSignal.length = constraints.lenMax;
          lengthSlider.value = String(constraints.lenMax);
          this.shadowRoot!.getElementById('length-value')!.textContent = String(constraints.lenMax);
        }
        const signalEditor = this.shadowRoot!.querySelector('cv-signal-editor') as SignalEditorElement;
        signalEditor?.updateSignalValues({ start_bit: this.editingSignal.start_bit, length: this.editingSignal.length });
        this.updateBitBar();
        this.validateSignalAndSetError(signalEditor);
      }
    });

    lengthSlider?.addEventListener('input', () => {
      const value = parseInt(lengthSlider.value, 10);
      if (this.editingSignal) {
        this.editingSignal.length = value;
        this.shadowRoot!.getElementById('length-value')!.textContent = String(value);
        updateSliderConstraints();
        const constraints = getSliderConstraints(totalBits, this.editingSignal.start_bit, value, this.editingSignal.byte_order);
        if (this.editingSignal.start_bit < constraints.startMin) {
          this.editingSignal.start_bit = constraints.startMin;
          startBitSlider.value = String(constraints.startMin);
          this.shadowRoot!.getElementById('start-bit-value')!.textContent = String(constraints.startMin);
        } else if (this.editingSignal.start_bit > constraints.startMax) {
          this.editingSignal.start_bit = constraints.startMax;
          startBitSlider.value = String(constraints.startMax);
          this.shadowRoot!.getElementById('start-bit-value')!.textContent = String(constraints.startMax);
        }
        const signalEditor = this.shadowRoot!.querySelector('cv-signal-editor') as SignalEditorElement;
        signalEditor?.updateSignalValues({ start_bit: this.editingSignal.start_bit, length: this.editingSignal.length });
        this.updateBitBar();
        this.validateSignalAndSetError(signalEditor);
      }
    });
  }

  private render() {
    if (!this.shadowRoot) return;

    const idHex = `0x${this.message.id.toString(16).toUpperCase()}`;

    this.shadowRoot.innerHTML = `
      <style>${styles}
        :host {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 12px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
      </style>

      ${this.isEditingMessage ? this.renderMessageEditMode(idHex) : this.renderMessageViewMode(idHex)}

      <div class="cv-signals-layout">
        <div class="cv-signals-table-container">
          <div class="cv-signals-table-header">
            <span>Signals (${this.message.signals.length})</span>
            ${this.parentEditMode ? `<button class="cv-btn accent small" id="add-signal-btn">+ Add</button>` : ''}
          </div>
          <cv-signals-table></cv-signals-table>
        </div>
        ${this.isAddingSignal || this.selectedSignal ? `
          <div class="cv-signal-editor-panel">
            <cv-signal-editor data-edit-mode="${this.parentEditMode}"></cv-signal-editor>
          </div>
        ` : ''}
      </div>
    `;

    this.setupEventListeners();
    this.updateChildComponents();
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    this.shadowRoot.getElementById('edit-msg-btn')?.addEventListener('click', () => {
      this.isEditingMessage = true;
      this.render();
    });

    this.shadowRoot.getElementById('delete-msg-btn')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('message-delete-request', { bubbles: true, composed: true }));
    });

    this.shadowRoot.getElementById('done-msg-btn')?.addEventListener('click', () => {
      if (!this.message.name) {
        alert('Message name is required');
        return;
      }
      this.isEditingMessage = false;
      this.originalMessage = deepClone(this.message);
      this.notifyChange();
      this.dispatchEvent(new CustomEvent('message-edit-done', { detail: this.message, bubbles: true, composed: true }));
      this.render();
    });

    this.shadowRoot.getElementById('cancel-msg-btn')?.addEventListener('click', () => {
      if (this.isNewMessage) {
        this.dispatchEvent(new CustomEvent('message-edit-cancel', { bubbles: true, composed: true }));
      } else {
        this.message = deepClone(this.originalMessage);
        this.isEditingMessage = false;
        this.render();
      }
    });

    const msgName = this.shadowRoot.getElementById('msg_name') as HTMLInputElement;
    const msgId = this.shadowRoot.getElementById('msg_id') as HTMLInputElement;
    const msgDlc = this.shadowRoot.getElementById('msg_dlc') as HTMLSelectElement;
    const msgSender = this.shadowRoot.getElementById('msg_sender') as HTMLSelectElement;
    const msgExtended = this.shadowRoot.getElementById('msg_extended') as HTMLInputElement;

    msgName?.addEventListener('input', () => { this.message.name = msgName.value; });

    msgId?.addEventListener('input', () => {
      this.message.id = parseInt(msgId.value, 10) || 0;
      const idHex = `0x${this.message.id.toString(16).toUpperCase()}`;
      const label = this.shadowRoot!.querySelector('.cv-id-display');
      if (label) label.textContent = `(${idHex})`;

      if (this.isNewMessage && this.frames.length > 0) {
        const detectedDlc = detectDlcFromFrames(this.frames, this.message.id, this.message.is_extended);
        if (detectedDlc !== null && detectedDlc !== this.message.dlc) {
          this.message.dlc = detectedDlc;
          if (msgDlc) msgDlc.value = String(detectedDlc);
        }
      }
    });

    msgDlc?.addEventListener('change', () => { this.message.dlc = parseInt(msgDlc.value, 10); });
    msgSender?.addEventListener('change', () => { this.message.sender = msgSender.value; });

    msgExtended?.addEventListener('change', () => {
      this.message.is_extended = msgExtended.checked;
      if (this.isNewMessage && this.frames.length > 0) {
        const detectedDlc = detectDlcFromFrames(this.frames, this.message.id, this.message.is_extended);
        if (detectedDlc !== null && detectedDlc !== this.message.dlc) {
          this.message.dlc = detectedDlc;
          if (msgDlc) msgDlc.value = String(detectedDlc);
        }
      }
    });

    const msgComment = this.shadowRoot.getElementById('msg_comment') as HTMLTextAreaElement;
    msgComment?.addEventListener('input', () => {
      this.message.comment = msgComment.value || null;
    });

    this.setupSliderListeners();

    const addSignalBtn = this.shadowRoot.getElementById('add-signal-btn');
    addSignalBtn?.addEventListener('click', () => {
      this.isAddingSignal = true;
      this.selectedSignal = null;
      this.editingSignal = createDefaultSignal();
      this.render();
    });

    const signalsTable = this.shadowRoot.querySelector('cv-signals-table') as SignalsTableElement;
    signalsTable?.addEventListener('signal-select', ((e: CustomEvent) => {
      const name = e.detail.name;
      if (this.selectedSignal === name) {
        this.selectedSignal = null;
        this.editingSignal = null;
        this.isEditingSignal = false;
      } else {
        this.selectedSignal = name;
        this.editingSignal = this.message.signals.find(s => s.name === name) || null;
        this.isEditingSignal = false;
      }
      this.isAddingSignal = false;
      this.render();
    }) as EventListener);

    const signalEditor = this.shadowRoot.querySelector('cv-signal-editor') as SignalEditorElement;

    signalEditor?.addEventListener('edit-start', (() => {
      this.isEditingSignal = true;
      const bitLayout = this.shadowRoot!.querySelector('.cv-bit-layout');
      if (bitLayout && !bitLayout.querySelector('.cv-bit-sliders')) {
        const totalBits = this.message.dlc * 8;
        const currentStart = this.editingSignal?.start_bit ?? 0;
        const currentLength = this.editingSignal?.length ?? 1;
        const byteOrder = this.editingSignal?.byte_order ?? 'little_endian';
        const constraints = getSliderConstraints(totalBits, currentStart, currentLength, byteOrder);
        const slidersHtml = `
          <div class="cv-bit-sliders">
            <div class="cv-bit-slider-group">
              <div class="cv-bit-slider-label">
                <span>Start Bit</span>
                <span class="cv-bit-slider-value" id="start-bit-value">${currentStart}</span>
              </div>
              <input type="range" class="cv-bit-slider" id="start-bit-slider"
                     min="${constraints.startMin}" max="${constraints.startMax}" value="${currentStart}">
            </div>
            <div class="cv-bit-slider-group">
              <div class="cv-bit-slider-label">
                <span>Length</span>
                <span class="cv-bit-slider-value" id="length-value">${currentLength}</span>
              </div>
              <input type="range" class="cv-bit-slider" id="length-slider"
                     min="${constraints.lenMin}" max="${constraints.lenMax}" value="${currentLength}">
            </div>
          </div>
        `;
        bitLayout.insertAdjacentHTML('beforeend', slidersHtml);
        this.setupSliderListeners();
      }
    }) as EventListener);

    signalEditor?.addEventListener('signal-change', ((e: CustomEvent) => {
      const signal = e.detail as SignalDto;
      if (this.editingSignal) {
        this.editingSignal = { ...this.editingSignal, ...signal };

        const startBitSlider = this.shadowRoot!.getElementById('start-bit-slider') as HTMLInputElement;
        const lengthSlider = this.shadowRoot!.getElementById('length-slider') as HTMLInputElement;
        const totalBits = this.message.dlc * 8;

        if (startBitSlider && lengthSlider) {
          const constraints = getSliderConstraints(totalBits, signal.start_bit, signal.length, signal.byte_order);
          startBitSlider.min = String(constraints.startMin);
          startBitSlider.max = String(constraints.startMax);
          lengthSlider.min = String(constraints.lenMin);
          lengthSlider.max = String(constraints.lenMax);
          startBitSlider.value = String(signal.start_bit);
          lengthSlider.value = String(signal.length);

          const startValueEl = this.shadowRoot!.getElementById('start-bit-value');
          const lengthValueEl = this.shadowRoot!.getElementById('length-value');
          if (startValueEl) startValueEl.textContent = String(signal.start_bit);
          if (lengthValueEl) lengthValueEl.textContent = String(signal.length);
        }

        this.updateBitBar();
        this.validateSignalAndSetError(signalEditor);
      }
    }) as EventListener);

    signalEditor?.addEventListener('edit-done', ((e: CustomEvent) => {
      const signal = e.detail as SignalDto;
      if (!signal.name) {
        alert('Signal name is required');
        return;
      }

      const totalBits = this.message.dlc * 8;
      if (signal.start_bit + signal.length > totalBits) {
        alert(`Signal extends beyond message size (${totalBits} bits). Reduce start bit or length.`);
        return;
      }

      const excludeName = this.isAddingSignal ? null : this.selectedSignal;
      const overlap = this.findOverlappingSignal(signal, excludeName);
      if (overlap) {
        alert(`Signal "${signal.name}" overlaps with "${overlap.name}" (bits ${overlap.start_bit}-${overlap.start_bit + overlap.length - 1})`);
        return;
      }

      if (this.isAddingSignal) {
        if (this.message.signals.some(s => s.name === signal.name)) {
          alert(`Signal "${signal.name}" already exists`);
          return;
        }
        this.message.signals.push(signal);
        this.selectedSignal = signal.name;
      } else if (this.selectedSignal) {
        const idx = this.message.signals.findIndex(s => s.name === this.selectedSignal);
        if (idx >= 0) {
          if (signal.name !== this.selectedSignal && this.message.signals.some(s => s.name === signal.name)) {
            alert(`Signal "${signal.name}" already exists`);
            return;
          }
          this.message.signals[idx] = signal;
          this.selectedSignal = signal.name;
        }
      }

      this.isAddingSignal = false;
      this.isEditingSignal = false;
      this.editingSignal = signal;
      this.notifyChange();
      this.render();
    }) as EventListener);

    signalEditor?.addEventListener('edit-cancel', (() => {
      this.isEditingSignal = false;
      if (this.isAddingSignal) {
        this.isAddingSignal = false;
        this.selectedSignal = null;
        this.editingSignal = null;
      } else if (this.selectedSignal) {
        const found = this.message.signals.find(s => s.name === this.selectedSignal);
        this.editingSignal = found ? deepClone(found) : null;
      }
      this.render();
    }) as EventListener);

    signalEditor?.addEventListener('signal-delete-request', ((e: CustomEvent) => {
      const name = e.detail.name;
      this.message.signals = this.message.signals.filter(s => s.name !== name);
      this.selectedSignal = null;
      this.editingSignal = null;
      this.notifyChange();
      this.render();
    }) as EventListener);
  }

  private updateChildComponents() {
    if (!this.shadowRoot) return;

    const signalsTable = this.shadowRoot.querySelector('cv-signals-table') as SignalsTableElement;
    if (signalsTable) {
      signalsTable.setSignals(this.message.signals);
      signalsTable.setSelected(this.selectedSignal);
    }

    const signalEditor = this.shadowRoot.querySelector('cv-signal-editor') as SignalEditorElement;
    if (signalEditor && this.editingSignal) {
      signalEditor.setSignal(this.editingSignal, this.isAddingSignal);
      signalEditor.setAvailableNodes(this.availableNodes);
    }
  }

  private findOverlappingSignal(signal: SignalDto, excludeName: string | null): SignalDto | null {
    const sigPos = getLinearBitPosition(signal.start_bit, signal.length, signal.byte_order);

    for (const existing of this.message.signals) {
      if (excludeName && existing.name === excludeName) continue;
      if (signal.multiplexer_value !== null && existing.multiplexer_value !== null) {
        if (signal.multiplexer_value !== existing.multiplexer_value) continue;
      }

      const existPos = getLinearBitPosition(existing.start_bit, existing.length, existing.byte_order);
      if (sigPos.start <= existPos.end && existPos.start <= sigPos.end) {
        return existing;
      }
    }

    return null;
  }

  private validateSignalAndSetError(signalEditor: SignalEditorElement | null) {
    if (!signalEditor || !this.editingSignal) return;

    const totalBits = this.message.dlc * 8;
    const signal = this.editingSignal;
    const pos = getLinearBitPosition(signal.start_bit, signal.length, signal.byte_order);

    if (pos.start < 0 || pos.end >= totalBits) {
      signalEditor.setError(`Signal exceeds message bounds (0-${totalBits - 1} bits)`);
      return;
    }

    const excludeName = this.isAddingSignal ? null : this.selectedSignal;
    const overlap = this.findOverlappingSignal(signal, excludeName);
    if (overlap) {
      signalEditor.setError(`Overlaps with "${overlap.name}"`);
      return;
    }

    signalEditor.setError(null);
  }

  private notifyChange() {
    this.dispatchEvent(new CustomEvent('message-change', { detail: this.message, bubbles: true, composed: true }));
  }
}

customElements.define('cv-message-editor', MessageEditorElement);
