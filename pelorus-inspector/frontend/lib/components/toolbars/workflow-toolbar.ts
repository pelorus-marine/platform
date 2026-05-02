/**
 * Workflow Toolbar Component
 *
 * Toolbar for Workflow tab with Load/Save controls and Run button.
 * Matches other toolbar layouts.
 */

import { events, EMPTY_PAYLOAD, type WorkflowStatusEvent } from '../../events.js';

export class WorkflowToolbarElement extends HTMLElement {
  private isRunning = false;

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    events.on('workflow:status', this.handleStatus);
  }

  disconnectedCallback(): void {
    events.off('workflow:status', this.handleStatus);
  }

  private handleStatus = (e: WorkflowStatusEvent): void => {
    this.isRunning = e.running;
    this.updateRunButton();
  };

  private updateRunButton(): void {
    const runBtn = this.querySelector('#runBtn') as HTMLButtonElement;
    if (runBtn) {
      runBtn.className = `cv-btn ${this.isRunning ? 'danger' : 'success'}`;
      runBtn.textContent = this.isRunning ? 'Stop' : 'Run';
    }
  }

  private render(): void {
    this.className = 'cv-toolbar cv-tab-pane';
    this.id = 'workflowTab';
    this.innerHTML = `
      <button class="cv-btn" id="loadBtn" title="Load workflow from file">Load</button>
      <button class="cv-btn" id="saveBtn" title="Save workflow to file">Save</button>
      <span class="cv-toolbar-sep"></span>
      <button class="cv-btn success" id="runBtn">Run</button>
    `;
  }

  private bindEvents(): void {
    this.querySelector('#loadBtn')?.addEventListener('click', () => {
      events.emit('workflow:load-requested', EMPTY_PAYLOAD);
    });
    this.querySelector('#saveBtn')?.addEventListener('click', () => {
      events.emit('workflow:save-requested', EMPTY_PAYLOAD);
    });
    this.querySelector('#runBtn')?.addEventListener('click', () => {
      events.emit('workflow:run-requested', EMPTY_PAYLOAD);
    });
  }
}

customElements.define('cv-workflow-toolbar', WorkflowToolbarElement);
