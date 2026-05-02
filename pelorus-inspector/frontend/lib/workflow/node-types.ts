/**
 * Workflow Node Type Definitions
 */

import type { NodeTypeDefinition, NodeCategory } from './types.js';

export const NODE_TYPES: NodeTypeDefinition[] = [
  // I/O nodes - associate with CAN interface or MDF4 file
  {
    type: 'can',
    label: 'CAN',
    category: 'io',
    inputs: ['frames'],
    outputs: ['frames'],
    configSchema: [
      { name: 'interface', label: 'CAN Interface', type: 'can-interface', default: '' },
    ],
  },
  {
    type: 'mdf4',
    label: 'MDF4',
    category: 'io',
    inputs: ['frames'],
    outputs: ['frames'],
    configSchema: [
      {
        name: 'source',
        label: 'Source',
        type: 'select',
        default: 'file',
        options: [
          { label: 'File', value: 'file' },
          { label: 'Storage', value: 'storage' },
        ],
      },
      { name: 'file', label: 'MDF4 File', type: 'file-mdf4', default: '' },
      { name: 'storageName', label: 'Stored MDF4', type: 'storage-mdf4', default: '' },
      {
        name: 'mode',
        label: 'Playback Mode',
        type: 'select',
        default: 'realtime',
        options: [
          { label: 'Realtime', value: 'realtime' },
          { label: 'As fast as possible', value: 'fast' },
        ],
      },
      { name: 'loop', label: 'Loop Playback', type: 'boolean', default: false },
    ],
  },
  {
    type: 'simulator',
    label: 'Simulator',
    category: 'io',
    inputs: [],
    outputs: ['frames'],
    configSchema: [
      { name: 'interface', label: 'CAN Interface', type: 'can-interface', default: '' },
      { name: 'rate', label: 'Frame Rate (Hz)', type: 'number', default: 100 },
      {
        name: 'mode',
        label: 'Mode',
        type: 'select',
        default: 'continuous',
        options: [
          { label: 'Continuous', value: 'continuous' },
          { label: 'Burst', value: 'burst' },
        ],
      },
      {
        name: 'scriptSource',
        label: 'Script Source',
        type: 'select',
        default: 'inline',
        options: [
          { label: 'Inline', value: 'inline' },
          { label: 'Storage', value: 'storage' },
        ],
      },
      { name: 'script', label: 'Rhai Script', type: 'rhai-script', default: '' },
      { name: 'storedScript', label: 'Stored Script', type: 'storage-rhai', default: '' },
    ],
  },

  // Frame filter nodes (CAN frames - blue)
  {
    type: 'filter-id',
    label: 'Filter by ID',
    category: 'filter',
    inputs: ['frames'],
    outputs: ['match', 'other'],
    configSchema: [
      { name: 'ids', label: 'Message IDs (hex)', type: 'hex-list', default: '', placeholder: '0x123, 0x456' },
      {
        name: 'mode',
        label: 'Mode',
        type: 'select',
        default: 'include',
        options: [
          { label: 'Include', value: 'include' },
          { label: 'Exclude', value: 'exclude' },
        ],
      },
    ],
  },
  {
    type: 'filter-data',
    label: 'Filter by Data',
    category: 'filter',
    inputs: ['frames'],
    outputs: ['match', 'other'],
    configSchema: [
      { name: 'pattern', label: 'Data Pattern (hex)', type: 'string', default: '' },
      { name: 'mask', label: 'Mask (hex)', type: 'string', default: 'FFFFFFFFFFFFFFFF' },
    ],
  },

  // Signal filter nodes (decoded signals - pink)
  {
    type: 'filter-signal-name',
    label: 'Filter by Signal',
    category: 'filter',
    inputs: ['signals'],
    outputs: ['match', 'other'],
    configSchema: [
      { name: 'names', label: 'Signal Names', type: 'string', default: '' },
      {
        name: 'mode',
        label: 'Mode',
        type: 'select',
        default: 'include',
        options: [
          { label: 'Include', value: 'include' },
          { label: 'Exclude', value: 'exclude' },
        ],
      },
    ],
  },
  {
    type: 'filter-signal-value',
    label: 'Filter by Value',
    category: 'filter',
    inputs: ['signals'],
    outputs: ['match', 'other'],
    configSchema: [
      { name: 'signal', label: 'Signal Name', type: 'string', default: '' },
      {
        name: 'operator',
        label: 'Operator',
        type: 'select',
        default: '>',
        options: [
          { label: '>', value: '>' },
          { label: '<', value: '<' },
          { label: '>=', value: '>=' },
          { label: '<=', value: '<=' },
          { label: '==', value: '==' },
          { label: '!=', value: '!=' },
        ],
      },
      { name: 'value', label: 'Value', type: 'number', default: 0 },
    ],
  },

  // Transform nodes
  {
    type: 'decode',
    label: 'DBC Decode',
    category: 'transform',
    inputs: ['frames'],
    outputs: ['signals'],
    configSchema: [
      {
        name: 'dbcSource',
        label: 'DBC Source',
        type: 'select',
        default: 'file',
        options: [
          { label: 'File', value: 'file' },
          { label: 'Storage', value: 'storage' },
        ],
      },
      { name: 'dbc', label: 'DBC File', type: 'file-dbc', default: '' },
      { name: 'storedDbc', label: 'Stored DBC', type: 'storage-dbc', default: '' },
    ],
  },
  {
    type: 'encode',
    label: 'DBC Encode',
    category: 'transform',
    inputs: ['signals'],
    outputs: ['frames'],
    configSchema: [
      {
        name: 'dbcSource',
        label: 'DBC Source',
        type: 'select',
        default: 'file',
        options: [
          { label: 'File', value: 'file' },
          { label: 'Storage', value: 'storage' },
        ],
      },
      { name: 'dbc', label: 'DBC File', type: 'file-dbc', default: '' },
      { name: 'storedDbc', label: 'Stored DBC', type: 'storage-dbc', default: '' },
    ],
  },

  // Script nodes
  {
    type: 'script',
    label: 'Rhai Script',
    category: 'script',
    inputs: ['frames'],
    outputs: ['frames'],
    configSchema: [
      {
        name: 'scriptSource',
        label: 'Script Source',
        type: 'select',
        default: 'inline',
        options: [
          { label: 'Inline', value: 'inline' },
          { label: 'Storage', value: 'storage' },
        ],
      },
      { name: 'script', label: 'Script', type: 'rhai-script', default: '' },
      { name: 'storedScript', label: 'Stored Script', type: 'storage-rhai', default: '' },
    ],
  },

  // Logic nodes
  {
    type: 'threshold',
    label: 'Threshold',
    category: 'logic',
    inputs: ['value'],
    outputs: ['above', 'below'],
    configSchema: [
      { name: 'field', label: 'Signal Name (optional)', type: 'string', default: '' },
      {
        name: 'operator',
        label: 'Operator',
        type: 'select',
        default: '>',
        options: [
          { label: '>', value: '>' },
          { label: '<', value: '<' },
          { label: '>=', value: '>=' },
          { label: '<=', value: '<=' },
          { label: '==', value: '==' },
          { label: '!=', value: '!=' },
        ],
      },
      { name: 'value', label: 'Threshold Value', type: 'number', default: 0 },
    ],
  },
  {
    type: 'counter',
    label: 'Counter',
    category: 'logic',
    inputs: ['trigger'],
    outputs: ['count'],
    configSchema: [
      { name: 'resetInterval', label: 'Reset Interval (sec, 0=never)', type: 'number', default: 0 },
    ],
  },
];

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  io: '#22c55e',
  filter: '#f97316',
  transform: '#ec4899',
  logic: '#eab308',
  script: '#8b5cf6',
};

