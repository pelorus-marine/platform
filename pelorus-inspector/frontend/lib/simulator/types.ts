/**
 * Simulator Types
 *
 * UI-specific types for the simulator component.
 * Core types are in:
 * - events.ts: SimulatorStats (event payloads)
 * - Rust commands: InterfaceInfo, SimulatorConfig (IPC payloads)
 * - store.ts & liveStore: runtime capture counters (separate from simulator UI)
 */

export interface InterfaceInfo {
  name: string;
  available: boolean;
}

export interface LogEntry {
  text: string;
  type: 'info' | 'error' | 'success';
}

export interface ScriptTemplate {
  name: string;
  description: string;
  code: string;
}
