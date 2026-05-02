/**
 * Workflow Editor Types
 */

import type { CanFrame, DecodedSignal } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Core Workflow Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
  config: NodeConfig;
}

export interface WorkflowConnection {
  id: string;
  fromNode: string;
  fromOutput: number;
  toNode: string;
  toInput: number;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  inputs: string[];
  outputs: string[];
  configSchema?: ConfigField[];
}

export type NodeCategory = 'io' | 'filter' | 'transform' | 'logic' | 'script';

// ─────────────────────────────────────────────────────────────────────────────
// Node Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Config field type (includes storage types for referencing stored artifacts) */
export type ConfigFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'can-interface'
  | 'file-mdf4'
  | 'file-dbc'
  | 'hex-list'
  | 'rhai-script'
  | 'storage-dbc'       // Reference to stored DBC file
  | 'storage-mdf4'      // Reference to stored MDF4 file
  | 'storage-rhai';     // Reference to stored Rhai script

export interface ConfigField {
  name: string;
  label: string;
  type: ConfigFieldType;
  default?: unknown;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export type NodeConfig = Record<string, unknown>;

// Specific node configs
export interface FilterIdConfig extends NodeConfig {
  ids: number[];
  mode: 'include' | 'exclude';
}

export interface FilterDataConfig extends NodeConfig {
  pattern: string;
  mask: string;
}

export interface ThresholdConfig extends NodeConfig {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
}

export interface CounterConfig extends NodeConfig {
  resetInterval: number; // seconds, 0 = no reset
}

export interface ExportConfig extends NodeConfig {
  format: 'mdf4' | 'csv' | 'json';
  path: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Types
// ─────────────────────────────────────────────────────────────────────────────

/** Data that flows between nodes */
export type PortData = CanFrame[] | DecodedSignal[] | number | boolean | unknown;

/** Output from a node execution */
export interface NodeOutput {
  [portName: string]: PortData;
}

/** Input to a node execution */
export interface NodeInput {
  [portName: string]: PortData;
}

/** Node execution context */
export interface ExecutionContext {
  nodeId: string;
  config: NodeConfig;
  state: NodeState;
  log: (message: string) => void;
}

/** Per-node runtime state (counters, buffers, etc.) */
export type NodeState = Record<string, unknown>;

/** Node executor function */
export type NodeExecutor = (
  inputs: NodeInput,
  ctx: ExecutionContext
) => Promise<NodeOutput> | NodeOutput;

/** Runtime status */
export type RuntimeStatus = 'idle' | 'running' | 'paused' | 'error';

/** Runtime event */
export interface RuntimeEvent {
  type: 'started' | 'stopped' | 'paused' | 'error' | 'node-executed' | 'data-flow';
  nodeId?: string;
  message?: string;
  data?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

export interface SavedWorkflow {
  version: 1;
  workflow: Workflow;
  savedAt: string;
}
