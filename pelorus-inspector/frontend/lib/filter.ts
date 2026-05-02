/**
 * Frame Filter Module
 *
 * Shared types and utilities for CAN frame filtering.
 * Used by the TypeScript viewer; live capture may use Rust `filter_frames` when wired.
 */

import type { CanFrame, DbcInfo, MessageInfo } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Match status for DBC filtering */
export type MatchStatus = 'all' | 'matched' | 'unmatched';

/** Filter configuration for CAN frames */
export interface FilterConfig {
  /** Minimum timestamp (inclusive) */
  timeMin: number | null;
  /** Maximum timestamp (inclusive) */
  timeMax: number | null;
  /** CAN IDs to include (empty = all) */
  canIds: number[];
  /** Message names to filter (substring match, case-insensitive) */
  messages: string[];
  /** Signal names to filter (substring match, case-insensitive) */
  signals: string[];
  /** Data pattern filter (e.g., "01 ?? FF") */
  dataPattern: string | null;
  /** Channel to filter (exact match) */
  channel: string | null;
  /** Match status (all, matched, unmatched) */
  matchStatus: MatchStatus;
}

/** Result of filtering frames (matches Rust FilterResult) */
export interface FilterResult {
  /** Filtered frames */
  frames: CanFrame[];
  /** Total frames before filtering */
  totalCount: number;
  /** Filtered frame count */
  filteredCount: number;
}

/** Frame statistics (matches Rust FrameStats) */
export interface FrameStats {
  /** Number of unique message IDs */
  uniqueMessages: number;
  /** Frames per second */
  frameRate: number;
  /** Average delta time in milliseconds */
  avgDeltaMs: number;
  /** Estimated bus load percentage */
  busLoad: number;
}

/** Message ID counts (matches Rust MessageCount) */
export interface MessageCount {
  canId: number;
  isExtended: boolean;
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Create empty filter configuration */
export function createEmptyFilterConfig(): FilterConfig {
  return {
    timeMin: null,
    timeMax: null,
    canIds: [],
    messages: [],
    signals: [],
    dataPattern: null,
    channel: null,
    matchStatus: 'all',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Parse data pattern (hex bytes with wildcards, e.g., "01 ?? FF") */
export function parseDataPattern(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return null;
  return trimmed;
}

/** Check if data matches pattern (supports ?? or XX as wildcard) */
export function matchDataPattern(data: number[], pattern: string): boolean {
  const patternBytes = pattern.split(/\s+/);
  if (patternBytes.length > data.length) return false;

  for (let i = 0; i < patternBytes.length; i++) {
    const p = patternBytes[i];
    if (p === '??' || p === 'XX') continue;
    const expected = parseInt(p, 16);
    if (isNaN(expected) || data[i] !== expected) return false;
  }
  return true;
}

/** Parse CAN IDs from comma-separated hex string */
export function parseCanIds(input: string): number[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  return trimmed
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => parseInt(s, 16))
    .filter(n => !isNaN(n));
}

/** Parse names from comma-separated string (lowercased) */
export function parseNames(input: string): string[] {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return [];

  return trimmed
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Count active filter constraints (non-default fields). */
export function countActiveFilters(filters: FilterConfig): number {
  let count = 0;
  if (filters.timeMin !== null ||
      filters.timeMax !== null) count++;
  if (filters.canIds.length > 0) count++;
  if (filters.messages.length > 0) count++;
  if (filters.signals.length > 0) count++;
  if (filters.dataPattern) count++;
  if (filters.channel) count++;
  if (filters.matchStatus && filters.matchStatus !== 'all') count++;
  return count;
}

/** Get message info from DBC by CAN ID */
function getMessageInfo(dbcInfo: DbcInfo | null, canId: number): MessageInfo | null {
  if (!dbcInfo?.messages) return null;
  return dbcInfo.messages.find(m => m.id === canId) || null;
}

/**
 * Filter frames based on filter configuration.
 * This is the TypeScript implementation used by Pelorus Inspector.
 * Backend `filter_frames` mirrors this behavior for live streams when used.
 */
export function filterFrames(frames: CanFrame[], filters: FilterConfig, dbcInfo: DbcInfo | null = null): CanFrame[] {
  const hasCanIdFilter = filters.canIds.length > 0;
  const canIdSet = new Set(filters.canIds);
  const hasMessageFilter = filters.messages.length > 0;
  const hasSignalFilter = filters.signals.length > 0;

  return frames.filter(frame => {
    // Time range filter
    if (filters.timeMin !== null && frame.timestamp < filters.timeMin) return false;
    if (filters.timeMax !== null && frame.timestamp > filters.timeMax) return false;

    // CAN ID filter
    if (hasCanIdFilter && !canIdSet.has(frame.can_id)) return false;

    // Channel filter
    if (filters.channel) {
      const ch = filters.channel.toLowerCase();
      if (!frame.channel.toLowerCase().includes(ch)) return false;
    }

    // Data pattern filter
    if (filters.dataPattern && !matchDataPattern(frame.data, filters.dataPattern)) return false;

    // Get message info for DBC-related filters
    const msgInfo = getMessageInfo(dbcInfo, frame.can_id);
    const hasMatch = msgInfo !== null;

    // Match status filter
    if (filters.matchStatus === 'matched' && !hasMatch) return false;
    if (filters.matchStatus === 'unmatched' && hasMatch) return false;

    // Message name filter
    if (hasMessageFilter) {
      if (!hasMatch) return false;
      const msgName = msgInfo.name.toLowerCase();
      if (!filters.messages.some(m => msgName.includes(m))) return false;
    }

    // Signal name filter
    if (hasSignalFilter) {
      if (!hasMatch) return false;
      const signalNames = msgInfo.signals.map(s => s.name.toLowerCase());
      if (!filters.signals.some(s => signalNames.some(sn => sn.includes(s)))) return false;
    }

    return true;
  });
}

/**
 * Calculate frame statistics.
 * Frame statistics for Pelorus Inspector (offline / viewer).
 */
export function calculateFrameStats(frames: CanFrame[]): FrameStats {
  if (frames.length === 0) {
    return { uniqueMessages: 0, frameRate: 0, avgDeltaMs: 0, busLoad: 0 };
  }

  // Count unique message IDs
  const uniqueIds = new Set(frames.map(f => f.can_id));
  const uniqueMessages = uniqueIds.size;

  // Calculate frame rate using recent frames
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

  // Estimate bus load (assumes 500kbps CAN, ~5000 frames/sec max)
  const maxFramesPerSec = 5000;
  const busLoad = Math.min((frameRate / maxFramesPerSec) * 100, 100);

  return { uniqueMessages, frameRate, avgDeltaMs, busLoad };
}

/**
 * Get message ID counts sorted by frequency.
 */
export function getMessageCounts(frames: CanFrame[]): MessageCount[] {
  const counts = new Map<string, { canId: number; isExtended: boolean; count: number }>();

  for (const frame of frames) {
    const key = `${frame.can_id}-${frame.is_extended}`;
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { canId: frame.can_id, isExtended: frame.is_extended, count: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}
