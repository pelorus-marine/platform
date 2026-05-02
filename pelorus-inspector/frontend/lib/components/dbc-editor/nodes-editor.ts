/**
 * Nodes editor component for managing ECU/node names with optional comments.
 */

import type { NodeDto } from './types';
import { createEvent, isValidDbcName } from './utils';
import { escapeHtml } from '../../utils/html';
import styles from '../../../styles/pelorus-inspector.css?inline';

export class NodesEditorElement extends HTMLElement {
  private nodes: NodeDto[] = [];
  private editingNodeName: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  setNodes(nodes: NodeDto[]) {
    this.nodes = nodes.map(n => ({ ...n }));
    this.render();
  }

  getNodes(): NodeDto[] {
    return this.nodes;
  }

  private render() {
    if (!this.shadowRoot) return;

    const nodeTags = this.nodes.map(node => {
      const isEditing = this.editingNodeName === node.name;
      if (isEditing) {
        return `
          <div class="cv-node-card editing">
            <div class="cv-node-card-header">
              <span class="cv-node-name">${escapeHtml(node.name)}</span>
              <button class="cv-node-remove" data-node="${escapeHtml(node.name)}">&times;</button>
            </div>
            <div class="cv-node-card-body">
              <textarea class="cv-textarea cv-node-comment-input" id="node-comment-${escapeHtml(node.name)}"
                        rows="2" placeholder="Optional comment...">${node.comment || ''}</textarea>
              <div class="cv-node-actions">
                <button class="cv-btn small success" data-save-node="${escapeHtml(node.name)}">Save</button>
                <button class="cv-btn small" data-cancel-node="${escapeHtml(node.name)}">Cancel</button>
              </div>
            </div>
          </div>
        `;
      }
      return `
        <div class="cv-node-card" data-click-node="${escapeHtml(node.name)}">
          <div class="cv-node-card-header">
            <span class="cv-node-name">${escapeHtml(node.name)}</span>
            <button class="cv-node-remove" data-node="${escapeHtml(node.name)}">&times;</button>
          </div>
          ${node.comment ? `<div class="cv-node-comment">${escapeHtml(node.comment)}</div>` : ''}
        </div>
      `;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>${styles}
        :host { display: block; }
        .cv-nodes-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .cv-node-card {
          display: flex;
          flex-direction: column;
          padding: 8px 12px;
          background: var(--cv-bg-elevated);
          border: 1px solid var(--cv-border);
          border-radius: var(--cv-radius);
          min-width: 120px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .cv-node-card:hover {
          border-color: var(--cv-accent);
        }
        .cv-node-card.editing {
          cursor: default;
          border-color: var(--cv-accent);
          min-width: 250px;
        }
        .cv-node-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .cv-node-name {
          font-weight: 500;
          color: var(--cv-text);
        }
        .cv-node-comment {
          font-size: 0.8rem;
          color: var(--cv-text-muted);
          font-style: italic;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px dashed var(--cv-border);
        }
        .cv-node-card-body {
          margin-top: 8px;
        }
        .cv-node-comment-input {
          width: 100%;
          min-height: 50px;
        }
        .cv-node-actions {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }
      </style>

      ${this.nodes.length === 0 ? `
        <p class="cv-empty-message" style="text-align: left; padding: 0; margin-bottom: 12px; font-style: italic;">No nodes defined. Add ECU/node names below.</p>
      ` : `
        <div class="cv-nodes-grid">${nodeTags}</div>
      `}

      <div class="cv-add-node-form">
        <input type="text" class="cv-input" id="new-node-input" placeholder="Enter node name (e.g., ECM, TCM)">
        <button class="cv-btn primary" id="add-node-btn">Add Node</button>
      </div>
    `;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    // Remove node buttons
    this.shadowRoot.querySelectorAll('.cv-node-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeName = (btn as HTMLElement).dataset.node;
        if (nodeName) {
          this.nodes = this.nodes.filter(n => n.name !== nodeName);
          if (this.editingNodeName === nodeName) {
            this.editingNodeName = null;
          }
          this.notifyChange();
          this.render();
        }
      });
    });

    // Click to edit node
    this.shadowRoot.querySelectorAll('[data-click-node]').forEach((card) => {
      card.addEventListener('click', () => {
        const nodeName = (card as HTMLElement).dataset.clickNode;
        if (nodeName && this.editingNodeName !== nodeName) {
          this.editingNodeName = nodeName;
          this.render();
        }
      });
    });

    // Save node comment
    this.shadowRoot.querySelectorAll('[data-save-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nodeName = (btn as HTMLElement).dataset.saveNode;
        if (nodeName) {
          const textarea = this.shadowRoot!.getElementById(`node-comment-${nodeName}`) as HTMLTextAreaElement;
          const node = this.nodes.find(n => n.name === nodeName);
          if (node && textarea) {
            node.comment = textarea.value.trim() || null;
            this.editingNodeName = null;
            this.notifyChange();
            this.render();
          }
        }
      });
    });

    // Cancel node editing
    this.shadowRoot.querySelectorAll('[data-cancel-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.editingNodeName = null;
        this.render();
      });
    });

    // Add node form
    const input = this.shadowRoot.getElementById('new-node-input') as HTMLInputElement;
    const addBtn = this.shadowRoot.getElementById('add-node-btn');

    const addNode = () => {
      const name = input.value.trim();
      if (name && !this.nodes.some(n => n.name === name)) {
        if (!isValidDbcName(name)) {
          alert('Node name must start with a letter or underscore and contain only alphanumeric characters and underscores.');
          return;
        }
        this.nodes.push({ name, comment: null });
        input.value = '';
        this.notifyChange();
        this.render();
      } else if (this.nodes.some(n => n.name === name)) {
        alert(`Node "${name}" already exists.`);
      }
    };

    addBtn?.addEventListener('click', addNode);
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addNode();
      }
    });
  }

  private notifyChange() {
    this.dispatchEvent(createEvent('nodes-change', { nodes: this.nodes }));
  }
}

customElements.define('cv-nodes-editor', NodesEditorElement);
