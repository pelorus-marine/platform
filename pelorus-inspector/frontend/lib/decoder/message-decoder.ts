/**
 * Message Decoder Component — Pelorus Inspector
 *
 * Advanced message analysis with pattern detection and signal discovery.
 * Uses tabbed layout matching MDF4/DBC inspector patterns.
 */

import shellStyles from '../../styles/pelorus-inspector.css?inline';
import proStyles from '../editors/lab-addon.css?inline';
import { events, type Mdf4ChangedEvent, type DecoderMessageSelectedEvent } from '../events.js';
import type { CanFrame, MessageInfo } from '../types.js';
import { invoke } from '../ipc.js';
import type { BytePattern, AnalysisResult, PotentialSignal } from './types.js';

const styles = shellStyles + proStyles;

export class MessageDecoderElement extends HTMLElement {
  private shadow: ShadowRoot;
  private frames: CanFrame[] = [];
  private selectedMessageId: number | null = null;
  private selectedExtended = false;
  private analysis: AnalysisResult | null = null;
  private dbcMessage: MessageInfo | null = null;
  private activeTab: 'message' | 'bytes' | 'signals' = 'message';

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    events.on('decoder:message-selected', this.handleMessageSelected);
    events.on('mdf4:changed', this.handleMdf4Changed);
  }

  disconnectedCallback(): void {
    events.off('decoder:message-selected', this.handleMessageSelected);
    events.off('mdf4:changed', this.handleMdf4Changed);
  }

  private handleMessageSelected = (e: DecoderMessageSelectedEvent): void => {
    this.selectedMessageId = e.messageId;
    this.selectedExtended = e.isExtended;
    this.frames = e.frames;
    this.runAnalysis();
    this.loadDbcMessage();
  };

  private handleMdf4Changed = (e: Mdf4ChangedEvent): void => {
    if (e.action === 'cleared') {
      this.frames = [];
      this.analysis = null;
      this.selectedMessageId = null;
      this.render();
    }
  };

  private async loadDbcMessage(): Promise<void> {
    if (this.selectedMessageId === null) {
      this.dbcMessage = null;
      return;
    }

    try {
      const dbcInfo = await invoke('get_dbc_info') as { messages: MessageInfo[] } | null;
      if (dbcInfo) {
        this.dbcMessage = dbcInfo.messages.find(m => m.id === this.selectedMessageId) || null;
        this.render();
        this.bindEvents();
      }
    } catch {
      this.dbcMessage = null;
    }
  }

  private async runAnalysis(): Promise<void> {
    if (this.selectedMessageId === null || this.frames.length === 0) {
      this.analysis = null;
      this.render();
      return;
    }

    // Show loading state
    this.analysis = null;
    this.render();

    try {
      // Run analysis in Rust backend (async, doesn't block UI)
      this.analysis = await invoke('analyze_message_frames', {
        messageId: this.selectedMessageId,
        isExtended: this.selectedExtended,
        frames: this.frames,
      }) as AnalysisResult;
    } catch (e) {
      console.error('Analysis failed:', e);
      this.analysis = null;
    }

    this.render();
    this.bindEvents();
  }

  private render(): void {
    if (!this.analysis) {
      this.shadow.innerHTML = `
        <style>${styles}</style>
        <div class="cv-empty-state">
          <div class="cv-empty-state-title">No Message Selected</div>
          <p>Select a message ID from the toolbar to analyze its patterns</p>
        </div>
      `;
      return;
    }

    const a = this.analysis;
    const idHex = a.messageId.toString(16).toUpperCase().padStart(a.isExtended ? 8 : 3, '0');
    const msgName = this.dbcMessage?.name || '';

    this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="cv-mdf4-inspector">
        <div class="cv-panel">
          <div class="cv-panel-header">
            <div class="cv-tabs">
              <button class="cv-tab ${this.activeTab === 'message' ? 'active' : ''}" data-tab="message">
                Message
                <span class="cv-tab-badge">0x${idHex}</span>
              </button>
              <button class="cv-tab ${this.activeTab === 'bytes' ? 'active' : ''}" data-tab="bytes">
                Byte Analysis
                <span class="cv-tab-badge">${a.maxDlc} bytes</span>
              </button>
              <button class="cv-tab ${this.activeTab === 'signals' ? 'active' : ''}" data-tab="signals">
                Detected Signals
                <span class="cv-tab-badge">${a.potentialSignals.length}</span>
              </button>
            </div>
          </div>
          <div class="cv-panel-body flush">
            ${this.renderMessageTab(a, idHex, msgName)}
            ${this.renderBytesTab(a)}
            ${this.renderSignalsTab(a)}
          </div>
        </div>
      </div>
    `;
  }

  private renderMessageTab(a: AnalysisResult, idHex: string, msgName: string): string {
    return `
      <div class="cv-tab-pane ${this.activeTab === 'message' ? 'active' : ''}" id="messagePane">
        <div class="cv-grid responsive" style="padding: 8px;">
          <div class="cv-card">
            <div class="cv-card-header">
              <span class="cv-card-title">Message Info</span>
            </div>
            <div class="cv-card-body">
              <div class="cv-msg-header">
                <div class="cv-msg-header-info">
                  <span class="cv-msg-title">${msgName || `Message 0x${idHex}`}</span>
                  ${msgName ? `<span class="cv-msg-id">0x${idHex}</span>` : ''}
                  <span class="cv-msg-meta">${a.isExtended ? 'Extended' : 'Standard'}</span>
                </div>
              </div>
              <div class="cv-signal-props" style="margin-top: 12px;">
                <div class="cv-signal-prop">
                  <span class="cv-signal-prop-label">Frames</span>
                  <span class="cv-signal-prop-value">${a.frameCount.toLocaleString()}</span>
                </div>
                <div class="cv-signal-prop">
                  <span class="cv-signal-prop-label">Avg Interval</span>
                  <span class="cv-signal-prop-value">${a.avgIntervalMs.toFixed(1)} ms</span>
                </div>
                <div class="cv-signal-prop">
                  <span class="cv-signal-prop-label">Frequency</span>
                  <span class="cv-signal-prop-value">${(1000 / a.avgIntervalMs).toFixed(1)} Hz</span>
                </div>
                <div class="cv-signal-prop">
                  <span class="cv-signal-prop-label">DLC</span>
                  <span class="cv-signal-prop-value">${a.minDlc}${a.minDlc !== a.maxDlc ? ' - ' + a.maxDlc : ''}</span>
                </div>
              </div>
              ${this.dbcMessage?.comment ? `
                <div class="cv-msg-comment">${this.dbcMessage.comment}</div>
              ` : ''}
            </div>
          </div>
          <div class="cv-card">
            <div class="cv-card-header">
              <span class="cv-card-title">Sample Frames</span>
              <span class="cv-tab-badge">${Math.min(this.frames.length, 20)} / ${this.frames.length}</span>
            </div>
            <div class="cv-card-body" style="padding: 0;">
              <div class="cv-table-wrap" style="max-height: 300px;">
                <table class="cv-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.frames.slice(0, 20).map(f => `
                      <tr>
                        <td class="cv-cell-dim">${f.timestamp.toFixed(4)}s</td>
                        <td class="cv-cell-data">${f.data.map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderBytesTab(a: AnalysisResult): string {
    return `
      <div class="cv-tab-pane ${this.activeTab === 'bytes' ? 'active' : ''}" id="bytesPane">
        <div style="padding: 8px;">
          <div class="cv-card">
            <div class="cv-card-header">
              <span class="cv-card-title">Byte Pattern Analysis</span>
            </div>
            <div class="cv-card-body" style="padding: 0;">
              <div class="cv-table-wrap">
                <table class="cv-table">
                  <thead>
                    <tr>
                      <th>Byte</th>
                      <th>Range</th>
                      <th>Values</th>
                      <th>Entropy</th>
                      <th>Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${a.bytePatterns.map(p => this.renderByteRow(p)).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderByteRow(p: BytePattern): string {
    let pattern = '';
    let patternClass = 'cv-cell-dim';

    if (p.constantValue !== null) {
      pattern = 'Constant';
      patternClass = 'cv-cell-dim';
    } else if (p.isCounter) {
      pattern = 'Counter';
      patternClass = 'cv-cell-name';
    } else if (p.isBitfield) {
      pattern = 'Bitfield';
      patternClass = '';
    } else if (p.entropy > 4) {
      pattern = 'Varying';
      patternClass = 'cv-cell-value';
    }

    const minHex = p.min.toString(16).toUpperCase().padStart(2, '0');
    const maxHex = p.max.toString(16).toUpperCase().padStart(2, '0');

    return `
      <tr>
        <td class="cv-cell-id">${p.byteIndex}</td>
        <td class="cv-cell-data">${minHex} - ${maxHex}</td>
        <td>${p.uniqueValues}</td>
        <td>${p.entropy.toFixed(2)}</td>
        <td class="${patternClass}">${pattern}</td>
      </tr>
    `;
  }

  private renderSignalsTab(a: AnalysisResult): string {
    if (a.potentialSignals.length === 0) {
      return `
        <div class="cv-tab-pane ${this.activeTab === 'signals' ? 'active' : ''}" id="signalsPane">
          <div class="cv-empty-state">
            <div class="cv-empty-state-title">No Signals Detected</div>
            <p>Load more frames or check DBC for signal definitions</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="cv-tab-pane ${this.activeTab === 'signals' ? 'active' : ''}" id="signalsPane">
        <div style="padding: 8px;">
          ${a.potentialSignals.map(s => this.renderSignalCard(s)).join('')}
        </div>
      </div>
    `;
  }

  private renderSignalCard(s: PotentialSignal): string {
    const typeColors: Record<string, string> = {
      counter: 'var(--cv-success)',
      gauge: 'var(--cv-accent)',
      bitfield: '#a855f7',
      constant: 'var(--cv-text-dim)',
      unknown: 'var(--cv-warning)',
    };
    const color = typeColors[s.type] || 'var(--cv-text-muted)';

    return `
      <div class="cv-signal-card">
        <div class="cv-signal-card-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>${s.name}</span>
          <span class="cv-msg-meta" style="background: ${color}20; color: ${color}; text-transform: uppercase; font-size: 0.7rem;">
            ${s.type}
          </span>
        </div>
        <div class="cv-signal-props">
          <div class="cv-signal-prop">
            <span class="cv-signal-prop-label">Start Bit</span>
            <span class="cv-signal-prop-value">${s.startBit}</span>
          </div>
          <div class="cv-signal-prop">
            <span class="cv-signal-prop-label">Length</span>
            <span class="cv-signal-prop-value">${s.length} bits</span>
          </div>
          <div class="cv-signal-prop">
            <span class="cv-signal-prop-label">Range</span>
            <span class="cv-signal-prop-value">${s.minValue} - ${s.maxValue}</span>
          </div>
          <div class="cv-signal-prop">
            <span class="cv-signal-prop-label">Confidence</span>
            <span class="cv-signal-prop-value">${(s.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.shadow.querySelectorAll('.cv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = (tab as HTMLElement).dataset.tab as 'message' | 'bytes' | 'signals';
        this.render();
        this.bindEvents();
      });
    });
  }
}

customElements.define('cv-message-decoder', MessageDecoderElement);
