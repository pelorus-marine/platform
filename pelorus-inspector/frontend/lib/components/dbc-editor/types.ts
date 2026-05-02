/**
 * TypeScript interfaces for DBC Editor components.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Bit Timing (BS_)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bit timing configuration for the CAN bus.
 * Corresponds to the BS_ section in DBC files.
 */
export interface BitTimingDto {
  /** Baud rate in bits per second (e.g., 500000 for 500 kbps) */
  baudrate: number;
  /** Bit timing register 1 (hardware-specific, optional) */
  btr1: number;
  /** Bit timing register 2 (hardware-specific, optional) */
  btr2: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nodes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A node (ECU) definition with optional comment.
 */
export interface NodeDto {
  name: string;
  comment: string | null;
}

/**
 * Receiver specification for a signal.
 */
export type ReceiversDto =
  | { type: 'none' }
  | { type: 'nodes'; nodes: string[] };

/**
 * A signal definition for editing.
 */
export interface SignalDto {
  name: string;
  start_bit: number;
  length: number;
  byte_order: 'little_endian' | 'big_endian';
  is_unsigned: boolean;
  factor: number;
  offset: number;
  min: number;
  max: number;
  unit: string | null;
  receivers: ReceiversDto;
  is_multiplexer: boolean;
  multiplexer_value: number | null;
  /** Comment from CM_ SG_ entry */
  comment: string | null;
}

/**
 * A message definition for editing.
 */
export interface MessageDto {
  id: number;
  is_extended: boolean;
  name: string;
  dlc: number;
  sender: string;
  signals: SignalDto[];
  /** Comment from CM_ BO_ entry */
  comment: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Value Descriptions (VAL_)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single value description entry (value -> text mapping).
 */
export interface ValueDescriptionEntry {
  value: number;
  description: string;
}

/**
 * Value descriptions for a signal (VAL_ message_id signal_name values).
 */
export interface SignalValueDescriptions {
  message_id: number;
  signal_name: string;
  descriptions: ValueDescriptionEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Attributes (BA_DEF_, BA_DEF_DEF_, BA_)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attribute object type - what the attribute applies to.
 */
export type AttributeObjectType = 'network' | 'node' | 'message' | 'signal';

/**
 * Attribute value type with constraints.
 */
export type AttributeValueType =
  | { type: 'int'; min: number; max: number }
  | { type: 'hex'; min: number; max: number }
  | { type: 'float'; min: number; max: number }
  | { type: 'string' }
  | { type: 'enum'; values: string[] };

/**
 * Attribute definition (BA_DEF_).
 */
export interface AttributeDefinitionDto {
  name: string;
  object_type: AttributeObjectType;
  value_type: AttributeValueType;
}

/**
 * Attribute default value (BA_DEF_DEF_).
 */
export interface AttributeDefaultDto {
  name: string;
  value: string | number;
}

/**
 * Attribute target - what object the attribute is assigned to.
 */
export type AttributeTarget =
  | { type: 'network' }
  | { type: 'node'; node_name: string }
  | { type: 'message'; message_id: number }
  | { type: 'signal'; message_id: number; signal_name: string };

/**
 * Attribute value assignment (BA_).
 */
export interface AttributeValueDto {
  name: string;
  target: AttributeTarget;
  value: string | number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extended Multiplexing (SG_MUL_VAL_)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended multiplexing entry.
 */
export interface ExtendedMultiplexingDto {
  message_id: number;
  signal_name: string;
  multiplexer_signal: string;
  /** Ranges where this signal is active: [[start, end], ...] */
  ranges: [number, number][];
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete DBC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complete DBC file for editing.
 */
export interface DbcDto {
  version: string | null;
  /** Bit timing configuration (BS_), null if not specified */
  bit_timing: BitTimingDto | null;
  nodes: NodeDto[];
  messages: MessageDto[];
  /** Database comment from CM_ entry */
  comment: string | null;
  /** Value descriptions (VAL_) */
  value_descriptions: SignalValueDescriptions[];
  /** Attribute definitions (BA_DEF_) */
  attribute_definitions: AttributeDefinitionDto[];
  /** Attribute defaults (BA_DEF_DEF_) */
  attribute_defaults: AttributeDefaultDto[];
  /** Attribute values (BA_) */
  attribute_values: AttributeValueDto[];
  /** Extended multiplexing (SG_MUL_VAL_) */
  extended_multiplexing: ExtendedMultiplexingDto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a default signal.
 */
export function createDefaultSignal(): SignalDto {
  return {
    name: '',
    start_bit: 0,
    length: 8,
    byte_order: 'little_endian',
    is_unsigned: true,
    factor: 1,
    offset: 0,
    min: 0,
    max: 255,
    unit: null,
    receivers: { type: 'none' },
    is_multiplexer: false,
    multiplexer_value: null,
    comment: null,
  };
}

/**
 * Create a default message.
 * @param dlc - Optional DLC override (default: 8). Use detectDlcFromFrames() to auto-detect.
 */
export function createDefaultMessage(dlc = 8): MessageDto {
  return {
    id: 0,
    is_extended: false,
    name: '',
    dlc,
    sender: 'Vector__XXX',
    signals: [],
    comment: null,
  };
}

/**
 * Create a default DBC.
 */
export function createDefaultDbc(): DbcDto {
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
