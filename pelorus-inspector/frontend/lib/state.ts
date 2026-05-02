import type { CanFrame, DecodedSignal, DbcInfo, InspectorConfig, MessageInfo } from './types';
import { defaultConfig, createEmptyFilters, parseCanIds, parseMessageNames, filterFrames, type Filters } from './config';

/** Pelorus Inspector component state */
export interface ViewerState {
  frames: CanFrame[];
  filteredFrames: CanFrame[];
  signals: DecodedSignal[];
  dbcInfo: DbcInfo | null;
  dbcLoaded: boolean;
  isCapturing: boolean;
  activeTab: string;
  selectedMessageId: number | null;
  selectedFrameIndex: number | null;
  filters: Filters;
  config: Required<InspectorConfig>;
}

/** Create initial viewer state */
export function createInitialState(config?: Partial<InspectorConfig>): ViewerState {
  const mergedConfig = { ...defaultConfig, ...config };
  return {
    frames: [],
    filteredFrames: [],
    signals: [],
    dbcInfo: null,
    dbcLoaded: false,
    isCapturing: false,
    activeTab: mergedConfig.initialTab,
    selectedMessageId: null,
    selectedFrameIndex: null,
    filters: createEmptyFilters(),
    config: mergedConfig,
  };
}

/** Add a frame to state, respecting max limit */
export function addFrame(state: ViewerState, frame: CanFrame): void {
  state.frames.push(frame);
  if (state.frames.length > state.config.maxFrames) {
    state.frames = state.frames.slice(-Math.floor(state.config.maxFrames / 2));
  }
}

/** Add a signal to state, respecting max limit */
export function addSignal(state: ViewerState, signal: DecodedSignal): void {
  state.signals.push(signal);
  if (state.signals.length > state.config.maxSignals) {
    state.signals = state.signals.slice(-Math.floor(state.config.maxSignals / 2));
  }
}

/** Clear all frame and signal data */
export function clearData(state: ViewerState): void {
  state.frames = [];
  state.signals = [];
  state.filteredFrames = [];
  state.selectedFrameIndex = null;
}

/** Apply filters from input values */
export function applyFiltersFromInputs(
  state: ViewerState,
  timeMin: string,
  timeMax: string,
  canIdStr: string,
  messageStr: string
): void {
  state.filters.timeMin = timeMin ? parseFloat(timeMin) : null;
  state.filters.timeMax = timeMax ? parseFloat(timeMax) : null;
  state.filters.canIds = parseCanIds(canIdStr);
  state.filters.messages = parseMessageNames(messageStr);
  state.selectedFrameIndex = null;
}

/** Clear all filters */
export function clearFilters(state: ViewerState): void {
  state.filters = createEmptyFilters();
  state.selectedFrameIndex = null;
}

/** Get message name from DBC info */
export function getMessageName(state: ViewerState, canId: number): string {
  if (!state.dbcInfo?.messages) return '-';
  const msg = state.dbcInfo.messages.find(m => m.id === canId);
  return msg ? msg.name : '-';
}

/** Get message info from DBC */
export function getMessageInfo(state: ViewerState, canId: number): MessageInfo | null {
  if (!state.dbcInfo?.messages) return null;
  return state.dbcInfo.messages.find(m => m.id === canId) || null;
}

/** Filter frames based on current filter state */
export function getFilteredFrames(state: ViewerState): CanFrame[] {
  return filterFrames(state.frames, state.filters, state.dbcInfo);
}

/** Update filtered frames cache */
export function updateFilteredFrames(state: ViewerState): void {
  state.filteredFrames = getFilteredFrames(state);
}

/** Select a frame by index */
export function selectFrame(state: ViewerState, index: number): void {
  state.selectedFrameIndex = index;
}

/** Get currently selected frame */
export function getSelectedFrame(state: ViewerState): CanFrame | null {
  if (state.selectedFrameIndex === null) return null;
  return state.filteredFrames[state.selectedFrameIndex] || null;
}

/** Set capture status */
export function setCaptureStatus(state: ViewerState, capturing: boolean): void {
  state.isCapturing = capturing;
}

/** Set active tab */
export function setActiveTab(state: ViewerState, tab: string): void {
  state.activeTab = tab;
}

/** Frame statistics result */
export interface FrameStats {
  /** Number of unique message IDs */
  uniqueMessages: number;
  /** Frames per second (based on last N frames) */
  frameRate: number;
  /** Average delta time in milliseconds */
  avgDeltaMs: number;
  /** Estimated bus load percentage (assumes 500kbps CAN) */
  busLoad: number;
}

/** Calculate frame statistics */
export function calculateFrameStats(state: ViewerState): FrameStats {
  const frames = state.frames;

  if (frames.length === 0) {
    return { uniqueMessages: 0, frameRate: 0, avgDeltaMs: 0, busLoad: 0 };
  }

  // Count unique message IDs
  const uniqueIds = new Set(frames.map(f => f.can_id));
  const uniqueMessages = uniqueIds.size;

  // Calculate frame rate and delta time using recent frames
  const recentCount = Math.min(frames.length, 100);
  const recentFrames = frames.slice(-recentCount);

  let frameRate = 0;
  let avgDeltaMs = 0;

  if (recentFrames.length >= 2) {
    const firstTs = recentFrames[0].timestamp;
    const lastTs = recentFrames[recentFrames.length - 1].timestamp;
    const duration = lastTs - firstTs;

    if (duration > 0) {
      frameRate = (recentFrames.length - 1) / duration;
      avgDeltaMs = (duration / (recentFrames.length - 1)) * 1000;
    }
  }

  // Calculate bus load (approximate)
  // Assumes 500kbps CAN, average frame ~100 bits (header + 8 data bytes + stuffing)
  // Bus capacity at 500kbps ≈ 5000 frames/sec theoretical max
  const maxFramesPerSec = 5000;
  const busLoad = Math.min(100, (frameRate / maxFramesPerSec) * 100);

  return { uniqueMessages, frameRate, avgDeltaMs, busLoad };
}
