/**
 * Simple Reactive Store
 *
 * Lightweight state management for high-frequency updates.
 * Use events for infrequent cross-component communication,
 * use stores for rapidly changing state that needs to be queried.
 */

import type { CanFrame, DecodedSignal } from './types';

type Listener<T> = (state: T) => void;

export function createStore<T extends object>(initialState: T) {
  let state = { ...initialState };
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,

    set(partial: Partial<T>) {
      state = { ...state, ...partial };
      listeners.forEach(fn => fn(state));
    },

    subscribe(fn: Listener<T>) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// App Store - global application state
// ─────────────────────────────────────────────────────────────────────────────

export interface AppState {
  /** Current DBC file path (null if not loaded) */
  dbcFile: string | null;
  /** Current MDF4 file path (null if not loaded/created) */
  mdf4File: string | null;
  /** Loaded MDF4 frames */
  mdf4Frames: CanFrame[];
  /** Pre-decoded signals from MDF4 (if DBC was loaded) */
  mdf4Signals: DecodedSignal[];
}

export const appStore = createStore<AppState>({
  dbcFile: null,
  mdf4File: null,
  mdf4Frames: [],
  mdf4Signals: [],
});

// ─────────────────────────────────────────────────────────────────────────────
// Live Store - high frequency updates during capture
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveState {
  isCapturing: boolean;
  currentInterface: string | null;
  frameCount: number;
  messageCount: number;
}

export const liveStore = createStore<LiveState>({
  isCapturing: false,
  currentInterface: null,
  frameCount: 0,
  messageCount: 0,
});

