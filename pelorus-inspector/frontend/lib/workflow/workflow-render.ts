/**
 * Workflow Rendering Functions
 *
 * Pure functions for rendering workflow UI elements.
 */

import type { WorkflowNode, WorkflowConnection } from './types.js';
import { getNodeType, getNodeColor } from './node-types.js';
import { getNodeHandler, isNodeConfigured, getNodeSubtitle, type NodeHandlerContext } from './node-handlers.js';

/** Check if a specific input port is connected */
export function isInputConnected(connections: WorkflowConnection[], nodeId: string, portIndex: number): boolean {
  return connections.some(c => c.toNode === nodeId && c.toInput === portIndex);
}

/** Check if a specific output port is connected */
export function isOutputConnected(connections: WorkflowConnection[], nodeId: string, portIndex: number): boolean {
  return connections.some(c => c.fromNode === nodeId && c.fromOutput === portIndex);
}

/** Render a single workflow node */
export function renderNode(
  node: WorkflowNode,
  isSelected: boolean,
  connections: WorkflowConnection[]
): string {
  const color = getNodeColor(node.type);
  const configured = isNodeConfigured(node);
  const subtitle = getNodeSubtitle(node);

  return `
    <div class="workflow-node ${isSelected ? 'selected' : ''}"
         data-id="${node.id}"
         style="left: ${node.x}px; top: ${node.y}px;">
      <div class="workflow-node-header">
        <span class="workflow-node-dot ${!configured ? 'dimmed' : ''}" style="background: ${color}"></span>
        <div class="workflow-node-title">
          <div>${node.label}</div>
          <div class="workflow-node-desc ${configured ? 'configured' : ''}">${subtitle}</div>
        </div>
      </div>
      <div class="workflow-node-ports">
        <div class="ports-in">
          ${node.inputs.length > 0 ? '<div class="ports-heading">INPUT</div>' : ''}
          ${node.inputs.map((inp, i) => `
            <div class="workflow-port input">
              <span class="workflow-port-dot ${!isInputConnected(connections, node.id, i) ? 'dimmed' : ''}" data-port="in-${i}" data-type="${inp}"></span>
              <span>${inp}</span>
            </div>
          `).join('')}
        </div>
        <div class="ports-out">
          ${node.outputs.length > 0 ? '<div class="ports-heading">OUTPUT</div>' : ''}
          ${node.outputs.map((out, i) => `
            <div class="workflow-port output">
              <span>${out}</span>
              <span class="workflow-port-dot ${!isOutputConnected(connections, node.id, i) ? 'dimmed' : ''}" data-port="out-${i}" data-type="${out}"></span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/** Render all workflow nodes */
export function renderNodes(
  nodes: WorkflowNode[],
  selectedNodeId: string | null,
  connections: WorkflowConnection[]
): string {
  return nodes.map(node => renderNode(node, node.id === selectedNodeId, connections)).join('');
}

/** Render node configuration panel */
export function renderNodeConfig(
  node: WorkflowNode,
  ctx: NodeHandlerContext
): string {
  const nodeType = getNodeType(node.type);
  const schema = nodeType?.configSchema || [];
  const handler = getNodeHandler(node.type);

  return `
    <div class="pro-section">
      <div class="pro-section-title">${node.label} Config</div>
      ${schema.length === 0 ? '<div class="pro-empty-hint">No configuration options</div>' : ''}
      ${schema.map(field => {
        const value = node.config[field.name] ?? field.default ?? '';

        // Try handler-specific rendering first
        if (handler?.renderConfigField) {
          const customHtml = handler.renderConfigField(value, field, ctx);
          if (customHtml) return customHtml;
        }

        // Regular select
        if (field.type === 'select') {
          return `
            <div class="config-field">
              <label>${field.label}</label>
              <select class="cv-select" data-field="${field.name}">
                ${(field.options || []).map(opt => `
                  <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>
                `).join('')}
              </select>
            </div>
          `;
        }

        // Storage-based dropdowns
        if (field.type === 'storage-dbc') {
          const artifacts = ctx.storedDbc || [];
          return `
            <div class="config-field">
              <label>${field.label}</label>
              <select class="cv-select" data-field="${field.name}">
                <option value="">-- Select from Storage --</option>
                ${artifacts.map(a => `
                  <option value="${a.name}" ${value === a.name ? 'selected' : ''}>${a.name}</option>
                `).join('')}
              </select>
            </div>
          `;
        }

        if (field.type === 'storage-mdf4') {
          const artifacts = ctx.storedMdf4 || [];
          return `
            <div class="config-field">
              <label>${field.label}</label>
              <select class="cv-select" data-field="${field.name}">
                <option value="">-- Select from Storage --</option>
                ${artifacts.map(a => `
                  <option value="${a.name}" ${value === a.name ? 'selected' : ''}>${a.name}</option>
                `).join('')}
              </select>
            </div>
          `;
        }

        if (field.type === 'storage-rhai') {
          const artifacts = ctx.storedRhai || [];
          return `
            <div class="config-field">
              <label>${field.label}</label>
              <select class="cv-select" data-field="${field.name}">
                <option value="">-- Select from Storage --</option>
                ${artifacts.map(a => `
                  <option value="${a.name}" ${value === a.name ? 'selected' : ''}>${a.name}</option>
                `).join('')}
              </select>
            </div>
          `;
        }

        // Default text/number input
        return `
          <div class="config-field">
            <label>${field.label}</label>
            <input type="${field.type === 'number' ? 'number' : 'text'}"
                   class="cv-input"
                   data-field="${field.name}"
                   value="${value}"
                   placeholder="${field.placeholder || ''}">
          </div>
        `;
      }).join('')}
      <button class="cv-btn small danger workflow-delete-btn" id="deleteNodeBtn">Delete Node</button>
    </div>
  `;
}

/** Render logs panel */
export function renderLogs(logs: string[]): string {
  return `
    <div class="pro-section workflow-log-section">
      <div class="pro-section-title">Logs</div>
      <div class="pro-log workflow-log-scroll">
        ${logs.length === 0 ? '<div class="workflow-log-empty">No logs yet</div>' : ''}
        ${logs.map(log => `<div class="pro-log-entry">${log}</div>`).join('')}
      </div>
    </div>
  `;
}

/** Render the script editor modal */
export function renderScriptModal(node: WorkflowNode | undefined): string {
  if (!node) return '';

  return `
    <div class="script-modal-overlay" id="scriptModalOverlay">
      <div class="script-modal">
        <div class="script-modal-header">
          <span class="script-modal-title">Edit Script - ${node.label}</span>
          <div class="script-modal-actions">
            <button class="cv-btn small" id="scriptValidateBtn">Validate</button>
            <button class="cv-btn small" id="scriptCancelBtn">Cancel</button>
            <button class="cv-btn small accent" id="scriptSaveBtn">Save</button>
          </div>
        </div>
        <div class="script-modal-body">
          <workflow-script-editor id="modalScriptEditor"></workflow-script-editor>
        </div>
      </div>
    </div>
  `;
}

/** Render empty canvas state */
export function renderEmptyCanvas(): string {
  return `
    <div class="pro-empty workflow-empty-center">
      <div class="pro-empty-title">No nodes yet</div>
      <div class="pro-empty-hint">Drag nodes from the palette to get started</div>
    </div>
  `;
}

/** Render running status indicator */
export function renderRunningStatus(): string {
  return `
    <div class="workflow-status running">
      <span class="cv-status-dot active pulse"></span>
      Running
    </div>
  `;
}
