/**
 * Rhai Script API Definition
 *
 * Source of truth for intellisense and API reference panel.
 * Dynamically enhanced with signals from loaded DBC.
 */

import { invoke } from '../ipc';
import { events, type DbcChangedEvent } from '../events';

// ─────────────────────────────────────────────────────────────────────────────
// DBC Signal/Message Types (from backend)
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalInfo {
  name: string;
  message_name: string;
  message_id: number;
  start_bit: number;
  length: number;
  factor: number;
  offset: number;
  min: number;
  max: number;
  unit: string;
}

export interface MessageInfo {
  name: string;
  id: number;
  dlc: number;
  signal_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DBC Data Cache
// ─────────────────────────────────────────────────────────────────────────────

let dbcSignals: SignalInfo[] = [];
let dbcMessages: MessageInfo[] = [];

export function getDbcSignals(): SignalInfo[] { return dbcSignals; }
export function getDbcMessages(): MessageInfo[] { return dbcMessages; }

export async function loadDbcData(): Promise<void> {
  try {
    const [signals, messages] = await Promise.all([
      invoke<SignalInfo[]>('sim_get_signals'),
      invoke<MessageInfo[]>('sim_get_messages'),
    ]);
    dbcSignals = signals;
    dbcMessages = messages;
  } catch (e) {
    console.warn('Failed to load DBC data for autocomplete:', e);
    dbcSignals = [];
    dbcMessages = [];
  }
}

// Auto-refresh on DBC changes
events.on('dbc:changed', (_e: DbcChangedEvent) => {
  loadDbcData();
});

// ─────────────────────────────────────────────────────────────────────────────
// Static API Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiField {
  type: string;
  description: string;
}

export interface ApiType {
  description: string;
  fields: Record<string, ApiField>;
  methods?: Record<string, string>;
}

export interface ScriptApi {
  types: Record<string, ApiType>;
  callbacks: Record<string, string>;
  functions: Record<string, string>;
  keywords: string[];
}

export const SCRIPT_API: ScriptApi = {
  types: {
    Message: {
      description: 'CAN message - Message(id, dlc, cycle_ms)',
      fields: {
        id: { type: 'i64', description: 'CAN ID (11-bit or 29-bit)' },
        dlc: { type: 'i64', description: 'Data length code (0-8)' },
        cycle_ms: { type: 'i64', description: 'Transmit interval in milliseconds' },
        data: { type: 'Array', description: 'Message data bytes [u8; 8]' },
        extended: { type: 'bool', description: 'Use extended 29-bit ID' },
      },
      methods: {
        'set_byte(idx, val)': 'Set byte at index (0-7)',
        'get_byte(idx)': 'Get byte at index (0-7)',
      },
    },
    Signal: {
      description: 'Signal - Signal(message_id, start_bit, length)',
      fields: {
        factor: { type: 'f64', description: 'Scale factor (default 1.0)' },
        offset: { type: 'f64', description: 'Value offset (default 0.0)' },
      },
      methods: {
        'set(value)': 'Set physical value (applies factor/offset)',
        'get()': 'Get current physical value',
        'raw()': 'Get raw integer value',
      },
    },
    Frame: {
      description: 'Received CAN frame',
      fields: {
        id: { type: 'i64', description: 'CAN ID' },
        data: { type: 'Array', description: 'Frame data bytes' },
        dlc: { type: 'i64', description: 'Data length' },
        timestamp: { type: 'f64', description: 'Receive timestamp' },
        extended: { type: 'bool', description: 'Extended frame flag' },
      },
      methods: {
        'get_byte(idx)': 'Get byte at index',
      },
    },
  },
  callbacks: {
    'fn on_tick(time_ms)': 'Called every ms with elapsed time',
    'fn on_frame(frame)': 'Called when a CAN frame is received',
  },
  functions: {
    'send(id, data)': 'Send frame: send(0x100, [1, 2, 3, 4])',
    'log(msg)': 'Log message to console',
    'sin(x)': 'Sine function',
    'cos(x)': 'Cosine function',
    'tan(x)': 'Tangent function',
    'abs(x)': 'Absolute value',
    'sqrt(x)': 'Square root',
    'min(a, b)': 'Minimum of two values',
    'max(a, b)': 'Maximum of two values',
    'clamp(x, min, max)': 'Clamp value to range',
    'floor(x)': 'Floor (round down)',
    'ceil(x)': 'Ceiling (round up)',
    'round(x)': 'Round to nearest',
    'rand()': 'Random value 0.0-1.0',
    'rand_range(min, max)': 'Random float in range',
    'rand_int(min, max)': 'Random integer in range',
  },
  keywords: ['let', 'fn', 'if', 'else', 'for', 'in', 'while', 'loop', 'return', 'true', 'false'],
};

