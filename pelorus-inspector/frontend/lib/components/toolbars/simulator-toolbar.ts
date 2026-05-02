/**
 * Simulator Toolbar Component
 *
 * Toolbar for Traffic Simulator tab with Load/Save script, Start/Stop controls,
 * and status indicator. Matches Live toolbar layout.
 */

import {
  events,
  EMPTY_PAYLOAD,
  emitSimulatorStopped,
  type SimulatorStats,
  type SimulatorStatsEvent,
  type SimulatorStartedEvent,
  type SimulatorStoppedEvent,
} from '../../events.js';
import { invoke } from '../../ipc';

export class SimulatorToolbarElement extends HTMLElement {
  private isRunning = false;

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    events.on('simulator:stats', this.handleStats);
    events.on('simulator:started', this.handleStarted);
    events.on('simulator:stopped', this.handleStopped);
  }

  disconnectedCallback(): void {
    events.off('simulator:stats', this.handleStats);
    events.off('simulator:started', this.handleStarted);
    events.off('simulator:stopped', this.handleStopped);
  }

  private handleStats = (e: SimulatorStatsEvent): void => {
    this.updateUI(e.stats);
  };

  private handleStarted = (_e: SimulatorStartedEvent): void => {
    this.isRunning = true;
    this.updateButtons();
  };

  private handleStopped = (_e: SimulatorStoppedEvent): void => {
    this.isRunning = false;
    this.updateButtons();
  };

  private updateButtons(): void {
    const startBtn = this.querySelector('#startBtn') as HTMLButtonElement;
    const stopBtn = this.querySelector('#stopBtn') as HTMLButtonElement;
    const statusDot = this.querySelector('#statusDot');
    const statusText = this.querySelector('#statusText');

    if (startBtn) startBtn.disabled = this.isRunning;
    if (stopBtn) stopBtn.disabled = !this.isRunning;
    statusDot?.classList.toggle('active', this.isRunning);
    statusDot?.classList.toggle('pulse', this.isRunning);
    if (statusText) statusText.textContent = this.isRunning ? 'Running' : 'Stopped';
  }

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'simulatorTab';
    this.innerHTML = `
      <button class="cv-btn" id="loadBtn" title="Load script from file">Load</button>
      <button class="cv-btn" id="saveBtn" title="Save script to file">Save</button>
      <span class="cv-toolbar-sep"></span>
      <button class="cv-btn success" id="startBtn">Start</button>
      <button class="cv-btn danger" id="stopBtn" disabled>Stop</button>
      <span class="cv-status"><span class="cv-status-dot" id="statusDot"></span><span id="statusText">Stopped</span></span>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#loadBtn')?.addEventListener('click', () => this.handleLoad());
    this.querySelector('#saveBtn')?.addEventListener('click', () => this.handleSave());
    this.querySelector('#startBtn')?.addEventListener('click', () => this.handleStart());
    this.querySelector('#stopBtn')?.addEventListener('click', () => this.handleStop());
  }

  private handleLoad(): void {
    events.emit('simulator:script-load-requested', EMPTY_PAYLOAD);
  }

  private handleSave(): void {
    events.emit('simulator:script-save-requested', EMPTY_PAYLOAD);
  }

  private handleStart(): void {
    const startBtn = this.querySelector('#startBtn') as HTMLButtonElement;
    if (startBtn) startBtn.disabled = true;
    // Emit event - panel will apply script and then start (panel uses its own selected interface)
    events.emit('simulator:start-requested', { interface: '' });
  }

  private async handleStop(): Promise<void> {
    const stopBtn = this.querySelector('#stopBtn') as HTMLButtonElement;
    if (stopBtn) stopBtn.disabled = true;
    try {
      await invoke('sim_stop');
      emitSimulatorStopped({ reason: 'user' });
    } catch (e) {
      console.error('Failed to stop simulator:', e);
      if (stopBtn) stopBtn.disabled = false;
    }
  }

  private updateUI(stats: SimulatorStats): void {
    this.isRunning = stats.running;
    this.updateButtons();
  }
}

customElements.define('cv-simulator-toolbar', SimulatorToolbarElement);
