/**
 * Event bus for cross-component coordination (mitt).
 */

import mitt from 'mitt';
import type { CanFrame, DbcInfo, DecodedSignal } from './types';

/** Payload when an event has no fields (emit with `EMPTY_PAYLOAD`). */
export type EmptyPayload = Record<string, never>;

export const EMPTY_PAYLOAD: EmptyPayload = {};

// ─────────────────────────────────────────────────────────────────────────────
// DBC Events
// ─────────────────────────────────────────────────────────────────────────────

/** Emitted when DBC content changes (load, clear, edit, new) */
export interface DbcChangedEvent {
  action: 'loaded' | 'cleared' | 'updated' | 'new';
  dbcInfo: DbcInfo | null;
  filename: string | null;
}

/** Emitted when DBC editor state changes (dirty, editing, etc.) */
export interface DbcStateChangeEvent {
  isDirty: boolean;
  isEditing: boolean;
  currentFile: string | null;
  messageCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MDF4 Events
// ─────────────────────────────────────────────────────────────────────────────

/** Emitted when MDF4 content changes (load, clear, capture stopped) */
export interface Mdf4ChangedEvent {
  action: 'loaded' | 'cleared' | 'capture-stopped';
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame Events
// ─────────────────────────────────────────────────────────────────────────────

/** Emitted when a frame is selected in a table */
export interface FrameSelectedEvent {
  frame: CanFrame;
  index: number;
  source: 'mdf4-inspector' | 'live-viewer';
  signals: DecodedSignal[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture Events
// ─────────────────────────────────────────────────────────────────────────────

export interface CaptureStartedEvent {
  interface: string;
  captureFile: string;
}

export interface CaptureStoppedEvent {
  interface: string | null;
  captureFile: string;
  frameCount: number;
}

export interface LiveInterfacesLoadedEvent {
  interfaces: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

export interface TabSwitchEvent {
  tab: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message decoder
// ─────────────────────────────────────────────────────────────────────────────

export interface DecoderMessageSelectedEvent {
  messageId: number;
  isExtended: boolean;
  frames: CanFrame[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulator
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulatorStats {
  running: boolean;
  frames_sent: number;
  elapsed_secs: number;
  actual_rate_mbps: number;
  frames_per_sec: number;
  target_rate_mbps: number;
}

export interface SimulatorStatsEvent {
  stats: SimulatorStats;
}

export interface SimulatorLogEvent {
  message: string;
  level: 'info' | 'error' | 'success';
}

export interface SimulatorStartRequestedEvent {
  interface: string;
}

export interface SimulatorStartedEvent {
  interface: string;
}

export interface SimulatorStoppedEvent {
  reason: 'user' | 'error' | 'script-end';
  error?: string;
}

export type SimulatorScriptLoadRequestedEvent = EmptyPayload;

export type SimulatorScriptSaveRequestedEvent = EmptyPayload;

// ─────────────────────────────────────────────────────────────────────────────
// Workflow editor
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowLoadRequestedEvent = EmptyPayload;

export type WorkflowSaveRequestedEvent = EmptyPayload;

export type WorkflowRunRequestedEvent = EmptyPayload;

export interface WorkflowStatusEvent {
  running: boolean;
  framesProcessed: number;
  framesWritten: number;
}

export interface WorkflowNodeInfo {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
}

export interface WorkflowNodeSelectedEvent {
  nodeId: string | null;
  node: WorkflowNodeInfo | null;
}

export interface WorkflowNodeAddedEvent {
  node: WorkflowNodeInfo;
}

export interface WorkflowNodeDeletedEvent {
  nodeId: string;
}

export interface WorkflowNodeMovedEvent {
  nodeId: string;
  x: number;
  y: number;
}

export interface WorkflowNodeConfigChangedEvent {
  nodeId: string;
  field: string;
  value: unknown;
  config: Record<string, unknown>;
}

export interface WorkflowConnectionInfo {
  id: string;
  fromNode: string;
  fromOutput: number;
  toNode: string;
  toInput: number;
}

export interface WorkflowConnectionAddedEvent {
  connection: WorkflowConnectionInfo;
}

export interface WorkflowConnectionDeletedEvent {
  connectionId: string;
}

export interface WorkflowLogEvent {
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export type WorkflowClearedEvent = EmptyPayload;

export interface WorkflowLoadedEvent {
  name: string;
  nodeCount: number;
  connectionCount: number;
}

export interface WorkflowSavedEvent {
  name: string;
  path: string;
}

export interface WorkflowScriptModalEvent {
  open: boolean;
  nodeId: string | null;
}

export interface WorkflowZoomChangedEvent {
  zoom: number;
  panX: number;
  panY: number;
}

/** Payload from Rust `workflow:runtime-log` (Tauri event). */
export interface WorkflowRuntimeLogEvent {
  message: string;
  level: string;
  nodeId?: string;
}

/** Payload from Rust `workflow:runtime-status` (Tauri event). */
export interface WorkflowRuntimeStatusEvent {
  running: boolean;
  framesProcessed: number;
  framesWritten: number;
  currentNode?: string;
}

/** Payload from Rust `workflow:runtime-error` (Tauri event). */
export interface WorkflowRuntimeErrorEvent {
  message: string;
  nodeId?: string;
  fatal: boolean;
}

/** Payload from Rust `workflow:node-executed` (Tauri event). */
export interface WorkflowNodeExecutedEvent {
  nodeId: string;
  framesIn: number;
  framesOut: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageTabChangedEvent {
  tab: 'dbc' | 'mdf4' | 'rhai' | 'workflow';
}

export type StorageRefreshEvent = EmptyPayload;

// ─────────────────────────────────────────────────────────────────────────────
// CAN configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface CanInterfacesLoadedEvent {
  count: number;
}

export interface CanGatewaysLoadedEvent {
  count: number;
}

export type CanCreateNewEvent = EmptyPayload;

export type CanRefreshEvent = EmptyPayload;

// ─────────────────────────────────────────────────────────────────────────────
// Event map
// ─────────────────────────────────────────────────────────────────────────────

export type AppEvents = {
  'dbc:changed': DbcChangedEvent;
  'dbc:state-change': DbcStateChangeEvent;
  'mdf4:changed': Mdf4ChangedEvent;
  'frame:selected': FrameSelectedEvent;
  'capture:started': CaptureStartedEvent;
  'capture:stopped': CaptureStoppedEvent;
  'live:interfaces-loaded': LiveInterfacesLoadedEvent;
  'tab:switch': TabSwitchEvent;
  'decoder:message-selected': DecoderMessageSelectedEvent;
  'simulator:stats': SimulatorStatsEvent;
  'simulator:log': SimulatorLogEvent;
  'simulator:start-requested': SimulatorStartRequestedEvent;
  'simulator:started': SimulatorStartedEvent;
  'simulator:stopped': SimulatorStoppedEvent;
  'simulator:script-load-requested': SimulatorScriptLoadRequestedEvent;
  'simulator:script-save-requested': SimulatorScriptSaveRequestedEvent;
  'can:interfaces-loaded': CanInterfacesLoadedEvent;
  'can:gateways-loaded': CanGatewaysLoadedEvent;
  'can:create-new': CanCreateNewEvent;
  'can:refresh': CanRefreshEvent;
  'workflow:load-requested': WorkflowLoadRequestedEvent;
  'workflow:save-requested': WorkflowSaveRequestedEvent;
  'workflow:run-requested': WorkflowRunRequestedEvent;
  'workflow:status': WorkflowStatusEvent;
  'workflow:node-selected': WorkflowNodeSelectedEvent;
  'workflow:node-added': WorkflowNodeAddedEvent;
  'workflow:node-deleted': WorkflowNodeDeletedEvent;
  'workflow:node-moved': WorkflowNodeMovedEvent;
  'workflow:node-config-changed': WorkflowNodeConfigChangedEvent;
  'workflow:connection-added': WorkflowConnectionAddedEvent;
  'workflow:connection-deleted': WorkflowConnectionDeletedEvent;
  'workflow:log': WorkflowLogEvent;
  'workflow:cleared': WorkflowClearedEvent;
  'workflow:loaded': WorkflowLoadedEvent;
  'workflow:saved': WorkflowSavedEvent;
  'workflow:script-modal': WorkflowScriptModalEvent;
  'workflow:zoom-changed': WorkflowZoomChangedEvent;
  'storage:tab-changed': StorageTabChangedEvent;
  'storage:refresh': StorageRefreshEvent;
};

export const events = mitt<AppEvents>();

/** Simulator / workflow toolbars emit these; Rhai editors subscribe with payloads ignored. */
export type RhaiScriptBridgeEvent =
  | 'simulator:script-load-requested'
  | 'simulator:script-save-requested'
  | 'workflow:load-requested'
  | 'workflow:save-requested';

/**
 * Subscribe to a script-bridge event with correct mitt typing (`off` removes the wrapped handler).
 */
export function subscribeRhaiScriptBridge(
  eventName: RhaiScriptBridgeEvent,
  fn: () => void,
): () => void {
  const wrapped = (_payload: AppEvents[typeof eventName]): void => {
    fn();
  };
  events.on(eventName, wrapped);
  return () => {
    events.off(eventName, wrapped);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Emitters
// ─────────────────────────────────────────────────────────────────────────────

export function emitDbcChanged(payload: DbcChangedEvent): void {
  events.emit('dbc:changed', payload);
}

export function emitDbcStateChange(payload: DbcStateChangeEvent): void {
  events.emit('dbc:state-change', payload);
}

export function emitMdf4Changed(payload: Mdf4ChangedEvent): void {
  events.emit('mdf4:changed', payload);
}

export function emitFrameSelected(payload: FrameSelectedEvent): void {
  events.emit('frame:selected', payload);
}

export function emitCaptureStarted(payload: CaptureStartedEvent): void {
  events.emit('capture:started', payload);
}

export function emitCaptureStopped(payload: CaptureStoppedEvent): void {
  events.emit('capture:stopped', payload);
}

export function emitLiveInterfacesLoaded(payload: LiveInterfacesLoadedEvent): void {
  events.emit('live:interfaces-loaded', payload);
}

export function emitTabSwitch(payload: TabSwitchEvent): void {
  events.emit('tab:switch', payload);
}

export function emitDecoderMessageSelected(payload: DecoderMessageSelectedEvent): void {
  events.emit('decoder:message-selected', payload);
}

export function emitSimulatorStats(payload: SimulatorStatsEvent): void {
  events.emit('simulator:stats', payload);
}

export function emitSimulatorLog(payload: SimulatorLogEvent): void {
  events.emit('simulator:log', payload);
}

export function emitSimulatorStarted(payload: SimulatorStartedEvent): void {
  events.emit('simulator:started', payload);
}

export function emitSimulatorStopped(payload: SimulatorStoppedEvent): void {
  events.emit('simulator:stopped', payload);
}
