/**
 * DBC Editor specific utilities.
 */

// Re-export shared utilities for convenience
export { deepClone, createEvent, formatCanId } from '../../utils';

/**
 * Validate a DBC identifier name (node, signal, message names).
 * Must start with letter/underscore, contain only alphanumeric and underscores.
 */
export function isValidDbcName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Signal colors for bit layout visualization.
 */
export const SIGNAL_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
] as const;

/**
 * Get color for a signal by index.
 */
export function getSignalColor(index: number): string {
  return SIGNAL_COLORS[index % SIGNAL_COLORS.length];
}

/**
 * Convert signal start_bit to linear bit position for visualization.
 * Handles both Intel (little endian) and Motorola (big endian) byte orders.
 *
 * DBC bit numbering:
 * - Byte 0: bits 7,6,5,4,3,2,1,0
 * - Byte 1: bits 15,14,13,12,11,10,9,8
 * - etc.
 *
 * Intel (little endian): start_bit is LSB, signal grows upward
 * Motorola (big endian): start_bit is MSB, signal grows downward
 */
export function getLinearBitPosition(
  startBit: number,
  length: number,
  byteOrder: 'little_endian' | 'big_endian'
): { start: number; end: number } {
  if (byteOrder === 'little_endian') {
    return { start: startBit, end: startBit + length - 1 };
  } else {
    const linearStart = startBit - length + 1;
    return { start: Math.max(0, linearStart), end: startBit };
  }
}

/**
 * Calculate slider constraints based on byte order.
 * Returns min/max values for start bit and length sliders.
 */
export function getSliderConstraints(
  totalBits: number,
  currentStart: number,
  currentLength: number,
  byteOrder: 'little_endian' | 'big_endian'
): { startMin: number; startMax: number; lenMin: number; lenMax: number } {
  if (byteOrder === 'little_endian') {
    return {
      startMin: 0,
      startMax: Math.max(0, totalBits - currentLength),
      lenMin: 1,
      lenMax: Math.max(1, totalBits - currentStart),
    };
  } else {
    return {
      startMin: Math.max(0, currentLength - 1),
      startMax: totalBits - 1,
      lenMin: 1,
      lenMax: Math.min(64, currentStart + 1),
    };
  }
}

/**
 * Export a DbcDto to DBC file format string.
 */
