import type { DbcInfo, MessageInfo } from './types';
import { escapeHtml } from './utils/html';

/** Render DBC messages list */
export function renderDbcMessagesHtml(
  dbcInfo: DbcInfo | null,
  selectedMessageId: number | null
): string {
  if (!dbcInfo?.messages?.length) {
    return '<div class="cv-empty">No DBC file loaded</div>';
  }

  return dbcInfo.messages.map(msg => `
    <div class="cv-list-item ${msg.id === selectedMessageId ? 'selected' : ''}" data-id="${msg.id}">
      <div class="cv-list-item-title">${msg.name}</div>
      <div class="cv-list-item-subtitle">0x${msg.id.toString(16).toUpperCase()} (${msg.id})</div>
      <div class="cv-list-item-meta">DLC: ${msg.dlc} | ${msg.signals.length} signals${msg.sender ? ' | TX: ' + msg.sender : ''}</div>
      ${msg.comment ? `<div class="cv-list-item-comment">${escapeHtml(msg.comment)}</div>` : ''}
    </div>
  `).join('');
}

/** Render DBC message signals detail */
export function renderDbcSignalsHtml(msg: MessageInfo): string {
  if (msg.signals.length === 0) {
    return '<div class="cv-empty">No signals defined for this message</div>';
  }

  return msg.signals.map(sig => `
    <div class="cv-signal-card">
      <div class="cv-signal-card-title">${sig.name}</div>
      ${sig.comment ? `<div class="cv-signal-card-comment">${escapeHtml(sig.comment)}</div>` : ''}
      <div class="cv-signal-props">
        <div class="cv-signal-prop"><span class="cv-signal-prop-label">Start Bit</span><span class="cv-signal-prop-value">${sig.start_bit}</span></div>
        <div class="cv-signal-prop"><span class="cv-signal-prop-label">Length</span><span class="cv-signal-prop-value">${sig.length} bits</span></div>
        <div class="cv-signal-prop"><span class="cv-signal-prop-label">Factor</span><span class="cv-signal-prop-value">${sig.factor}</span></div>
        <div class="cv-signal-prop"><span class="cv-signal-prop-label">Offset</span><span class="cv-signal-prop-value">${sig.offset}</span></div>
        <div class="cv-signal-prop"><span class="cv-signal-prop-label">Min</span><span class="cv-signal-prop-value">${sig.min}</span></div>
        <div class="cv-signal-prop"><span class="cv-signal-prop-label">Max</span><span class="cv-signal-prop-value">${sig.max}</span></div>
        <div class="cv-signal-prop"><span class="cv-signal-prop-label">Unit</span><span class="cv-signal-prop-value">${sig.unit || '-'}</span></div>
      </div>
    </div>
  `).join('');
}

/** Get DBC message subtitle text */
export function getDbcMessageSubtitle(msg: MessageInfo): string {
  return `ID: 0x${msg.id.toString(16).toUpperCase()} | DLC: ${msg.dlc}${msg.sender ? ' | TX: ' + msg.sender : ''}`;
}

/** Render interface select options */
export function renderInterfaceOptions(interfaces: string[]): string {
  return '<option value="">Select CAN interface...</option>' +
    interfaces.map(iface => `<option value="${iface}">${iface}</option>`).join('');
}

