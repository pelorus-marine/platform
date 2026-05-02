/**
 * Workflow Editor Component — Pelorus Inspector
 *
 * Visual workflow editor for creating CAN data processing pipelines.
 */

import shellStyles from '../../styles/pelorus-inspector.css?inline';
import proStyles from '../editors/lab-addon.css?inline';
import workflowStyles from './workflow-styles.css?inline';
import type { WorkflowNode, Workflow, WorkflowConnection, SavedWorkflow } from './types.js';
import { NODE_TYPES, CATEGORY_LABELS, getNodeColor } from './node-types.js';
import { invoke, dialogs } from '../ipc';
import { toast } from '../components/shared';
import {
  pelorusWorkspace,
  artifactIndex,
  type WorkspacePath,
  type PelorusWorkspace,
  type ArtifactIndex,
} from '../store';
import type { ArtifactMeta } from '../storage/types';
import { getNodeHandler, isNodeConfigured, getNodeSubtitle, type NodeHandlerContext, type StoredArtifact } from './node-handlers.js';
import { events, EMPTY_PAYLOAD, type WorkflowLoadRequestedEvent, type WorkflowSaveRequestedEvent, type WorkflowRunRequestedEvent } from '../events';
import {
  emitNodeSelected,
  emitNodeAdded,
  emitNodeDeleted,
  emitNodeConfigChanged,
  emitConnectionAdded,
  emitConnectionDeleted,
  emitWorkflowLog,
  emitWorkflowCleared,
  emitWorkflowLoaded,
  emitWorkflowSaved,
  emitScriptModal,
  emitZoomChanged,
  emitWorkflowStatus,
} from './workflow-events.js';
import {
  setupWorkflowRuntimeEvents,
  cleanupWorkflowRuntimeEvents,
} from './workflow-runtime-events.js';
import { wouldCreateCycle } from './workflow-canvas.js';
import {
  renderNodes,
  renderNodeConfig,
  renderLogs,
  renderScriptModal,
  renderEmptyCanvas,
  renderRunningStatus,
  isInputConnected,
  isOutputConnected,
} from './workflow-render.js';
import {
  type ZoomPanState,
  createZoomPanState,
  clampZoom,
  applyZoom,
  resetZoomPan,
  startPan,
  updatePan,
  endPan,
  applyWheelPan,
  getTransformStyle,
  getZoomPercentage,
  screenToCanvas,
} from './workflow-zoom.js';

// Import the workflow script editor component for the modal
import './workflow-script-editor.js';
import type { WorkflowScriptEditorElement } from './workflow-script-editor.js';

const componentStyles = `
  :host { display: flex; height: 100%; overflow: hidden; }
  .workflow-container { display: flex; flex: 1; min-height: 0; }

  /* Script Editor Modal */
  .script-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .script-modal {
    background: var(--cv-bg);
    border: 1px solid var(--cv-border);
    border-radius: var(--cv-radius);
    width: 80%;
    max-width: 900px;
    height: 70%;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }
  .script-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--cv-border);
    background: var(--cv-bg-alt);
  }
  .script-modal-title {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .script-modal-actions {
    display: flex;
    gap: 8px;
  }
  .script-modal-body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .script-modal-body workflow-script-editor {
    flex: 1;
  }
`;

const styles = shellStyles + proStyles + workflowStyles + componentStyles;

export class WorkflowEditorElement extends HTMLElement {
  private shadow: ShadowRoot;
  private workflow: Workflow = {
    id: 'default',
    name: 'New Workflow',
    nodes: [],
    connections: [],
  };
  private selectedNodeId: string | null = null;
  private dragNode: WorkflowNode | null = null;
  private dragOffset = { x: 0, y: 0 };
  private nextNodeId = 1;
  private nextConnId = 1;

  // Connection drawing
  private connectingFrom: { nodeId: string; portIndex: number; isOutput: boolean } | null = null;
  private tempConnectionEnd: { x: number; y: number } | null = null;
  private selectedConnectionId: string | null = null;

  // Runtime (backend) - status comes via Tauri events, no polling
  private isRunning = false;
  private logs: string[] = [];

  // Script editor modal
  private scriptModalOpen = false;
  private editingScriptNodeId: string | null = null;

  // Canvas zoom & pan
  private zoomPan: ZoomPanState = createZoomPanState();

  // Picker lists: live workspace paths + MDF4 references
  private canInterfaces: WorkspacePath[] = [];
  private mdf4Files: WorkspacePath[] = [];
  private unsubscribeStore: (() => void) | null = null;

  // Mirrors artifactIndex for node dropdowns
  private storedDbc: StoredArtifact[] = [];
  private storedMdf4: StoredArtifact[] = [];
  private storedRhai: StoredArtifact[] = [];
  private unsubscribeStorageStore: (() => void) | null = null;

  // Bound event handlers
  private handleLoadRequested = (_e: WorkflowLoadRequestedEvent) => this.loadWorkflow();
  private handleSaveRequested = (_e: WorkflowSaveRequestedEvent) => this.saveWorkflow();
  private handleRunRequested = (_e: WorkflowRunRequestedEvent) => this.toggleRun();

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.bindGlobalEvents();
    this.subscribeToStore();
    events.on('workflow:load-requested', this.handleLoadRequested);
    events.on('workflow:save-requested', this.handleSaveRequested);
    events.on('workflow:run-requested', this.handleRunRequested);
    events.on('workflow:status', this.handleRuntimeStatus);