export function exportDbcToString(dbc: import('./types').DbcDto): string {
  const lines: string[] = [];

  // VERSION
  lines.push(`VERSION "${dbc.version || ''}"`);
  lines.push('');

  // NS_ (new symbols) - empty
  lines.push('NS_ :');
  lines.push('');

  // BS_ (bit timing)
  if (dbc.bit_timing && dbc.bit_timing.baudrate > 0) {
    if (dbc.bit_timing.btr1 > 0 || dbc.bit_timing.btr2 > 0) {
      lines.push(`BS_: ${dbc.bit_timing.baudrate} : ${dbc.bit_timing.btr1},${dbc.bit_timing.btr2}`);
    } else {
      lines.push(`BS_: ${dbc.bit_timing.baudrate}`);
    }
  } else {
    lines.push('BS_:');
  }
  lines.push('');

  // BU_ (nodes)
  if (dbc.nodes.length > 0) {
    lines.push(`BU_: ${dbc.nodes.map(n => n.name).join(' ')}`);
  } else {
    lines.push('BU_:');
  }
  lines.push('');

  // BO_ (messages) and SG_ (signals)
  for (const msg of dbc.messages) {
    const msgId = msg.is_extended ? (msg.id | 0x80000000) : msg.id;
    lines.push(`BO_ ${msgId} ${msg.name}: ${msg.dlc} ${msg.sender}`);

    for (const sig of msg.signals) {
      // Byte order: 1 = little endian (Intel), 0 = big endian (Motorola)
      const byteOrder = sig.byte_order === 'little_endian' ? 1 : 0;
      // Value type: + = unsigned, - = signed
      const valueType = sig.is_unsigned ? '+' : '-';

      // Multiplexer indicator
      let muxIndicator = '';
      if (sig.is_multiplexer) {
        muxIndicator = ' M';
      } else if (sig.multiplexer_value !== null) {
        muxIndicator = ` m${sig.multiplexer_value}`;
      }

      // Receivers
      let receivers = 'Vector__XXX';
      if (sig.receivers.type === 'nodes' && sig.receivers.nodes.length > 0) {
        receivers = sig.receivers.nodes.join(',');
      }

      const unit = sig.unit || '';
      lines.push(
        ` SG_ ${sig.name}${muxIndicator} : ${sig.start_bit}|${sig.length}@${byteOrder}${valueType} ` +
        `(${sig.factor},${sig.offset}) [${sig.min}|${sig.max}] "${unit}" ${receivers}`
      );
    }

    lines.push('');
  }

  // CM_ (comments)
  // Database comment
  if (dbc.comment) {
    lines.push(`CM_ "${escapeDbcString(dbc.comment)}" ;`);
  }

  // Node comments
  for (const node of dbc.nodes) {
    if (node.comment) {
      lines.push(`CM_ BU_ ${node.name} "${escapeDbcString(node.comment)}" ;`);
    }
  }

  // Message and signal comments
  for (const msg of dbc.messages) {
    const msgId = msg.is_extended ? (msg.id | 0x80000000) : msg.id;
    if (msg.comment) {
      lines.push(`CM_ BO_ ${msgId} "${escapeDbcString(msg.comment)}" ;`);
    }
    for (const sig of msg.signals) {
      if (sig.comment) {
        lines.push(`CM_ SG_ ${msgId} ${sig.name} "${escapeDbcString(sig.comment)}" ;`);
      }
    }
  }

  // BA_DEF_ (attribute definitions)
  for (const def of dbc.attribute_definitions) {
    const objectType = getAttributeObjectTypeKeyword(def.object_type);
    const valueType = getAttributeValueTypeString(def.value_type);
    lines.push(`BA_DEF_ ${objectType}"${def.name}" ${valueType} ;`);
  }

  // BA_DEF_DEF_ (attribute defaults)
  for (const def of dbc.attribute_defaults) {
    const valueStr = typeof def.value === 'string' ? `"${escapeDbcString(def.value)}"` : String(def.value);
    lines.push(`BA_DEF_DEF_ "${def.name}" ${valueStr} ;`);
  }

  // BA_ (attribute values)
  for (const val of dbc.attribute_values) {
    const targetStr = getAttributeTargetString(val.target);
    const valueStr = typeof val.value === 'string' ? `"${escapeDbcString(val.value)}"` : String(val.value);
    lines.push(`BA_ "${val.name}" ${targetStr}${valueStr} ;`);
  }

  // VAL_ (value descriptions)
  for (const vd of dbc.value_descriptions) {
    // Skip empty value descriptions (no entries)
    if (vd.descriptions.length === 0) continue;

    const msgId = vd.message_id;
    const entries = vd.descriptions
      .map(d => `${d.value} "${escapeDbcString(d.description)}"`)
      .join(' ');
    lines.push(`VAL_ ${msgId} ${vd.signal_name} ${entries} ;`);
  }

  // SG_MUL_VAL_ (extended multiplexing)
  for (const em of dbc.extended_multiplexing) {
    const ranges = em.ranges.map(r => `${r[0]}-${r[1]}`).join(', ');
    lines.push(`SG_MUL_VAL_ ${em.message_id} ${em.signal_name} ${em.multiplexer_signal} ${ranges} ;`);
  }

  // End with empty line
  lines.push('');

  return lines.join('\n');
}

/**
 * Get the DBC keyword for an attribute object type.
 */
function getAttributeObjectTypeKeyword(objectType: string): string {
  switch (objectType) {
    case 'node':
      return 'BU_ ';
    case 'message':
      return 'BO_ ';
    case 'signal':
      return 'SG_ ';
    default:
      return ''; // network has no keyword
  }
}

/**
 * Format an attribute value type for DBC output.
 */
function getAttributeValueTypeString(valueType: import('./types').AttributeValueType): string {
  switch (valueType.type) {
    case 'int':
      return `INT ${valueType.min} ${valueType.max}`;
    case 'hex':
      return `HEX ${valueType.min} ${valueType.max}`;
    case 'float':
      return `FLOAT ${valueType.min} ${valueType.max}`;
    case 'string':
      return 'STRING';
    case 'enum':
      return `ENUM ${valueType.values.map(v => `"${escapeDbcString(v)}"`).join(',')}`;
    default:
      return 'STRING';
  }
}

/**
 * Format an attribute target for DBC output.
 */
function getAttributeTargetString(target: import('./types').AttributeTarget): string {
  switch (target.type) {
    case 'network':
      return '';
    case 'node':
      return `BU_ ${target.node_name} `;
    case 'message':
      return `BO_ ${target.message_id} `;
    case 'signal':
      return `SG_ ${target.message_id} ${target.signal_name} `;
    default:
      return '';
  }
}

/**
 * Escape a string for DBC file format.
 * DBC strings cannot contain backslashes, newlines, or unescaped quotes.
 */
function escapeDbcString(str: string): string {
  return str
    .replace(/\\/g, '')      // Remove backslashes (not supported in DBC)
    .replace(/\n/g, ' ')     // Replace newlines with spaces
    .replace(/\r/g, '')      // Remove carriage returns
    .replace(/"/g, "'");     // Replace double quotes with single quotes
}
