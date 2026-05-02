/**
 * Event Bus
 *
 * Centralized event system for cross-component communication using mitt.
 * Components can emit and listen to events without direct coupling.
 */

import mitt from 'mitt';
import type { CanFrame, DbcInfo, DecodedSignal } from './types';

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
  signals: DecodedSignal[];  // Pre-decoded signals for this frame
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture Events
// ─────────────────────────────────────────────────────────────────────────────

/** Emitted when live capture starts */
export interface CaptureStartedEvent {
  interface: string;
  captureFile: string;
}

/** Emitted when live capture stops */
export interface CaptureStoppedEvent {
  interface: string | null;
  captureFile: string;
  frameCount: number;
}

/** Emitted when live viewer interfaces are loaded */
export interface LiveInterfacesLoadedEvent {
  interfaces: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Events
// ─────────────────────────────────────────────────────────────────────────────

/** Emitted to request tab switch */
export interface TabSwitchEvent {
  tab: 'dbc' | 'mdf4' | 'live' | 'about';
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Bus
// ─────────────────────────────────────────────────────────────────────────────

/** All application events */
export type AppEvents = {
  'dbc:changed': DbcChangedEvent;
  'dbc:state-change': DbcStateChangeEvent;
  'mdf4:changed': Mdf4ChangedEvent;
  'frame:selected': FrameSelectedEvent;
  'capture:started': CaptureStartedEvent;
  'capture:stopped': CaptureStoppedEvent;
  'live:interfaces-loaded': LiveInterfacesLoadedEvent;
  'tab:switch': TabSwitchEvent;
};

/** Global event bus instance */
export const events = mitt<AppEvents>();

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Emitters
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