    // Set up Tauri event listeners for Rust backend events (no polling)
    setupWorkflowRuntimeEvents().catch((e) => {
      console.warn('[WorkflowEditor] Failed to setup runtime events:', e);
    });
  }

  private subscribeToStore(): void {
    // Initial load from store
    const state = pelorusWorkspace.get();
    this.canInterfaces = state.canInterfaces;
    this.mdf4Files = state.mdf4Files;

    // Initial load from artifact index
    const storageState = artifactIndex.get();
    this.storedDbc = storageState.dbcArtifacts.map((a: ArtifactMeta) => ({ name: a.name, size: a.size }));
    this.storedMdf4 = storageState.mdf4Artifacts.map((a: ArtifactMeta) => ({ name: a.name, size: a.size }));
    this.storedRhai = storageState.rhaiArtifacts.map((a: ArtifactMeta) => ({ name: a.name, size: a.size }));

    // Subscribe to changes
    this.unsubscribeStore = pelorusWorkspace.subscribe((state: PelorusWorkspace) => {
      const prevInterfaces = this.canInterfaces;
      const prevMdf4Files = this.mdf4Files;
      this.canInterfaces = state.canInterfaces;
      this.mdf4Files = state.mdf4Files;

      let needsRender = false;

      // Check if any nodes lost their resources using handlers
      for (const node of this.workflow.nodes) {
        const handler = getNodeHandler(node.type);
        if (handler?.validateResource) {
          const ctx = this.createHandlerContext(node);
          const fieldToClear = handler.validateResource(node.config, ctx);
          if (fieldToClear) {
            node.config[fieldToClear] = '';
            needsRender = true;
          }
        }
      }

      // Skip re-render if user is typing or script modal is open
      const activeEl = this.shadow.activeElement || document.activeElement;
      const isTyping = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isTyping || this.scriptModalOpen) {
        return;
      }

      // Re-render if resources changed and a node is selected, or if any node lost config
      if (needsRender ||
          (this.selectedNodeId && (prevInterfaces !== state.canInterfaces || prevMdf4Files !== state.mdf4Files))) {
        this.render();
      }
    });

    // Subscribe to storage store
    this.unsubscribeStorageStore = artifactIndex.subscribe((state: ArtifactIndex) => {
      this.storedDbc = state.dbcArtifacts.map((a: ArtifactMeta) => ({ name: a.name, size: a.size }));
      this.storedMdf4 = state.mdf4Artifacts.map((a: ArtifactMeta) => ({ name: a.name, size: a.size }));
      this.storedRhai = state.rhaiArtifacts.map((a: ArtifactMeta) => ({ name: a.name, size: a.size }));

      // Re-render if a node is selected (to update dropdowns)
      if (this.selectedNodeId && !this.scriptModalOpen) {
        this.render();
      }
    });
  }

  /** Create handler context for a node */
  private createHandlerContext(node: WorkflowNode): NodeHandlerContext {
    return {
      allNodes: this.workflow.nodes,
      node,
      canInterfaces: this.canInterfaces,
      mdf4Files: this.mdf4Files,
      storedDbc: this.storedDbc,
      storedMdf4: this.storedMdf4,
      storedRhai: this.storedRhai,
    };
  }

  disconnectedCallback(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mousedown', this.handleCanvasMouseDown);
    document.removeEventListener('mousemove', this.handleCanvasPanMove);
    document.removeEventListener('mouseup', this.handleCanvasPanEnd);
    events.off('workflow:load-requested', this.handleLoadRequested);
    events.off('workflow:save-requested', this.handleSaveRequested);
    events.off('workflow:run-requested', this.handleRunRequested);
    events.off('workflow:status', this.handleRuntimeStatus);
    this.unsubscribeStore?.();
    this.unsubscribeStorageStore?.();

    // Clean up Tauri event listeners
    cleanupWorkflowRuntimeEvents();

    if (this.isRunning) {
      invoke('workflow_stop').catch(console.error);
    }
  }

  /** Handle runtime status updates from Tauri events (no polling) */
  private handleRuntimeStatus = (e: { running: boolean; framesProcessed: number; framesWritten: number }): void => {
    const wasRunning = this.isRunning;
    this.isRunning = e.running;

    if (wasRunning && !e.running) {
      this.updateRunningStatus();
    } else if (!wasRunning && e.running) {
      this.updateRunningStatus();
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const canvas = this.shadow.querySelector('#canvas') as HTMLElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Handle node dragging
    if (this.dragNode) {
      this.dragNode.x = Math.max(0, e.clientX - rect.left - this.dragOffset.x);
      this.dragNode.y = Math.max(0, e.clientY - rect.top - this.dragOffset.y);
      this.updateNodePosition(this.dragNode);
    }

    // Handle connection drawing
    if (this.connectingFrom) {
      this.tempConnectionEnd = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      this.renderConnections();
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    // Finish connection if connecting
    if (this.connectingFrom) {
      // Use composedPath to find target inside shadow DOM
      const path = e.composedPath() as HTMLElement[];
      const portDot = path.find(el => el.classList?.contains('workflow-port-dot'));

      if (portDot) {
        const portData = portDot.dataset?.port;
        const nodeEl = path.find(el => el.classList?.contains('workflow-node'));

        if (portData && nodeEl) {
          const targetNodeId = nodeEl.dataset?.id;
          const [direction, indexStr] = portData.split('-');
          const targetIndex = parseInt(indexStr);
          const isOutput = direction === 'out';

          // Validate connection (output -> input only, different nodes)
          if (targetNodeId &&
              targetNodeId !== this.connectingFrom.nodeId &&
              this.connectingFrom.isOutput !== isOutput) {
            this.createConnection(
              this.connectingFrom.isOutput ? this.connectingFrom.nodeId : targetNodeId,
              this.connectingFrom.isOutput ? this.connectingFrom.portIndex : targetIndex,
              this.connectingFrom.isOutput ? targetNodeId : this.connectingFrom.nodeId,
              this.connectingFrom.isOutput ? targetIndex : this.connectingFrom.portIndex
            );
          }
        }
      }
      this.connectingFrom = null;
      this.tempConnectionEnd = null;
      this.renderConnections();
    }

    this.dragNode = null;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ignore when focus is in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    if (e.key === 'Delete') {
      if (this.selectedConnectionId) {
        const connId = this.selectedConnectionId;
        this.workflow.connections = this.workflow.connections.filter(c => c.id !== connId);
        this.selectedConnectionId = null;
        this.renderConnections();
        emitConnectionDeleted(connId);
      } else if (this.selectedNodeId) {
        this.deleteNode(this.selectedNodeId);
      }
    }
    if (e.key === 'Escape') {
      this.connectingFrom = null;
      this.tempConnectionEnd = null;
      if (this.selectedNodeId !== null) {
        this.selectedNodeId = null;
        this.updateNodeSelection();
      }
      if (this.selectedConnectionId !== null) {
        this.selectedConnectionId = null;
        this.updateConnectionSelection();
      }
      this.renderConnections(); // Clear temp connection line
    }
  };

  /** Update connection selection visuals */
  private updateConnectionSelection(): void {
    const svg = this.shadow.querySelector('#connections') as SVGSVGElement;
    if (!svg) return;

    svg.querySelectorAll('.workflow-connection[data-conn]').forEach(path => {
      const connId = (path as SVGPathElement).dataset.conn;
      path.classList.toggle('selected', connId === this.selectedConnectionId);
    });
  }

  private createConnection(fromNode: string, fromOutput: number, toNode: string, toInput: number): void {
    // Check if connection already exists
    const exists = this.workflow.connections.some(
      c => c.fromNode === fromNode && c.fromOutput === fromOutput &&
           c.toNode === toNode && c.toInput === toInput
    );
    if (exists) return;

    // Prevent cycles
    if (this.checkCycle(fromNode, toNode)) {
      this.addLog('Cannot create connection: would create cycle');
      return;
    }

    const conn: WorkflowConnection = {
      id: `conn-${this.nextConnId++}`,
      fromNode,
      fromOutput,
      toNode,
      toInput,
    };
    this.workflow.connections.push(conn);
    this.renderConnections();
    emitConnectionAdded(conn);
  }

  private checkCycle(fromNode: string, toNode: string): boolean {
    return wouldCreateCycle(this.workflow.connections, fromNode, toNode);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Targeted Update Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /** Update only node selection visuals without full re-render */
  private updateNodeSelection(): void {
    // Update node selection classes
    this.shadow.querySelectorAll('.workflow-node').forEach(el => {
      el.classList.toggle('selected', (el as HTMLElement).dataset.id === this.selectedNodeId);
    });
    // Update sidebar only
    this.updateSidebar();

    // Emit node selected event
    const node = this.selectedNodeId
      ? this.workflow.nodes.find(n => n.id === this.selectedNodeId) ?? null
      : null;
    emitNodeSelected(node);
  }

  /** Update only the sidebar content */
  private updateSidebar(): void {
    const sidebar = this.shadow.querySelector('.pro-sidebar');
    if (sidebar) {
      sidebar.innerHTML = this.selectedNodeId ? this.renderNodeConfigPanel() : this.renderWorkflowPanel();
      this.bindSidebarEvents();
    }
  }

  /** Update only the canvas nodes (after add/delete) */
  private updateCanvas(): void {
    const canvas = this.shadow.querySelector('#canvas') as HTMLElement;
    if (canvas) {
      const isEmpty = this.workflow.nodes.length === 0;
      canvas.innerHTML = isEmpty
        ? renderEmptyCanvas()
        : renderNodes(this.workflow.nodes, this.selectedNodeId, this.workflow.connections);
      this.renderConnections();
    }
  }

  /** Update only the running status indicator */
  private updateRunningStatus(): void {
    const statusEl = this.shadow.querySelector('.workflow-status');
    const isRunning = this.isRunning;

    // Emit status event
    emitWorkflowStatus(isRunning);

    if (isRunning && !statusEl) {
      const wrapper = this.shadow.querySelector('.workflow-canvas-wrapper');
      if (wrapper) {
        const status = document.createElement('div');
        status.className = 'workflow-status running';
        status.innerHTML = '<span class="cv-status-dot active pulse"></span>Running';
        wrapper.appendChild(status);
      }
    } else if (!isRunning && statusEl) {
      statusEl.remove();
    }
  }

  /** Update node header (title dot and label) based on configuration */
  private updateNodeDimmedState(nodeId: string): void {
    const node = this.workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeEl = this.shadow.querySelector(`[data-id="${nodeId}"]`);
    if (!nodeEl) return;

    const configured = isNodeConfigured(node);
    const header = nodeEl.querySelector('.workflow-node-header');
    if (header) {
      const color = getNodeColor(node.type);
      const subtitle = getNodeSubtitle(node);
      header.innerHTML = `
        <span class="workflow-node-dot ${!configured ? 'dimmed' : ''}" style="background: ${color}"></span>
        <div class="workflow-node-title">
          <div>${node.label}</div>
          <div class="workflow-node-desc ${configured ? 'configured' : ''}">${subtitle}</div>
        </div>
      `;
    }
  }

  /** Update port dot dimmed states based on connections */
  private updatePortDotStates(): void {
    const connections = this.workflow.connections;
    for (const node of this.workflow.nodes) {
      const nodeEl = this.shadow.querySelector(`[data-id="${node.id}"]`);
      if (!nodeEl) continue;

      // Update input port dots
      nodeEl.querySelectorAll('.ports-in .workflow-port-dot').forEach((dot, i) => {
        dot.classList.toggle('dimmed', !isInputConnected(connections, node.id, i));
      });

      // Update output port dots
      nodeEl.querySelectorAll('.ports-out .workflow-port-dot').forEach((dot, i) => {
        dot.classList.toggle('dimmed', !isOutputConnected(connections, node.id, i));
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────────

  private render(): void {
    const categories = [...new Set(NODE_TYPES.map(n => n.category))];
    const transform = getTransformStyle(this.zoomPan);

    this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="workflow-container">
        <div class="pro-sidebar-left">
          <div class="pro-section">
            <div class="pro-section-title">Node Palette</div>
          </div>
          <div class="node-palette">
            ${categories.map(cat => `
              <div class="palette-category">
                <div class="palette-category-title">${CATEGORY_LABELS[cat] || cat}</div>
                ${NODE_TYPES.filter(n => n.category === cat).map(n => `
                  <div class="palette-node" draggable="true" data-type="${n.type}">
                    <span class="palette-node-dot" style="background: ${getNodeColor(n.type)}"></span>
                    ${n.label}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="workflow-canvas-container">
          <div class="workflow-toolbar">
            <button class="cv-btn small" id="clearBtn">Clear</button>
            <div class="workflow-toolbar-spacer"></div>
            <div class="workflow-zoom-controls">
              <button class="cv-btn small" id="zoomOutBtn" title="Zoom Out">−</button>
              <span id="zoomLevel" class="workflow-zoom-level">${getZoomPercentage(this.zoomPan)}</span>
              <button class="cv-btn small" id="zoomInBtn" title="Zoom In">+</button>
              <button class="cv-btn small" id="zoomResetBtn" title="Reset Zoom">100%</button>
            </div>
          </div>
          <div class="workflow-canvas-wrapper">
            <svg class="workflow-connections" id="connections" style="transform: ${transform}; transform-origin: 0 0;"></svg>
            <div class="workflow-canvas" id="canvas" style="transform: ${transform}; transform-origin: 0 0;">
              ${this.workflow.nodes.length === 0 ? renderEmptyCanvas() : ''}
              ${renderNodes(this.workflow.nodes, this.selectedNodeId, this.workflow.connections)}
            </div>
            ${this.isRunning ? renderRunningStatus() : ''}
          </div>
        </div>

        <div class="pro-sidebar workflow-sidebar-narrow">
          ${this.selectedNodeId ? this.renderNodeConfigPanel() : this.renderWorkflowPanel()}
        </div>
      </div>
      ${this.scriptModalOpen ? renderScriptModal(this.workflow.nodes.find(n => n.id === this.editingScriptNodeId)) : ''}
    `;

    this.renderConnections();
    this.bindShadowEvents();
  }

  private renderNodeConfigPanel(): string {
    const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
    if (!node) return '';

    const ctx = this.createHandlerContext(node);
    return `
      ${renderNodeConfig(node, ctx)}
      <div class="pro-scroll">
        ${renderLogs(this.logs)}
      </div>
    `;
  }

  private renderWorkflowPanel(): string {
    return renderLogs(this.logs);
  }

  /** Open the script editor modal */
  private openScriptModal(nodeId: string): void {
    const node = this.workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    this.editingScriptNodeId = nodeId;
    this.scriptModalOpen = true;
    this.render();
    emitScriptModal(true, nodeId);

    // Set the script content after render
    requestAnimationFrame(() => {
      const editor = this.shadow.querySelector('#modalScriptEditor') as WorkflowScriptEditorElement;
      if (editor) {
        editor.script = String(node.config.script || '');
      }
      this.bindScriptModalEvents();
    });
  }

  /** Close the script editor modal */
  private closeScriptModal(): void {
    this.scriptModalOpen = false;
    this.editingScriptNodeId = null;
    this.render();
    emitScriptModal(false, null);
  }

  /** Save script from modal to node config */
  private saveScriptFromModal(): void {
    const editor = this.shadow.querySelector('#modalScriptEditor') as WorkflowScriptEditorElement;
    if (!editor || !this.editingScriptNodeId) return;

    const node = this.workflow.nodes.find(n => n.id === this.editingScriptNodeId);
    if (node) {
      node.config.script = editor.script;
      this.addLog(`Script updated for ${node.label}`);
    }

    this.closeScriptModal();
  }

  /** Bind events for script modal */
  private bindScriptModalEvents(): void {
    // Close on overlay click
    this.shadow.querySelector('#scriptModalOverlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'scriptModalOverlay') {
        this.closeScriptModal();
      }
    });

    // Cancel button
    this.shadow.querySelector('#scriptCancelBtn')?.addEventListener('click', () => {
      this.closeScriptModal();
    });

    // Save button
    this.shadow.querySelector('#scriptSaveBtn')?.addEventListener('click', () => {
      this.saveScriptFromModal();
    });

    // Validate button
    this.shadow.querySelector('#scriptValidateBtn')?.addEventListener('click', async () => {
      const editor = this.shadow.querySelector('#modalScriptEditor') as WorkflowScriptEditorElement;
      if (!editor) return;

      try {
        const result = await invoke<{ valid: boolean; errors: string[]; warnings: string[] }>(
          'workflow_validate_script',
          { script: editor.script }
        );

        if (result.valid) {
          this.addLog('Script validation passed');
          result.warnings.forEach((w: string) => this.addLog(`Warning: ${w}`));
        } else {
          result.errors.forEach((e: string) => this.addLog(`Error: ${e}`));
        }
      } catch (e) {
        this.addLog(`Validation failed: ${e}`);
      }
    });

    // ESC key to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.scriptModalOpen) {
        this.closeScriptModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Canvas Zoom & Pan
  // ─────────────────────────────────────────────────────────────────────────────

  /** Set zoom level with bounds checking */
  private setZoom(newZoom: number): void {
    this.zoomPan = { ...this.zoomPan, zoom: clampZoom(newZoom) };
    this.updateCanvasTransform();
  }

  /** Update canvas and connections transform */
  private updateCanvasTransform(): void {
    const canvas = this.shadow.querySelector('#canvas') as HTMLElement;
    const connections = this.shadow.querySelector('#connections') as SVGSVGElement;
    const zoomLevel = this.shadow.querySelector('#zoomLevel');

    const transform = getTransformStyle(this.zoomPan);
    if (canvas) canvas.style.transform = transform;
    if (connections) connections.style.transform = transform;
    if (zoomLevel) zoomLevel.textContent = getZoomPercentage(this.zoomPan);

    emitZoomChanged(this.zoomPan.zoom, this.zoomPan.panX, this.zoomPan.panY);
  }

  /** Handle wheel event for zoom */
  private handleWheel = (e: WheelEvent): void => {
    const wrapper = this.shadow.querySelector('.workflow-canvas-wrapper');
    if (!wrapper?.contains(e.target as Node)) return;

    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.zoomPan = applyZoom(this.zoomPan, delta, mouseX, mouseY);
      this.updateCanvasTransform();
    } else {
      this.zoomPan = applyWheelPan(this.zoomPan, e.deltaX, e.deltaY);
      this.updateCanvasTransform();
    }
  };

  /** Handle middle mouse button for panning */
  private handleCanvasMouseDown = (e: MouseEvent): void => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      const wrapper = this.shadow.querySelector('.workflow-canvas-wrapper');
      if (!wrapper?.contains(e.target as Node)) return;

      e.preventDefault();
      this.zoomPan = startPan(this.zoomPan, e.clientX, e.clientY);
    }
  };

  /** Handle pan movement */
  private handleCanvasPanMove = (e: MouseEvent): void => {
    if (!this.zoomPan.isPanning) return;
    this.zoomPan = updatePan(this.zoomPan, e.clientX, e.clientY);
    this.updateCanvasTransform();
  };

  /** Handle pan end */
  private handleCanvasPanEnd = (): void => {
    this.zoomPan = endPan(this.zoomPan);
  };

  /** Get the center position of a port dot relative to the canvas */
  private getPortPosition(nodeId: string, portIndex: number, isOutput: boolean): { x: number; y: number } | null {
    const canvas = this.shadow.querySelector('#canvas') as HTMLElement;
    const nodeEl = this.shadow.querySelector(`[data-id="${nodeId}"]`) as HTMLElement;
    if (!canvas || !nodeEl) return null;

    const portType = isOutput ? 'out' : 'in';
    const dot = nodeEl.querySelector(`[data-port="${portType}-${portIndex}"]`) as HTMLElement;
    if (!dot) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();

    return {
      x: dotRect.left + dotRect.width / 2 - canvasRect.left,
      y: dotRect.top + dotRect.height / 2 - canvasRect.top,
    };
  }

  private renderConnections(): void {
    const svg = this.shadow.querySelector('#connections') as SVGSVGElement;
    if (!svg) return;

    let paths = this.workflow.connections.map(conn => {
      const fromPos = this.getPortPosition(conn.fromNode, conn.fromOutput, true);
      const toPos = this.getPortPosition(conn.toNode, conn.toInput, false);

      if (!fromPos || !toPos) {
        // Fallback to calculated positions if dots not found
        const fromNode = this.workflow.nodes.find(n => n.id === conn.fromNode);
        const toNode = this.workflow.nodes.find(n => n.id === conn.toNode);
        if (!fromNode || !toNode) return '';

        const x1 = fromNode.x + 140;
        const y1 = fromNode.y + 60 + conn.fromOutput * 24;
        const x2 = toNode.x;
        const y2 = toNode.y + 60 + conn.toInput * 24;
        const cx = (x1 + x2) / 2;
        return `<path class="workflow-connection" d="M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}" data-conn="${conn.id}" />`;
      }

      const cx = (fromPos.x + toPos.x) / 2;
      return `<path class="workflow-connection" d="M ${fromPos.x} ${fromPos.y} C ${cx} ${fromPos.y}, ${cx} ${toPos.y}, ${toPos.x} ${toPos.y}" data-conn="${conn.id}" />`;
    }).join('');

    // Draw temporary connection while dragging
    if (this.connectingFrom && this.tempConnectionEnd) {
      const fromPos = this.getPortPosition(
        this.connectingFrom.nodeId,
        this.connectingFrom.portIndex,
        this.connectingFrom.isOutput
      );

      if (fromPos) {
        const x2 = this.tempConnectionEnd.x;
        const y2 = this.tempConnectionEnd.y;
        const cx = (fromPos.x + x2) / 2;
        paths += `<path class="workflow-connection temp" d="M ${fromPos.x} ${fromPos.y} C ${cx} ${fromPos.y}, ${cx} ${y2}, ${x2} ${y2}" />`;
      }
    }

    svg.innerHTML = paths;

    // Update port dot states after rendering connections
    this.updatePortDotStates();

    // Add click to select and right-click to delete connections
    svg.querySelectorAll('.workflow-connection[data-conn]').forEach(path => {
      // Click to select
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        const connId = (path as SVGPathElement).dataset.conn;
        this.selectedConnectionId = connId || null;
        this.updateConnectionSelection();
      });

      // Right-click to delete
      path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const connId = (path as SVGPathElement).dataset.conn;
        if (connId) {
          this.selectedConnectionId = null;
          this.workflow.connections = this.workflow.connections.filter(c => c.id !== connId);
          this.renderConnections();
          emitConnectionDeleted(connId);
        }
      });
    });
  }

  /** Bind document-level events (only once) */
  private bindGlobalEvents(): void {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('keydown', this.handleKeyDown);

    // Pan events
    document.addEventListener('mousedown', this.handleCanvasMouseDown);
    document.addEventListener('mousemove', this.handleCanvasPanMove);
    document.addEventListener('mouseup', this.handleCanvasPanEnd);
  }

  /** Bind shadow DOM events (after each render) */
  private bindShadowEvents(): void {
    this.bindPaletteEvents();
    this.bindCanvasEvents();
    this.bindToolbarEvents();
    this.bindSidebarEvents();
  }

  /** Bind palette drag events */
  private bindPaletteEvents(): void {
    const palette = this.shadow.querySelector('.node-palette') as HTMLElement;
    palette?.addEventListener('dragstart', (e) => {
      const node = (e.target as HTMLElement).closest('.palette-node') as HTMLElement;
      if (node) {
        const type = node.dataset.type;
        (e as DragEvent).dataTransfer?.setData('nodeType', type || '');
      }
    });
  }

  /** Bind canvas events (drop, node selection, port connection) */
  private bindCanvasEvents(): void {
    const canvas = this.shadow.querySelector('#canvas') as HTMLElement;
    const wrapper = this.shadow.querySelector('.workflow-canvas-wrapper') as HTMLElement;
    if (!canvas) return;

    // Wheel zoom/pan
    if (wrapper) {
      wrapper.addEventListener('wheel', this.handleWheel, { passive: false });
    }

    // Canvas drop (adjust for zoom/pan)
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = (e as DragEvent).dataTransfer?.getData('nodeType');
      if (type) {
        const rect = canvas.getBoundingClientRect();
        // Adjust for zoom and pan using screenToCanvas
        const pos = screenToCanvas(this.zoomPan, (e as DragEvent).clientX, (e as DragEvent).clientY, rect);
        this.addNode(type, pos.x - 70, pos.y - 20);
      }
    });

    // Node/port interaction
    canvas.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;

      // Clear connection selection when clicking on canvas
      if (this.selectedConnectionId) {
        this.selectedConnectionId = null;
        this.updateConnectionSelection();
      }

      // Port click - start connection
      const portDot = target.closest('.workflow-port-dot') as HTMLElement;
      if (portDot) {
        const nodeEl = portDot.closest('.workflow-node') as HTMLElement;
        const portData = portDot.dataset.port;
        if (nodeEl && portData) {
          const [direction, indexStr] = portData.split('-');
          this.connectingFrom = {
            nodeId: nodeEl.dataset.id!,
            portIndex: parseInt(indexStr),
            isOutput: direction === 'out',
          };
        }
        return;
      }

      // Node click - select and start drag
      const nodeEl = target.closest('.workflow-node') as HTMLElement;
      if (nodeEl) {
        const nodeId = nodeEl.dataset.id;
        const prevSelected = this.selectedNodeId;
        this.selectedNodeId = nodeId || null;

        const node = this.workflow.nodes.find(n => n.id === nodeId);
        if (node) {
          this.dragNode = node;
          const rect = nodeEl.getBoundingClientRect();
          this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
        }

        // Use targeted update instead of full render
        if (prevSelected !== this.selectedNodeId) {
          this.updateNodeSelection();
        }
      } else {
        if (this.selectedNodeId !== null) {
          this.selectedNodeId = null;
          this.updateNodeSelection();
        }
      }
    });
  }

  /** Bind toolbar button events */
  private bindToolbarEvents(): void {
    this.shadow.querySelector('#clearBtn')?.addEventListener('click', () => this.clearWorkflow());

    // Zoom controls
    this.shadow.querySelector('#zoomInBtn')?.addEventListener('click', () => this.setZoom(this.zoomPan.zoom + 0.1));
    this.shadow.querySelector('#zoomOutBtn')?.addEventListener('click', () => this.setZoom(this.zoomPan.zoom - 0.1));
    this.shadow.querySelector('#zoomResetBtn')?.addEventListener('click', () => {
      this.zoomPan = resetZoomPan();
      this.updateCanvasTransform();
    });
  }

  /** Bind sidebar events (config fields, buttons) */
  private bindSidebarEvents(): void {
    // Sidebar buttons
    this.shadow.querySelector('#deleteNodeBtn')?.addEventListener('click', () => {
      if (this.selectedNodeId) this.deleteNode(this.selectedNodeId);
    });

    // Script editor button
    this.shadow.querySelectorAll('[data-edit-script]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.selectedNodeId) {
          this.openScriptModal(this.selectedNodeId);
        }
      });
    });

    // Config fields - use 'input' for text fields (live update), 'change' for selects
    this.shadow.querySelectorAll('[data-field]').forEach(el => {
      const isSelect = el.tagName === 'SELECT';
      const isTextInput = el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'number';

      // For text inputs, update value on input but defer visual updates to blur
      if (isTextInput) {
        el.addEventListener('input', (e) => {
          const field = (e.target as HTMLElement).dataset.field;
          const value = (e.target as HTMLInputElement).value;
          if (field && this.selectedNodeId) {
            const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
            if (node) {
              node.config[field] = value;
              emitNodeConfigChanged(node.id, field, value, node.config);
            }
          }
        });
        el.addEventListener('blur', () => {
          if (this.selectedNodeId) {
            this.updateNodeDimmedState(this.selectedNodeId);
          }
        });
        return;
      }

      // For selects and number inputs, update immediately with visual feedback
      const eventType = isSelect ? 'change' : 'input';
      el.addEventListener(eventType, (e) => {
        const field = (e.target as HTMLElement).dataset.field;
        const target = e.target as HTMLInputElement;
        const value = target.type === 'number'
          ? parseFloat(target.value)
          : target.value;

        if (field && this.selectedNodeId) {
          const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
          if (node) {
            // Use handler for exclusive resource handling
            const handler = getNodeHandler(node.type);
            if (handler?.onConfigChange && value) {
              const ctx = this.createHandlerContext(node);
              const prevNodes = [...ctx.allNodes]; // Snapshot to find changed nodes
              handler.onConfigChange(value, ctx);
              // Update dimmed state for any nodes that were cleared
              for (const other of prevNodes) {
                if (other.id !== node.id && other.type === node.type) {
                  this.updateNodeDimmedState(other.id);
                }
              }
            }

            node.config[field] = value;
            this.updateNodeDimmedState(this.selectedNodeId);
            emitNodeConfigChanged(node.id, field, value, node.config);
          }
        }
      });
    });

    // File picker buttons (open existing)
    this.shadow.querySelectorAll('[data-file-picker]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const field = (btn as HTMLElement).dataset.filePicker;
        const ext = (btn as HTMLElement).dataset.ext || '';

        if (!field || !this.selectedNodeId) return;

        const filterName = ext === 'mf4' ? 'MDF4 Files' : 'DBC Files';
        const path = await dialogs.open([{ name: filterName, extensions: [ext] }]);

        if (path) {
          const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
          if (node) {
            // Register MDF4 path on workspace for node pickers
            if (ext === 'mf4') {
              this.addMdf4ToStore(path);
            }

            node.config[field] = path;
            this.updateSidebar(); // Update sidebar to show new filename
            this.updateNodeDimmedState(this.selectedNodeId);
            emitNodeConfigChanged(node.id, field, path, node.config);
          }
        }
      });
    });

    // Hex list - Add button
    this.shadow.querySelectorAll('[data-add-hex]').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = (btn as HTMLElement).dataset.addHex;
        if (!field || !this.selectedNodeId) return;

        const container = btn.closest('.config-field');
        const input = container?.querySelector('.hex-input') as HTMLInputElement;
        if (!input || !input.value.trim()) return;

        const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
        if (!node) return;

        // Parse and validate hex value
        let hexVal = input.value.trim();
        if (!hexVal.startsWith('0x') && !hexVal.startsWith('0X')) {
          hexVal = '0x' + hexVal;
        }

        // Validate hex format
        if (!/^0x[0-9A-Fa-f]+$/.test(hexVal)) {
          this.addLog(`Invalid hex value: ${hexVal}`);
          return;
        }

        // Add to existing IDs
        const currentIds = String(node.config[field] || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!currentIds.includes(hexVal)) {
          currentIds.push(hexVal);
          node.config[field] = currentIds.join(', ');
          input.value = '';
          this.updateSidebar();
          this.updateNodeDimmedState(this.selectedNodeId);
          emitNodeConfigChanged(node.id, field, node.config[field], node.config);
        }
      });
    });

    // Hex list - Remove chip
    this.shadow.querySelectorAll('.hex-chip-remove[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idToRemove = (btn as HTMLElement).dataset.remove;
        const chipsContainer = btn.closest('.hex-chips') as HTMLElement;
        const field = chipsContainer?.dataset.field;

        if (!field || !idToRemove || !this.selectedNodeId) return;

        const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
        if (!node) return;

        // Remove from IDs
        const currentIds = String(node.config[field] || '').split(',').map(s => s.trim()).filter(Boolean);
        const newIds = currentIds.filter(id => id !== idToRemove);
        node.config[field] = newIds.join(', ');

        this.updateSidebar();
        this.updateNodeDimmedState(this.selectedNodeId);
        emitNodeConfigChanged(node.id, field, node.config[field], node.config);
      });
    });

    // Hex list - Enter key to add
    this.shadow.querySelectorAll('.hex-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          e.preventDefault();
          const container = (input as HTMLElement).closest('.config-field');
          const addBtn = container?.querySelector('[data-add-hex]') as HTMLElement;
          addBtn?.click();
        }
      });
    });

    // File new buttons (create new)
    this.shadow.querySelectorAll('[data-file-new]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const field = (btn as HTMLElement).dataset.fileNew;
        const ext = (btn as HTMLElement).dataset.ext || '';

        if (!field || !this.selectedNodeId) return;

        const filterName = ext === 'mf4' ? 'MDF4 Files' : 'DBC Files';
        const path = await dialogs.save([{ name: filterName, extensions: [ext] }], `recording.${ext}`);

        if (path) {
          const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
          if (node) {
            // Register MDF4 path on workspace for node pickers
            if (ext === 'mf4') {
              this.addMdf4ToStore(path);
            }

            node.config[field] = path;
            this.updateSidebar(); // Update sidebar to show new filename
            this.updateNodeDimmedState(this.selectedNodeId);
            emitNodeConfigChanged(node.id, field, path, node.config);
          }
        }
      });
    });
  }

  /** Remember an MDF4 path for workflow resource dropdowns */
  private addMdf4ToStore(path: string): void {
    const state = pelorusWorkspace.get();
    const exists = state.mdf4Files.some((f: WorkspacePath) => f.path === path);
    if (!exists) {
      const name = path.split('/').pop() || path;
      pelorusWorkspace.set({
        mdf4Files: [...state.mdf4Files, { path, name }],
      });
    }
  }

  private addNode(type: string, x: number, y: number): void {
    const nodeType = NODE_TYPES.find(n => n.type === type);
    if (!nodeType) return;

    // Initialize config with defaults
    const config: Record<string, unknown> = {};
    for (const field of nodeType.configSchema || []) {
      if (field.default !== undefined) {
        config[field.name] = field.default;
      }
    }

    const node: WorkflowNode = {
      id: `node-${this.nextNodeId++}`,
      type,
      label: nodeType.label,
      x,
      y,
      inputs: [...nodeType.inputs],
      outputs: [...nodeType.outputs],
      config,
    };

    this.workflow.nodes.push(node);
    this.updateCanvas(); // Targeted update instead of full render
    emitNodeAdded(node);
  }

  private updateNodePosition(node: WorkflowNode): void {
    const nodeEl = this.shadow.querySelector(`[data-id="${node.id}"]`) as HTMLElement;
    if (nodeEl) {
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
    }
    this.renderConnections();
  }

  private deleteNode(nodeId: string): void {
    // Find connections to delete before removing them
    const deletedConnections = this.workflow.connections.filter(
      c => c.fromNode === nodeId || c.toNode === nodeId
    );

    this.workflow.nodes = this.workflow.nodes.filter(n => n.id !== nodeId);
    this.workflow.connections = this.workflow.connections.filter(
      c => c.fromNode !== nodeId && c.toNode !== nodeId
    );
    this.selectedNodeId = null;
    this.updateCanvas(); // Targeted update
    this.updateSidebar(); // Clear node config from sidebar

    // Emit events
    emitNodeDeleted(nodeId);
    for (const conn of deletedConnections) {
      emitConnectionDeleted(conn.id);
    }
    emitNodeSelected(null);
  }

  private async clearWorkflow(): Promise<void> {
    if (this.isRunning) {
      await invoke('workflow_stop');
      this.isRunning = false;
      emitWorkflowStatus(false);
    }
    this.workflow.nodes = [];
    this.workflow.connections = [];
    this.nextNodeId = 1;
    this.nextConnId = 1;
    this.logs = [];
    this.render();
    emitWorkflowCleared();
    emitNodeSelected(null);
  }

  private async toggleRun(): Promise<void> {
    if (this.isRunning) {
      try {
        await invoke('workflow_stop');
        this.isRunning = false;
        this.addLog('Workflow stopped');
      } catch (e) {
        this.addLog(`Failed to stop: ${e}`);
      }
    } else {
      // Validate workflow before starting
      const canNodes = this.workflow.nodes.filter(n => n.type === 'can');
      const mdf4Nodes = this.workflow.nodes.filter(n => n.type === 'mdf4');

      // Need either CAN input or MDF4 input/output pair
      if (canNodes.length === 0 && mdf4Nodes.length < 2) {
        this.addLog('Error: Workflow needs CAN node or two MDF4 nodes (input + output)');
        return;
      }

      // Validate CAN nodes if present
      const unconfiguredCan = canNodes.find(n => !n.config.interface);
      if (unconfiguredCan) {
        this.addLog('Error: CAN node has no interface configured');
        return;
      }

      // Validate MDF4 nodes for MDF4-only workflows
      if (canNodes.length === 0 && mdf4Nodes.length >= 2) {
        const inputNode = mdf4Nodes[0];
        const outputNode = mdf4Nodes[1];
        if (!inputNode.config.file) {
          this.addLog('Error: Input MDF4 node has no file configured');
          return;
        }
        if (!outputNode.config.file) {
          this.addLog('Error: Output MDF4 node has no file configured');
          return;
        }
      }

      try {
        // Single IPC call - all execution happens in Rust backend
        await invoke('workflow_start', { workflow: this.workflow });
        this.isRunning = true;
        this.addLog('Workflow started');
      } catch (e) {
        this.addLog(`Failed to start: ${e}`);
      }
    }
    this.updateRunningStatus();
  }

  private addLog(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
    const time = new Date().toLocaleTimeString();
    this.logs.push(`[${time}] ${message}`);
    if (this.logs.length > 50) this.logs.shift();
    this.updateLogsDisplay();
    emitWorkflowLog(message, level);
  }

  private updateLogsDisplay(): void {
    const logEl = this.shadow.querySelector('.pro-log');
    if (logEl) {
      logEl.innerHTML = this.logs.length === 0
        ? '<div class="workflow-log-empty">No logs yet</div>'
        : this.logs.map(log => `<div class="pro-log-entry">${log}</div>`).join('');
    }
  }

  private async saveWorkflow(): Promise<void> {
    const defaultName = `${this.workflow.name.replace(/\s+/g, '-').toLowerCase()}.workflow.json`;

    try {
      const name = prompt('Save workflow as:', defaultName);
      if (!name) return; // User cancelled

      const saved: SavedWorkflow = {
        version: 1,
        workflow: this.workflow,
        savedAt: new Date().toISOString(),
      };

      const content = new TextEncoder().encode(JSON.stringify(saved, null, 2));
      await invoke('storage_store', {
        name,
        artifactType: 'workflow',
        content: Array.from(content),
      });

      // Refresh storage store
      events.emit('storage:refresh', EMPTY_PAYLOAD);

      toast.success(`Saved workflow: ${name}`);
      this.addLog(`Saved workflow: ${this.workflow.name}`, 'success');
      emitWorkflowSaved(this.workflow.name, name);
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
      this.addLog(`Failed to save workflow: ${e}`);
    }
  }

  private async loadWorkflow(): Promise<void> {
    try {
      // Get list of stored workflows
      const workflows = artifactIndex.get().workflowArtifacts;

      if (workflows.length === 0) {
        toast.info('No saved workflows. Use Storage tab to import.');
        return;
      }

      // Show picker
      const names = workflows.map((w: ArtifactMeta) => w.name);
      const selected = prompt(
        `Load workflow:\n\n${names.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')}\n\nEnter number or name:`
      );

      if (!selected) return; // User cancelled

      // Find the workflow by number or name
      let name: string;
      const num = parseInt(selected);
      if (!isNaN(num) && num >= 1 && num <= names.length) {
        name = names[num - 1];
      } else {
        const found = names.find((n: string) => n.toLowerCase() === selected.toLowerCase());
        if (!found) {
          toast.error(`Workflow not found: ${selected}`);
          return;
        }
        name = found;
      }

      // Load from storage
      const content = await invoke<number[] | null>('storage_get', {
        name,
        artifactType: 'workflow',
      });

      if (!content) {
        toast.error(`Workflow not found: ${name}`);
        return;
      }

      const text = new TextDecoder().decode(new Uint8Array(content));
      const saved = JSON.parse(text) as SavedWorkflow;

      if (saved.version !== 1) {
        this.addLog('Unsupported workflow version');
        return;
      }

      // Stop any running workflow before loading
      if (this.isRunning) {
        await invoke('workflow_stop');
        this.isRunning = false;
      }
      this.workflow = saved.workflow;
      this.selectedNodeId = null;

      // Reset ID counters
      const maxNodeId = Math.max(0, ...this.workflow.nodes.map(n => parseInt(n.id.replace('node-', '')) || 0));
      const maxConnId = Math.max(0, ...this.workflow.connections.map(c => parseInt(c.id.replace('conn-', '')) || 0));
      this.nextNodeId = maxNodeId + 1;
      this.nextConnId = maxConnId + 1;

      toast.success(`Loaded: ${this.workflow.name}`);
      this.addLog(`Loaded workflow: ${this.workflow.name}`, 'success');
      this.render();
      emitWorkflowLoaded(
        this.workflow.name,
        this.workflow.nodes.length,
        this.workflow.connections.length
      );
      emitNodeSelected(null);
    } catch (e) {
      toast.error(`Failed to load: ${e}`);
      this.addLog(`Failed to load workflow: ${e}`, 'error');
    }
  }
}

customElements.define('cv-workflow-editor', WorkflowEditorElement);
