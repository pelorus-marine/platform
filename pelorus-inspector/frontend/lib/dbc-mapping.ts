/**
 * DBC Type Mapping Utilities
 *
 * Converts backend DbcInfo types to editor DbcDto format.
 */

import type { DbcInfo, AttributeValueType as BackendAttrValueType, AttributeTargetInfo, AttributeValueInfo } from './types';
import type { DbcDto, AttributeValueType as EditorAttrValueType, AttributeTarget } from './components/dbc-editor/types';

/** Convert backend AttributeValueType to editor format */
function mapAttributeValueType(vt: BackendAttrValueType): EditorAttrValueType {
  if ('Int' in vt) return { type: 'int', min: vt.Int.min, max: vt.Int.max };
  if ('Hex' in vt) return { type: 'hex', min: vt.Hex.min, max: vt.Hex.max };
  if ('Float' in vt) return { type: 'float', min: vt.Float.min, max: vt.Float.max };
  if ('String' in vt) return { type: 'string' };
  if ('Enum' in vt) return { type: 'enum', values: vt.Enum.values };
  return { type: 'string' }; // fallback
}

/** Convert backend AttributeTargetInfo to editor format */
function mapAttributeTarget(target: AttributeTargetInfo): AttributeTarget {
  if ('Network' in target) return { type: 'network' };
  if ('Node' in target) return { type: 'node', node_name: target.Node.node_name };
  if ('Message' in target) return { type: 'message', message_id: target.Message.message_id };
  if ('Signal' in target) return { type: 'signal', message_id: target.Signal.message_id, signal_name: target.Signal.signal_name };
  return { type: 'network' }; // fallback
}

/** Convert backend AttributeValueInfo to string | number */
function mapAttributeValue(value: AttributeValueInfo): string | number {
  if ('Int' in value) return value.Int;
  if ('Float' in value) return value.Float;
  if ('String' in value) return value.String;
  return 0; // fallback
}

/** Convert backend DbcInfo to editor DbcDto */
export function mapDbcInfoToDto(info: DbcInfo): DbcDto {
  return {
    version: info.version || null,
    bit_timing: info.bit_timing ? {
      baudrate: info.bit_timing.baudrate,
      btr1: info.bit_timing.btr1,
      btr2: info.bit_timing.btr2,
    } : null,
    comment: info.comment || null,
    nodes: info.nodes.map(n => ({ name: n.name, comment: n.comment || null })),
    messages: info.messages.map(m => ({
      id: m.id,
      is_extended: false,
      name: m.name,
      dlc: m.dlc,
      sender: m.sender || 'Vector__XXX',
      signals: m.signals.map(s => ({
        name: s.name,
        start_bit: s.start_bit,
        length: s.length,
        byte_order: (s.byte_order === 'big_endian' ? 'big_endian' : 'little_endian') as 'big_endian' | 'little_endian',
        is_unsigned: !s.is_signed,
        factor: s.factor,
        offset: s.offset,
        min: s.min,
        max: s.max,
        unit: s.unit || null,
        receivers: { type: 'none' as const },
        is_multiplexer: s.is_multiplexer || false,
        multiplexer_value: s.multiplexer_value ?? null,
        comment: s.comment || null,
      })),
      comment: m.comment || null,
    })),
    value_descriptions: info.value_descriptions.map(vd => ({
      message_id: vd.message_id,
      signal_name: vd.signal_name,
      descriptions: vd.descriptions.map(d => ({ value: d.value, description: d.description })),
    })),
    attribute_definitions: info.attribute_definitions.map(def => ({
      name: def.name,
      object_type: def.object_type as 'network' | 'node' | 'message' | 'signal',
      value_type: mapAttributeValueType(def.value_type),
    })),
    attribute_defaults: info.attribute_defaults.map(def => ({
      name: def.name,
      value: mapAttributeValue(def.value),
    })),
    attribute_values: info.attribute_values.map(val => ({
      name: val.name,
      target: mapAttributeTarget(val.target),
      value: mapAttributeValue(val.value),
    })),
    extended_multiplexing: info.extended_multiplexing.map(em => ({
      message_id: em.message_id,
      signal_name: em.signal_name,
      multiplexer_signal: em.multiplexer_signal,
      ranges: em.ranges,
    })),
  };
}

/** Create an empty DbcDto for new DBC files */
export function createEmptyDbcDto(): DbcDto {
  return {
    version: null,
    bit_timing: null,
    nodes: [],
    messages: [],
    comment: null,
    value_descriptions: [],
    attribute_definitions: [],
    attribute_defaults: [],
    attribute_values: [],
    extended_multiplexing: [],
  };
}