/** Category display labels */
export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  io: 'INPUT / OUTPUT',
  filter: 'FILTER',
  transform: 'TRANSFORM',
  logic: 'LOGIC',
  script: 'SCRIPT',
};

/** Node-specific colors (override category colors) */
export const NODE_COLORS: Record<string, string> = {
  // I/O - blue
  'can': '#3b82f6',
  'mdf4': '#3b82f6',
  'simulator': '#3b82f6',
  // Frame filters - blue
  'filter-id': '#3b82f6',
  'filter-data': '#3b82f6',
  // Signal filters - pink
  'filter-signal-name': '#ec4899',
  'filter-signal-value': '#ec4899',
  // DBC transform - pink
  'decode': '#ec4899',
  'encode': '#ec4899',
  // Script - purple
  'script': '#8b5cf6',
};

/** Get color for a node category */
export function getCategoryColor(category: NodeCategory): string {
  return CATEGORY_COLORS[category] || '#6b7280';
}

/** Get color for a node type (uses node-specific color if available, otherwise category color) */
export function getNodeColor(type: string): string {
  if (NODE_COLORS[type]) {
    return NODE_COLORS[type];
  }
  const nodeType = NODE_TYPES.find(n => n.type === type);
  return nodeType ? CATEGORY_COLORS[nodeType.category] : '#6b7280';
}

/** Get node type definition by type name */
export function getNodeType(type: string): NodeTypeDefinition | undefined {
  return NODE_TYPES.find(n => n.type === type);
}

/** Get node types grouped by category */
export function getNodeTypesByCategory(): Map<NodeCategory, NodeTypeDefinition[]> {
  const grouped = new Map<NodeCategory, NodeTypeDefinition[]>();

  NODE_TYPES.forEach(node => {
    const list = grouped.get(node.category) || [];
    list.push(node);
    grouped.set(node.category, list);
  });

  return grouped;
}
