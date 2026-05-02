/**
 * Workflow Script API Definition
 *
 * Different from simulator API - focused on processing/transforming frames.
 */

// ─────────────────────────────────────────────────────────────────────────────
// API Types
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

export interface WorkflowScriptApi {
  types: Record<string, ApiType>;
  callbacks: Record<string, string>;
  functions: Record<string, string>;
  keywords: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Script API
// ─────────────────────────────────────────────────────────────────────────────

export const WORKFLOW_SCRIPT_API: WorkflowScriptApi = {
  types: {
    Frame: {
      description: 'CAN frame being processed',
      fields: {
        id: { type: 'i64', description: 'CAN ID (11-bit or 29-bit)' },
        data: { type: 'Array', description: 'Frame data bytes' },
        dlc: { type: 'i64', description: 'Data length code' },
        timestamp: { type: 'f64', description: 'Timestamp in seconds' },
        extended: { type: 'bool', description: 'Extended (29-bit) ID flag' },
        channel: { type: 'String', description: 'CAN channel name' },
      },
      methods: {
        'get_byte(idx)': 'Get byte at index (0-7)',
        'set_byte(idx, val)': 'Set byte at index (0-7)',
        'clone()': 'Create a copy of this frame',
      },
    },
  },
  callbacks: {
    'fn on_frame(frame)': 'Called for each incoming frame. Use emit() to output.',
  },
  functions: {
    // Output control
    'emit(frame)': 'Output frame to next node (modified or original)',
    'emit_new(id, data)': 'Create and emit a new frame: emit_new(0x100, [1,2,3])',
    'drop()': 'Filter out current frame (don\'t emit)',

    // CAN transmission
    'send(id, data)': 'Send CAN frame to interface: send(0x100, [1,2,3,4])',
    'send_extended(id, data)': 'Send extended (29-bit) CAN frame',
    'send_fd(id, data)': 'Send CAN FD frame (up to 64 bytes)',
    'send_fd_extended(id, data)': 'Send extended CAN FD frame',

    // Frame inspection
    'get_bits(frame, start, len)': 'Extract bits from frame data',
    'set_bits(frame, start, len, val)': 'Set bits in frame data',

    // Logging
    'log(msg)': 'Log message to workflow console',
    'debug(msg)': 'Log debug message (verbose)',

    // Math functions
    'abs(x)': 'Absolute value',
    'min(a, b)': 'Minimum of two values',
    'max(a, b)': 'Maximum of two values',
    'clamp(x, min, max)': 'Clamp value to range',

    // State (persists between frames)
    'state_get(key)': 'Get persistent state value',
    'state_set(key, val)': 'Set persistent state value',
    'state_inc(key)': 'Increment state counter, returns new value',
  },
  keywords: ['let', 'fn', 'if', 'else', 'for', 'in', 'while', 'loop', 'return', 'true', 'false'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Autocomplete
// ─────────────────────────────────────────────────────────────────────────────

export interface AutocompleteSuggestion {
  label: string;
  detail: string;
  insert: string;
}

/** Get autocomplete suggestions based on context */
export function getWorkflowAutocompleteSuggestions(context: string): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = [];
  const ctx = context.toLowerCase();

  if (ctx === '' || ctx === 'global') {
    // Types
    Object.keys(WORKFLOW_SCRIPT_API.types).forEach(t => {
      const type = WORKFLOW_SCRIPT_API.types[t];
      suggestions.push({ label: t, detail: type.description, insert: t });
    });

    // Functions
    Object.entries(WORKFLOW_SCRIPT_API.functions).forEach(([fn, desc]) => {
      const name = fn.split('(')[0];
      suggestions.push({ label: name, detail: desc, insert: name + '(' });
    });

    // Callbacks
    Object.entries(WORKFLOW_SCRIPT_API.callbacks).forEach(([fn, desc]) => {
      suggestions.push({
        label: fn.split('(')[0].replace('fn ', ''),
        detail: desc,
        insert: fn.replace('fn ', '') + ' {\n    \n}',
      });
    });

    // Keywords
    WORKFLOW_SCRIPT_API.keywords.forEach(kw => {
      suggestions.push({ label: kw, detail: 'keyword', insert: kw + ' ' });
    });
  } else if (ctx === 'frame') {
    const type = WORKFLOW_SCRIPT_API.types.Frame;
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
    return getWorkflowAutocompleteSuggestions('global');
  }

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Template
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WORKFLOW_SCRIPT = `// Workflow Script
// Called for each frame - use emit() to pass through

fn on_frame(frame) {
    // Example: Pass all frames through unchanged
    emit(frame);
}
`;

export const WORKFLOW_SCRIPT_TEMPLATES = [
  {
    key: 'passthrough',
    name: 'Pass Through',
    desc: 'Pass all frames unchanged',
    code: `// Pass all frames through unchanged
fn on_frame(frame) {
    emit(frame);
}
`,
  },
  {
    key: 'filter_id',
    name: 'Filter by ID',
    desc: 'Only pass specific IDs',
    code: `// Filter: only pass frames with specific IDs
let ALLOWED_IDS = [0x100, 0x200, 0x300];

fn on_frame(frame) {
    if ALLOWED_IDS.contains(frame.id) {
        emit(frame);
    }
    // Implicit drop if not emitted
}
`,
  },
  {
    key: 'modify_data',
    name: 'Modify Data',
    desc: 'Transform frame data',
    code: `// Modify specific bytes in frames
fn on_frame(frame) {
    if frame.id == 0x100 {
        // Modify byte 0
        let modified = frame.clone();
        modified.set_byte(0, frame.get_byte(0) + 1);
        emit(modified);
    } else {
        emit(frame);
    }
}
`,
  },
  {
    key: 'counter',
    name: 'Frame Counter',
    desc: 'Count frames and log',
    code: `// Count frames per ID
fn on_frame(frame) {
    let key = "count_" + frame.id;
    let count = state_inc(key);

    if count % 100 == 0 {
        log("ID 0x" + frame.id + " count: " + count);
    }

    emit(frame);
}
`,
  },
  {
    key: 'remap_id',
    name: 'Remap IDs',
    desc: 'Change frame IDs',
    code: `// Remap frame IDs
fn on_frame(frame) {
    let new_frame = frame.clone();

    // Shift all IDs by 0x100
    new_frame.id = frame.id + 0x100;

    emit(new_frame);
}
`,
  },
  {
    key: 'duplicate',
    name: 'Duplicate Frames',
    desc: 'Output multiple copies',
    code: `// Duplicate each frame
fn on_frame(frame) {
    // Emit original
    emit(frame);

    // Emit a modified copy
    let copy = frame.clone();
    copy.id = frame.id + 0x1000;
    emit(copy);
}
`,
  },
];
