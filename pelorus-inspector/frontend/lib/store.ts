/**
 * Pelorus Inspector stores — MDF4/UI state, SocketCAN counters, workspace context, SQLite index.
 */

import type { CanBpfFilter, CanFrame, DecodedSignal } from './types';
import type { ArtifactMeta } from './storage/types';

type Listener<T> = (state: T) => void;

/**
 * Tiny reactive store. `get()` returns the live object — do not mutate it directly; use `set`.
 */
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

/** Global file + decode context */
export interface AppState {
  dbcFile: string | null;
  mdf4File: string | null;
  mdf4Frames: CanFrame[];
  mdf4Signals: DecodedSignal[];
}

export const appStore = createStore<AppState>({
  dbcFile: null,
  mdf4File: null,
  mdf4Frames: [],
  mdf4Signals: [],
});

/** Live capture counters */
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

export type PanelLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Path/display name pairs for workflow pickers */
export interface WorkspacePath {
  path: string;
  name: string;
}

export interface CanGatewayRule {
  id: number;
  src: string;
  dst: string;
}

/** CAN lab + workflow picker context (BPF maps, MDF4 paths used on canvas, gateways). */
export interface PelorusWorkspace {
  dbcFiles: WorkspacePath[];
  mdf4Files: WorkspacePath[];
  canInterfaces: WorkspacePath[];
  gateways: CanGatewayRule[];
  interfaceFilters: Record<string, CanBpfFilter[]>;
}

export const pelorusWorkspace = createStore<PelorusWorkspace>({
  dbcFiles: [],
  mdf4Files: [],
  canInterfaces: [],
  gateways: [],
  interfaceFilters: {},
});

/** SQLite artifact listing cache (synced from storage panel) */
export interface ArtifactIndex {
  dbcArtifacts: ArtifactMeta[];
  mdf4Artifacts: ArtifactMeta[];
  rhaiArtifacts: ArtifactMeta[];
  workflowArtifacts: ArtifactMeta[];
}

export const artifactIndex = createStore<ArtifactIndex>({
  dbcArtifacts: [],
  mdf4Artifacts: [],
  rhaiArtifacts: [],
  workflowArtifacts: [],
});