export interface AutocompleteSuggestion {
  label: string;
  detail: string;
  insert: string;
}

/** Get autocomplete suggestions based on context */
export function getAutocompleteSuggestions(context: string): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = [];
  const ctx = context.toLowerCase();

  if (ctx === '' || ctx === 'global') {
    // Top-level suggestions
    Object.keys(SCRIPT_API.types).forEach(t => {
      const type = SCRIPT_API.types[t];
      suggestions.push({ label: t, detail: type.description, insert: t + '(' });
    });
    Object.entries(SCRIPT_API.functions).forEach(([fn, desc]) => {
      const name = fn.split('(')[0];
      suggestions.push({ label: name, detail: desc, insert: name + '(' });
    });
    Object.entries(SCRIPT_API.callbacks).forEach(([fn, desc]) => {
      suggestions.push({
        label: fn.split('(')[0].replace('fn ', ''),
        detail: desc,
        insert: fn.replace('fn ', '') + ' {\n    \n}',
      });
    });
    SCRIPT_API.keywords.forEach(kw => {
      suggestions.push({ label: kw, detail: 'keyword', insert: kw + ' ' });
    });

    // Add DBC messages as set_signal shortcuts
    if (dbcMessages.length > 0) {
      dbcMessages.forEach(msg => {
        const idHex = msg.id.toString(16).toUpperCase().padStart(3, '0');
        suggestions.push({
          label: `send_message("${msg.name}")`,
          detail: `0x${idHex} - ${msg.signal_count} signals`,
          insert: `send_message("${msg.name}")`,
        });
      });
    }
  } else if (ctx === 'signal') {
    const type = SCRIPT_API.types.Signal;
    if (type.methods) {
      Object.entries(type.methods).forEach(([method, desc]) => {
        const name = method.split('(')[0];
        suggestions.push({ label: name, detail: desc, insert: name + '(' });
      });
    }
    Object.entries(type.fields).forEach(([field, info]) => {
      suggestions.push({ label: field, detail: `${info.type} - ${info.description}`, insert: field });
    });
  } else if (ctx === 'message') {
    const type = SCRIPT_API.types.Message;
    Object.entries(type.fields).forEach(([field, info]) => {
      suggestions.push({ label: field, detail: `${info.type} - ${info.description}`, insert: field });
    });
    if (type.methods) {
      Object.entries(type.methods).forEach(([method, desc]) => {
        const name = method.split('(')[0];
        suggestions.push({ label: name, detail: desc, insert: name + '(' });
      });
    }
  } else if (ctx === 'frame') {
    const type = SCRIPT_API.types.Frame;
    Object.entries(type.fields).forEach(([field, info]) => {
      suggestions.push({ label: field, detail: `${info.type} - ${info.description}`, insert: field });
    });
    if (type.methods) {
      Object.entries(type.methods).forEach(([method, desc]) => {
        const name = method.split('(')[0];
        suggestions.push({ label: name, detail: desc, insert: name + '(' });
      });
    }
  } else {
    return getAutocompleteSuggestions('global');
  }

  return suggestions;
}

/** Get signal suggestions for a specific message */
export function getSignalSuggestions(messageName: string): AutocompleteSuggestion[] {
  return dbcSignals
    .filter(s => s.message_name === messageName)
    .map(s => ({
      label: s.name,
      detail: `${s.min}..${s.max} ${s.unit} (${s.length}bit)`,
      insert: `"${s.name}", `,
    }));
}

/** Get all DBC signal suggestions for set_signal autocomplete */
export function getAllSignalSuggestions(): AutocompleteSuggestion[] {
  return dbcSignals.map(s => {
    const idHex = s.message_id.toString(16).toUpperCase().padStart(3, '0');
    return {
      label: `${s.message_name}.${s.name}`,
      detail: `0x${idHex} - ${s.min}..${s.max} ${s.unit}`,
      insert: `set_signal("${s.message_name}", "${s.name}", `,
    };
  });
}
