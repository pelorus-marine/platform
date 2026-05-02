import type { InspectorConfig, CanFrame, DbcInfo } from './types';
import {
  parseCanIds as parseCanIdsNew,
  parseNames as parseNamesNew,
  filterFrames as filterFramesNew,
  type FilterConfig,
} from './filter';

// Re-export filter types and functions from dedicated module
export type { FilterConfig, FilterResult, FrameStats, MessageCount, MatchStatus } from './filter';
export {
  createEmptyFilterConfig,
  parseDataPattern,
  matchDataPattern,
  countActiveFilters,
  calculateFrameStats,
  getMessageCounts,
} from './filter';

// ─────────────────────────────────────────────────────────────────────────────
// Legacy API (uses null instead of [] for empty values)
// ─────────────────────────────────────────────────────────────────────────────

/** Legacy filter interface with null for empty values */
export interface Filters {
  timeMin: number | null;
  timeMax: number | null;
  canIds: number[] | null;
  messages: string[] | null;
  signals: string[] | null;
  dataPattern: string | null;
  channel: string | null;
  matchStatus: 'all' | 'matched' | 'unmatched';
}

/** Create empty filter state (legacy: uses null) */
export function createEmptyFilters(): Filters {
  return {
    timeMin: null,
    timeMax: null,
    canIds: null,
    messages: null,
    signals: null,
    dataPattern: null,
    channel: null,
    matchStatus: 'all',
  };
}

/** Parse CAN IDs (legacy: returns null for empty) */
export function parseCanIds(input: string): number[] | null {
  const result = parseCanIdsNew(input);
  return result.length > 0 ? result : null;
}

/** Parse message names (legacy: returns null for empty) */
export function parseMessageNames(input: string): string[] | null {
  const result = parseNamesNew(input);
  return result.length > 0 ? result : null;
}

/** Filter frames (legacy: works with Filters type that uses null) */
export function filterFrames(frames: CanFrame[], filters: Filters, dbcInfo: DbcInfo | null = null): CanFrame[] {
  // Convert legacy Filters to FilterConfig
  const config: FilterConfig = {
    timeMin: filters.timeMin,
    timeMax: filters.timeMax,
    canIds: filters.canIds ?? [],
    messages: filters.messages ?? [],
    signals: filters.signals ?? [],
    dataPattern: filters.dataPattern,
    channel: filters.channel,
    matchStatus: filters.matchStatus,
  };
  return filterFramesNew(frames, config, dbcInfo);
}

// Also export the new versions with explicit names
export { parseCanIdsNew as parseCanIdsArray, parseNamesNew as parseNames };

/** Default configuration for Pelorus Inspector */
export const defaultConfig: Required<InspectorConfig> = {
  appName: 'Pelorus Inspector',
  showDbcTab: true,
  showLiveTab: true,
  showMdf4Tab: true,
  showAboutTab: true,
  initialTab: 'dbc',
  autoScroll: true,
  maxFrames: 10000,
  maxSignals: 10000,
};
