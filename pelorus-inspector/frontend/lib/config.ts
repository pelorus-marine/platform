import type { InspectorConfig } from './types';

export type { FilterConfig, FilterResult, FrameStats, MessageCount, MatchStatus } from './filter';
export {
  createEmptyFilterConfig,
  parseCanIds,
  parseNames,
  parseDataPattern,
  matchDataPattern,
  countActiveFilters,
  calculateFrameStats,
  getMessageCounts,
  filterFrames,
} from './filter';

/** Default configuration for Pelorus Inspector */
export const defaultConfig: Required<InspectorConfig> = {
  appName: 'Pelorus Inspector',
  showDbcTab: true,
  showVssTab: true,
  showLiveTab: true,
  showMdf4Tab: true,
  showAboutTab: true,
  initialTab: 'dbc',
  autoScroll: true,
  maxFrames: 10000,
  maxSignals: 10000,
};
