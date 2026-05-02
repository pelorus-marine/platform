/**
 * Node Handler Base Class and Implementations
 *
 * Each node type has a handler that defines its behavior for:
 * - Configuration validation
 * - Subtitle display
 * - Config panel rendering
 * - Resource exclusivity (one-to-one relationships)
 */

import type { WorkflowNode, NodeConfig, ConfigField } from './types.js';
import type { WorkspacePath } from '../store';

// ─────────────────────────────────────────────────────────────────────────────
// Base Interface
// ─────────────────────────────────────────────────────────────────────────────

/** Stored artifact info for selection */
export interface StoredArtifact {
  name: string;
  size: number;
}

export interface NodeHandlerContext {
  /** All nodes in the workflow */
  allNodes: WorkflowNode[];
  /** Current node being handled */
  node: WorkflowNode;
  /** Available CAN interfaces from store */
  canInterfaces: WorkspacePath[];
  /** Available MDF4 files from store */
  mdf4Files: WorkspacePath[];
  /** Stored DBC artifacts */
  storedDbc: StoredArtifact[];
  /** Stored MDF4 artifacts */
  storedMdf4: StoredArtifact[];
  /** Stored Rhai scripts */
  storedRhai: StoredArtifact[];
}

export interface NodeHandler {
  /** Node type this handler is for */
  readonly type: string;

  /** Primary config field name (e.g., 'interface', 'file', 'ids') */
  readonly configField: string;

  /** Placeholder text when not configured */
  readonly placeholder: string;

  /** Check if node is properly configured */
  isConfigured(config: NodeConfig): boolean;

  /** Get subtitle text (config value when configured, placeholder when not) */
  getSubtitle(config: NodeConfig): string;

  /**
   * Check if resource is still valid (called when store changes)
   * Returns the config value to clear if invalid, or null if still valid
   */
  validateResource?(config: NodeConfig, ctx: NodeHandlerContext): string | null;

  /**
   * Get resources taken by other nodes of the same type
   * Used for exclusive resource selection (one-to-one)
   */
  getTakenResources?(ctx: NodeHandlerContext): Set<string>;

  /**
   * Get available resources for selection (filters out taken ones)
   */
  getAvailableResources?(ctx: NodeHandlerContext): WorkspacePath[];

  /**
   * Render custom config field HTML (optional - uses schema-based rendering if not provided)
   */
  renderConfigField?(value: unknown, field: ConfigField, ctx: NodeHandlerContext): string | null;

  /**
   * Handle config change - clear from other nodes if exclusive
   */
  onConfigChange?(value: unknown, ctx: NodeHandlerContext): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Implementation
// ─────────────────────────────────────────────────────────────────────────────

export abstract class BaseNodeHandler implements NodeHandler {
  abstract readonly type: string;
  abstract readonly configField: string;
  abstract readonly placeholder: string;

  isConfigured(config: NodeConfig): boolean {
    return Boolean(config[this.configField]);
  }

  getSubtitle(config: NodeConfig): string {
    const value = config[this.configField];
    if (value) {
      return this.formatValue(value);
    }
    return this.placeholder;
  }

