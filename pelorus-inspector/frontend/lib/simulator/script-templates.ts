/**
 * Script Templates
 *
 * Pre-built script examples for common simulation patterns.
 * Dynamically adapts to use signals from the loaded DBC file.
 */

import { getDbcSignals, getDbcMessages, type SignalInfo, type MessageInfo } from './script-api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Template Generators
// ─────────────────────────────────────────────────────────────────────────────

function getFirstMessages(count: number): MessageInfo[] {
  return getDbcMessages().slice(0, count);
}

function getSignalsForMessage(msgName: string): SignalInfo[] {
  return getDbcSignals().filter(s => s.message_name === msgName);
}

function formatIdHex(id: number): string {
  return '0x' + id.toString(16).toUpperCase().padStart(3, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Templates
// ─────────────────────────────────────────────────────────────────────────────

function generateDefaultScript(): string {
  const messages = getFirstMessages(2);

  if (messages.length === 0) {
    // No DBC loaded - show placeholder
    return `// CAN Traffic Simulator Script
// Load a DBC file to use signal-based encoding

fn on_tick(t) {
    // Send raw bytes every 10ms
    if t % 10 == 0 {
        send(0x100, [t % 256, 0, 0, 0, 0, 0, 0, 0]);
    }
}`;
  }

  const msg1 = messages[0];
  const signals1 = getSignalsForMessage(msg1.name).slice(0, 2);
  const msg2 = messages[1];

  let script = `// CAN Traffic Simulator Script
// Using signals from loaded DBC

fn on_tick(t) {`;

  // Add signal setters
  if (signals1.length > 0) {
    const sig = signals1[0];
    const range = sig.max - sig.min;
    script += `
    // ${sig.name}: ${sig.min}..${sig.max} ${sig.unit}
    set_signal("${msg1.name}", "${sig.name}", ${sig.min.toFixed(1)} + ${(range * 0.8).toFixed(1)} * sin(t / 1000.0));`;
  }
  if (signals1.length > 1) {
    const sig = signals1[1];
    script += `
    set_signal("${msg1.name}", "${sig.name}", ${((sig.min + sig.max) / 2).toFixed(1)});`;
  }

  // Add message sends
  script += `

    // Send ${msg1.name} (${formatIdHex(msg1.id)}) every 10ms
    if t % 10 == 0 {
        send_message("${msg1.name}");
    }`;

  if (msg2) {
    script += `

    // Send ${msg2.name} (${formatIdHex(msg2.id)}) every 20ms
    if t % 20 == 0 {
        send_message("${msg2.name}");
    }`;
  }

  script += `
}`;

  return script;
}

function generateDbcSignalsScript(): string {
  const messages = getFirstMessages(3);

  if (messages.length === 0) {
    return `// DBC Signal Example
// Load a DBC file to use this template

fn on_tick(t) {
    // Example with placeholder names:
    // set_signal("MessageName", "SignalName", value);
    // send_message("MessageName");

    send(0x100, [t % 256, 0, 0, 0, 0, 0, 0, 0]);
}`;
  }

  let script = `// DBC Signal Example
// Sets signal values and sends messages from your DBC

fn on_tick(t) {`;

  for (const msg of messages) {
    const signals = getSignalsForMessage(msg.name).slice(0, 3);
    if (signals.length > 0) {
      script += `
    // ${msg.name} (${formatIdHex(msg.id)})`;
      for (const sig of signals) {
        const mid = (sig.min + sig.max) / 2;
        const range = (sig.max - sig.min) / 2;
        script += `
    set_signal("${msg.name}", "${sig.name}", ${mid.toFixed(1)} + ${range.toFixed(1)} * sin(t / 2000.0));`;
      }
    }
  }

  script += `

    // Send at typical cycle times`;
  messages.forEach((msg, i) => {
    const cycleMs = (i + 1) * 10;
    script += `
    if t % ${cycleMs} == 0 { send_message("${msg.name}"); }`;
  });

  script += `
}`;

  return script;
}

function generateSweepScript(): string {
  const messages = getFirstMessages(1);

  if (messages.length === 0) {
    return `// Signal sweep test
// Load a DBC file to sweep actual signals

fn on_tick(t) {
    let pct = (t % 10000) / 100.0;
    send(0x100, [(pct * 255.0 / 100.0) % 256, 0, 0, 0, 0, 0, 0, 0]);
}`;
  }

  const msg = messages[0];
  const signals = getSignalsForMessage(msg.name);
  const sig = signals[0];

  if (!sig) {
    return `// Signal sweep test for ${msg.name}

fn on_tick(t) {
    let pct = (t % 10000) / 100.0;
    if t % 10 == 0 {
        send_message("${msg.name}");
    }
}`;
  }

  return `// Signal sweep test
// Sweeps ${sig.name} from ${sig.min} to ${sig.max} over 10 seconds

fn on_tick(t) {
    // Calculate sweep value (0-100% over 10 seconds)
    let pct = (t % 10000) / 100.0;

    // Sweep ${sig.name}: ${sig.min}..${sig.max} ${sig.unit}
    let value = ${sig.min.toFixed(1)} + (${(sig.max - sig.min).toFixed(1)} * pct / 100.0);
    set_signal("${msg.name}", "${sig.name}", value);

    // Send every 10ms
    if t % 10 == 0 {
        send_message("${msg.name}");
    }
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static Templates (don't depend on DBC)
// ─────────────────────────────────────────────────────────────────────────────

const BASIC_TEMPLATE = `// Basic periodic message
// Sends raw CAN data every 100ms

fn on_tick(t) {
    if t % 100 == 0 {
        send(0x100, [t % 256, (t / 256) % 256, 0, 0, 0, 0, 0, 0]);
    }
}`;

const OBD2_TEMPLATE = `// OBD-II Response Simulator
// Responds with typical OBD-II diagnostic data

fn on_tick(t) {
    // Engine RPM response (PID 0x0C) every 100ms
    if t % 100 == 0 {
        let rpm = 2500 + 1000 * sin(t / 3000.0);
        let rpm_raw = rpm * 4;
        send(0x7E8, [0x04, 0x41, 0x0C, rpm_raw / 256, rpm_raw % 256, 0, 0, 0]);
    }

    // Vehicle speed response (PID 0x0D) every 100ms
    if t % 100 == 50 {
        let speed_kmh = min(t / 100, 120);
        send(0x7E8, [0x03, 0x41, 0x0D, speed_kmh, 0, 0, 0, 0]);
    }

    // Coolant temp response (PID 0x05) every 500ms
    if t % 500 == 0 {
        let temp_c = 80 + 10 * sin(t / 10000.0);
        send(0x7E8, [0x03, 0x41, 0x05, temp_c + 40, 0, 0, 0, 0]);
    }
}`;

const NOISE_TEMPLATE = `// Random noise generator
// Sends random data for testing

fn on_tick(t) {
    if t % 5 == 0 {
        send(0x100, [
            rand_int(0, 255), rand_int(0, 255),
            rand_int(0, 255), rand_int(0, 255),
            rand_int(0, 255), rand_int(0, 255),
            rand_int(0, 255), rand_int(0, 255)
        ]);
    }
}`;

const CAN_FD_TEMPLATE = `// CAN FD Example
// Sends FD frames with up to 64 bytes

fn on_tick(t) {
    if t % 20 == 0 {
        send_fd(0x200, [
            t % 256, (t / 256) % 256, 0, 0,
            rand_int(0, 255), rand_int(0, 255), rand_int(0, 255), rand_int(0, 255),
            0x11, 0x22, 0x33, 0x44,
            0x55, 0x66, 0x77, 0x88
        ]);
    }
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/** Get the default script (dynamic based on DBC) */
export function getDefaultScript(): string {
  return generateDefaultScript();
}

/** Get all available templates */
export function getTemplates(): Record<string, () => string> {
  return {
    default: generateDefaultScript,
    basic: () => BASIC_TEMPLATE,
    dbc_signals: generateDbcSignalsScript,
    obd2: () => OBD2_TEMPLATE,
    sweep: generateSweepScript,
    noise: () => NOISE_TEMPLATE,
    can_fd: () => CAN_FD_TEMPLATE,
  };
}

/** Get a specific template by key */
export function getTemplate(key: string): string {
  const templates = getTemplates();
  const generator = templates[key];
  return generator ? generator() : generateDefaultScript();
}