  /** Format the config value for display (override for custom formatting) */
  protected formatValue(value: unknown): string {
    return String(value);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAN Node Handler
// ─────────────────────────────────────────────────────────────────────────────

export class CanNodeHandler extends BaseNodeHandler {
  readonly type = 'can';
  readonly configField = 'interface';
  readonly placeholder = 'Select CAN interface';

  validateResource(config: NodeConfig, ctx: NodeHandlerContext): string | null {
    const iface = config.interface as string;
    if (!iface) return null;

    const available = new Set(ctx.canInterfaces.map(i => i.name));
    return available.has(iface) ? null : 'interface';
  }

  getTakenResources(ctx: NodeHandlerContext): Set<string> {
    return new Set(
      ctx.allNodes
        .filter(n => n.type === 'can' && n.id !== ctx.node.id && n.config.interface)
        .map(n => n.config.interface as string)
    );
  }

  getAvailableResources(ctx: NodeHandlerContext): WorkspacePath[] {
    const taken = this.getTakenResources(ctx);
    const currentValue = ctx.node.config.interface as string;
    return ctx.canInterfaces.filter(
      iface => !taken.has(iface.name) || iface.name === currentValue
    );
  }

  renderConfigField(value: unknown, field: ConfigField, ctx: NodeHandlerContext): string | null {
    if (field.type !== 'can-interface') return null;

    const available = this.getAvailableResources(ctx);
    return `
      <div class="config-field">
        <label>${field.label}</label>
        <select class="cv-select" data-field="${field.name}">
          <option value="">-- Select --</option>
          ${available.map(iface => `
            <option value="${iface.name}" ${value === iface.name ? 'selected' : ''}>${iface.name}</option>
          `).join('')}
        </select>
      </div>
    `;
  }

  onConfigChange(value: unknown, ctx: NodeHandlerContext): void {
    if (!value) return;
    // Clear from other CAN nodes that had this interface
    for (const other of ctx.allNodes) {
      if (other.type === 'can' && other.id !== ctx.node.id && other.config.interface === value) {
        other.config.interface = '';
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MDF4 Node Handler
// ─────────────────────────────────────────────────────────────────────────────

export class Mdf4NodeHandler extends BaseNodeHandler {
  readonly type = 'mdf4';
  readonly configField = 'file';
  readonly placeholder = 'Select MDF4 file';

  protected override formatValue(value: unknown): string {
    return String(value).split('/').pop() || '';
  }

  validateResource(config: NodeConfig, ctx: NodeHandlerContext): string | null {
    const file = config.file as string;
    if (!file) return null;

    const available = new Set(ctx.mdf4Files.map(f => f.path));
    return available.has(file) ? null : 'file';
  }

  getTakenResources(ctx: NodeHandlerContext): Set<string> {
    return new Set(
      ctx.allNodes
        .filter(n => n.type === 'mdf4' && n.id !== ctx.node.id && n.config.file)
        .map(n => n.config.file as string)
    );
  }

  getAvailableResources(ctx: NodeHandlerContext): WorkspacePath[] {
    const taken = this.getTakenResources(ctx);
    const currentValue = ctx.node.config.file as string;
    return ctx.mdf4Files.filter(
      f => !taken.has(f.path) || f.path === currentValue
    );
  }

  renderConfigField(value: unknown, field: ConfigField, ctx: NodeHandlerContext): string | null {
    if (field.type !== 'file-mdf4') return null;

    const available = this.getAvailableResources(ctx);
    const fileName = value ? String(value).split('/').pop() : '';

    return `
      <div class="config-field">
        <label>${field.label}</label>
        ${available.length > 0 ? `
          <select class="cv-select" data-field="${field.name}" style="margin-bottom:4px;">
            <option value="">-- Select --</option>
            ${available.map(f => `
              <option value="${f.path}" ${value === f.path ? 'selected' : ''}>${f.name}</option>
            `).join('')}
          </select>
        ` : ''}
        <div style="display:flex;gap:4px;">
          <input type="text" class="cv-input" value="${fileName}" readonly style="flex:1;cursor:pointer;" title="${value}" placeholder="Or select file...">
          <button class="cv-btn small" data-file-picker="${field.name}" data-ext="mf4" title="Open existing">Open</button>
          <button class="cv-btn small" data-file-new="${field.name}" data-ext="mf4" title="Create new">New</button>
        </div>
      </div>
    `;
  }

  onConfigChange(value: unknown, ctx: NodeHandlerContext): void {
    if (!value) return;
    // Clear from other MDF4 nodes that had this file
    for (const other of ctx.allNodes) {
      if (other.type === 'mdf4' && other.id !== ctx.node.id && other.config.file === value) {
        other.config.file = '';
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter by ID Node Handler
// ─────────────────────────────────────────────────────────────────────────────

export class FilterIdNodeHandler extends BaseNodeHandler {
  readonly type = 'filter-id';
  readonly configField = 'ids';
  readonly placeholder = 'Configure IDs';

  protected override formatValue(value: unknown): string {
    const ids = String(value).trim();
    return ids.length > 25 ? ids.substring(0, 22) + '...' : ids;
  }

  renderConfigField(value: unknown, field: ConfigField, _ctx: NodeHandlerContext): string | null {
    if (field.type !== 'hex-list') return null;

    const ids = String(value || '').split(',').map(s => s.trim()).filter(Boolean);
    return `
      <div class="config-field">
        <label>${field.label}</label>
        <div class="hex-chips" data-field="${field.name}">
          ${ids.map(id => `
            <span class="hex-chip">
              ${id}
              <span class="hex-chip-remove" data-remove="${id}">×</span>
            </span>
          `).join('')}
        </div>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <input type="text"
                 class="cv-input hex-input"
                 placeholder="0x123"
                 style="font-family:monospace;flex:1;">
          <button class="cv-btn small" data-add-hex="${field.name}">Add</button>
        </div>
      </div>
    `;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DBC Decode/Encode Node Handler
// ─────────────────────────────────────────────────────────────────────────────

export class DbcNodeHandler extends BaseNodeHandler {
  readonly configField = 'dbc';
  readonly placeholder = 'Select DBC file';

  constructor(readonly type: 'decode' | 'encode') {
    super();
  }

  protected override formatValue(value: unknown): string {
    return String(value).split('/').pop() || '';
  }

  renderConfigField(value: unknown, field: ConfigField, _ctx: NodeHandlerContext): string | null {
    if (field.type !== 'file-dbc') return null;

    const fileName = value ? String(value).split('/').pop() : '';
    return `
      <div class="config-field">
        <label>${field.label}</label>
        <div style="display:flex;gap:4px;">
          <input type="text" class="cv-input" data-field="${field.name}" value="${fileName}" readonly style="flex:1;cursor:pointer;" title="${value}">
          <button class="cv-btn small" data-file-picker="${field.name}" data-ext="dbc">...</button>
        </div>
      </div>
    `;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple Node Handlers (no custom rendering)
// ─────────────────────────────────────────────────────────────────────────────

export class FilterDataNodeHandler extends BaseNodeHandler {
  readonly type = 'filter-data';
  readonly configField = 'pattern';
  readonly placeholder = 'Configure pattern';
}

export class FilterSignalNameNodeHandler extends BaseNodeHandler {
  readonly type = 'filter-signal-name';
  readonly configField = 'names';
  readonly placeholder = 'Configure signals';
}

export class FilterSignalValueNodeHandler extends BaseNodeHandler {
  readonly type = 'filter-signal-value';
  readonly configField = 'signal';
  readonly placeholder = 'Configure condition';

  override getSubtitle(config: NodeConfig): string {
    if (config.signal) {
      const op = config.operator || '>';
      const val = config.value ?? 0;
      return `${config.signal} ${op} ${val}`;
    }
    return this.placeholder;
  }
}

export class ThresholdNodeHandler extends BaseNodeHandler {
  readonly type = 'threshold';
  readonly configField = 'value';
  readonly placeholder = 'Configure threshold';

  override isConfigured(config: NodeConfig): boolean {
    return config.value !== undefined && config.value !== '';
  }

  override getSubtitle(config: NodeConfig): string {
    if (config.value !== undefined && config.value !== '') {
      const op = config.operator || '>';
      return `${config.field || 'value'} ${op} ${config.value}`;
    }
    return this.placeholder;
  }
}

export class CounterNodeHandler extends BaseNodeHandler {
  readonly type = 'counter';
  readonly configField = 'resetInterval';
  readonly placeholder = 'Count events';

  override isConfigured(_config: NodeConfig): boolean {
    return true; // Counter is always "configured"
  }

  override getSubtitle(config: NodeConfig): string {
    const interval = config.resetInterval as number;
    return interval > 0 ? `Reset every ${interval}s` : 'No reset';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Script Node Handler
// ─────────────────────────────────────────────────────────────────────────────

export class ScriptNodeHandler extends BaseNodeHandler {
  readonly type = 'script';
  readonly configField = 'script';
  readonly placeholder = 'Configure script';

  override isConfigured(config: NodeConfig): boolean {
    const script = config.script as string;
    return Boolean(script && script.trim().length > 0);
  }

  protected override formatValue(value: unknown): string {
    const script = String(value || '').trim();
    if (!script) return '';
    const lineCount = script.split('\n').length;
    return `${lineCount} line${lineCount !== 1 ? 's' : ''}`;
  }

  renderConfigField(value: unknown, field: ConfigField, _ctx: NodeHandlerContext): string | null {
    if (field.type !== 'rhai-script') return null;

    const script = String(value || '').trim();
    const lineCount = script ? script.split('\n').length : 0;
    const preview = script ? script.split('\n')[0].substring(0, 30) + (script.split('\n')[0].length > 30 ? '...' : '') : '';

    return `
      <div class="config-field">
        <label>${field.label}</label>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${script ? `
            <div style="font-size:0.7rem;color:var(--cv-text-dim);">
              ${lineCount} line${lineCount !== 1 ? 's' : ''}${preview ? `: ${preview}` : ''}
            </div>
          ` : ''}
          <button class="cv-btn small accent" data-edit-script="${field.name}" style="width:100%;">
            ${script ? 'Edit Script' : 'Create Script'}
          </button>
        </div>
      </div>
    `;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler Registry
// ─────────────────────────────────────────────────────────────────────────────

const handlers: Map<string, NodeHandler> = new Map();

// Register all handlers
[
  new CanNodeHandler(),
  new Mdf4NodeHandler(),
  new FilterIdNodeHandler(),
  new FilterDataNodeHandler(),
  new FilterSignalNameNodeHandler(),
  new FilterSignalValueNodeHandler(),
  new DbcNodeHandler('decode'),
  new DbcNodeHandler('encode'),
  new ThresholdNodeHandler(),
  new CounterNodeHandler(),
  new ScriptNodeHandler(),
].forEach(h => handlers.set(h.type, h));

/** Get handler for a node type */
export function getNodeHandler(type: string): NodeHandler | undefined {
  return handlers.get(type);
}

/** Check if node is configured using its handler */
export function isNodeConfigured(node: WorkflowNode): boolean {
  const handler = handlers.get(node.type);
  return handler ? handler.isConfigured(node.config) : true;
}

/** Get subtitle for node using its handler */
export function getNodeSubtitle(node: WorkflowNode): string {
  const handler = handlers.get(node.type);
  return handler ? handler.getSubtitle(node.config) : '';
}
