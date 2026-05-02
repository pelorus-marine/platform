//! Frame filtering and statistics - all computation in Rust.
//!
//! Replaces TypeScript `getFilteredFrames()` and `calculateFrameStats()`.

use crate::dto::CanFrameDto;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

// ─────────────────────────────────────────────────────────────────────────────
// Filter Configuration
// ─────────────────────────────────────────────────────────────────────────────

/// Match status filter for DBC matching.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MatchStatus {
    #[default]
    All,
    Matched,
    Unmatched,
}

/// Filter configuration matching frontend `FilterConfig` (camelCase JSON).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FilterConfig {
    /// Minimum timestamp (inclusive)
    pub time_min: Option<f64>,
    /// Maximum timestamp (inclusive)
    pub time_max: Option<f64>,
    /// CAN IDs to include (empty = all)
    #[serde(default)]
    pub can_ids: Vec<u32>,
    /// Message names to filter (substring match, lowercase)
    #[serde(default)]
    pub messages: Vec<String>,
    /// Signal names to filter (substring match, lowercase)
    #[serde(default)]
    pub signals: Vec<String>,
    /// Data pattern filter (e.g., "01 ?? FF")
    pub data_pattern: Option<String>,
    /// Channel to filter (exact match)
    pub channel: Option<String>,
    /// Match status (all, matched, unmatched)
    #[serde(default)]
    pub match_status: MatchStatus,
}

/// Result of filtering frames.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterResult {
    /// Filtered frames
    pub frames: Vec<CanFrameDto>,
    /// Total frames before filtering
    pub total_count: usize,
    /// Filtered frame count
    pub filtered_count: usize,
}

/// Frame statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameStats {
    /// Number of unique message IDs
    pub unique_messages: usize,
    /// Frames per second
    pub frame_rate: f64,
    /// Average delta time in milliseconds
    pub avg_delta_ms: f64,
    /// Estimated bus load percentage (assumes 500kbps CAN)
    pub bus_load: f64,
}

/// Message ID counts for aggregation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageCount {
    pub can_id: u32,
    pub is_extended: bool,
    pub count: u64,
}

/// DLC detection result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DlcDetectionResult {
    pub detected_dlc: u8,
    pub confidence: f64,
    pub sample_count: usize,
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Pattern Matching (exported for use by other modules)
// ─────────────────────────────────────────────────────────────────────────────

/// Parse data pattern into bytes and wildcards.
/// Pattern format: "01 ?? FF" where ?? is wildcard.
pub fn parse_data_pattern(pattern: &str) -> Vec<Option<u8>> {
    pattern
        .split_whitespace()
        .map(|s| {
            let s = s.to_uppercase();
            if s == "??" || s == "XX" {
                None // Wildcard
            } else {
                u8::from_str_radix(&s, 16).ok()
            }
        })
        .collect()
}

/// Check if frame data matches pattern.
pub fn match_data_pattern(data: &[u8], pattern: &[Option<u8>]) -> bool {
    if pattern.len() > data.len() {
        return false;
    }

    for (i, expected) in pattern.iter().enumerate() {
        if let Some(expected_byte) = expected {
            if data[i] != *expected_byte {
                return false;
            }
        }
        // None = wildcard, always matches
    }
    true
}

// ─────────────────────────────────────────────────────────────────────────────
// DBC Message Info Cache (public for pro crate reuse)
// ─────────────────────────────────────────────────────────────────────────────

/// Cached message info for filtering.
/// Public for use by pro crate's multi-DBC filter.
pub struct DbcMessageInfo {
    pub name: String,
    pub signal_names: Vec<String>,
}

/// Message info cache type alias for convenience.
pub type DbcMessageCache = HashMap<(u32, bool), DbcMessageInfo>;

/// Build message info cache from a DBC for fast lookups.
/// This is the core function that both base and pro versions use.
pub fn build_message_cache_from_dbc(dbc: &dbc_rs::Dbc) -> DbcMessageCache {
    let mut cache = HashMap::new();

    for msg in dbc.messages().iter() {
        let is_extended = msg.id() > 0x7FF;
        let signal_names: Vec<String> = msg
            .signals()
            .iter()
            .map(|s| s.name().to_lowercase())
            .collect();

        cache.insert(
            (msg.id(), is_extended),
            DbcMessageInfo {
                name: msg.name().to_lowercase(),
                signal_names,
            },
        );
    }

    cache
}

/// Build message info cache from AppState's DBC.
pub fn build_message_cache(state: &AppState) -> DbcMessageCache {
    let dbc_guard = state.dbc.lock();
    match *dbc_guard {
        Some(ref dbc) => build_message_cache_from_dbc(dbc),
        None => HashMap::new(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Filter Logic (public for pro crate reuse)
// ─────────────────────────────────────────────────────────────────────────────

/// Filter frames using a pre-built message cache.
/// This is the core filtering function that both base and pro versions use.
pub fn filter_frames_with_cache(
    frames: Vec<CanFrameDto>,
    filters: &FilterConfig,
    msg_cache: &DbcMessageCache,
) -> FilterResult {
    let total_count = frames.len();

    // Build CAN ID set for O(1) lookup
    let can_id_set: HashSet<u32> = filters.can_ids.iter().copied().collect();
    let has_can_id_filter = !can_id_set.is_empty();

    // Parse data pattern once
    let data_pattern = filters.data_pattern.as_ref().map(|p| parse_data_pattern(p));
    let has_data_pattern = data_pattern.as_ref().is_some_and(|p| !p.is_empty());

    // Lowercase message/signal filters for case-insensitive matching
    let message_filters: Vec<String> = filters.messages.iter().map(|s| s.to_lowercase()).collect();
    let has_message_filter = !message_filters.is_empty();

    let signal_filters: Vec<String> = filters.signals.iter().map(|s| s.to_lowercase()).collect();
    let has_signal_filter = !signal_filters.is_empty();

    // Check if we need DBC-related filters
    let needs_dbc =
        filters.match_status != MatchStatus::All || has_message_filter || has_signal_filter;

    // Filter frames
    let filtered: Vec<CanFrameDto> = frames
        .into_iter()
        .filter(|frame| {
            // Time range filter
            if let Some(min) = filters.time_min {
                if frame.timestamp < min {
                    return false;
                }
            }
            if let Some(max) = filters.time_max {
                if frame.timestamp > max {
                    return false;
                }
            }

            // CAN ID filter
            if has_can_id_filter && !can_id_set.contains(&frame.can_id) {
                return false;
            }

            // Channel filter
            if let Some(ref ch) = filters.channel {
                if frame.channel != *ch {
                    return false;
                }
            }

            // Data pattern filter
            if has_data_pattern {
                if let Some(ref pattern) = data_pattern {
                    if !match_data_pattern(&frame.data, pattern) {
                        return false;
                    }
                }
            }

            // DBC-related filters
            if needs_dbc {
                let key = (frame.can_id, frame.is_extended);
                let msg_info = msg_cache.get(&key);
                let has_match = msg_info.is_some();

                // Match status filter
                match filters.match_status {
                    MatchStatus::All => {}
                    MatchStatus::Matched => {
                        if !has_match {
                            return false;
                        }
                    }
                    MatchStatus::Unmatched => {
                        if has_match {
                            return false;
                        }
                    }
                }

                // Message name filter
                if has_message_filter {
                    let Some(info) = msg_info else {
                        return false;
                    };
                    if !message_filters.iter().any(|m| info.name.contains(m)) {
                        return false;
                    }
                }

                // Signal name filter
                if has_signal_filter {
                    let Some(info) = msg_info else {
                        return false;
                    };
                    if !signal_filters
                        .iter()
                        .any(|s| info.signal_names.iter().any(|sn| sn.contains(s)))
                    {
                        return false;
                    }
                }
            }

            true
        })
        .collect();

    let filtered_count = filtered.len();

    FilterResult {
        frames: filtered,
        total_count,
        filtered_count,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

/// Filter frames based on filter configuration.
/// All filtering logic runs in Rust - TS just displays results.
#[tauri::command]
pub fn filter_frames(
    frames: Vec<CanFrameDto>,
    filters: FilterConfig,
    state: tauri::State<'_, Arc<AppState>>,
) -> FilterResult {
    // Build DBC message cache if needed
    let needs_dbc = filters.match_status != MatchStatus::All
        || !filters.messages.is_empty()
        || !filters.signals.is_empty();

    let msg_cache = if needs_dbc {
        build_message_cache(&state)
    } else {
        HashMap::new()
    };

    filter_frames_with_cache(frames, &filters, &msg_cache)
}

/// Calculate frame statistics.
/// All computation in Rust - TS just displays results.
#[tauri::command]
pub fn calculate_frame_stats(frames: Vec<CanFrameDto>) -> FrameStats {
    if frames.is_empty() {
        return FrameStats {
            unique_messages: 0,
            frame_rate: 0.0,
            avg_delta_ms: 0.0,
            bus_load: 0.0,
        };
    }

    // Count unique message IDs
    let unique_ids: HashSet<u32> = frames.iter().map(|f| f.can_id).collect();
    let unique_messages = unique_ids.len();

    // Calculate frame rate and delta time using recent frames
    let recent_count = frames.len().min(100);
    let recent_frames = &frames[frames.len() - recent_count..];

    let mut frame_rate = 0.0;
    let mut avg_delta_ms = 0.0;

    if recent_frames.len() >= 2 {
        let first_ts = recent_frames[0].timestamp;
        let last_ts = recent_frames[recent_frames.len() - 1].timestamp;
        let duration = last_ts - first_ts;

        if duration > 0.0 {
            frame_rate = (recent_frames.len() - 1) as f64 / duration;
            avg_delta_ms = (duration / (recent_frames.len() - 1) as f64) * 1000.0;
        }
    }

    // Calculate bus load (approximate)
    // Assumes 500kbps CAN, average frame ~100 bits
    // Bus capacity at 500kbps ≈ 5000 frames/sec theoretical max
    let max_frames_per_sec = 5000.0;
    let bus_load = (frame_rate / max_frames_per_sec * 100.0).min(100.0);

    FrameStats {
        unique_messages,
        frame_rate,
        avg_delta_ms,
        bus_load,
    }
}

/// Get message ID counts (sorted by count descending).
/// Replaces TypeScript `updateAvailableIds()`.
#[tauri::command]
pub fn get_message_counts(frames: Vec<CanFrameDto>) -> Vec<MessageCount> {
    let mut counts: HashMap<(u32, bool), u64> = HashMap::new();

    for frame in &frames {
        *counts.entry((frame.can_id, frame.is_extended)).or_default() += 1;
    }

    let mut result: Vec<MessageCount> = counts
        .into_iter()
        .map(|((can_id, is_extended), count)| MessageCount {
            can_id,
            is_extended,
            count,
        })
        .collect();

    // Sort by count descending
    result.sort_by(|a, b| b.count.cmp(&a.count));

    result
}

/// Detect DLC from frames for a specific CAN ID.
/// Uses histogram to find most common DLC value.
#[tauri::command]
pub fn detect_dlc(frames: Vec<CanFrameDto>, can_id: u32, is_extended: bool) -> DlcDetectionResult {
    // Filter frames for this CAN ID
    let matching: Vec<&CanFrameDto> = frames
        .iter()
        .filter(|f| f.can_id == can_id && f.is_extended == is_extended)
        .collect();

    if matching.is_empty() {
        return DlcDetectionResult {
            detected_dlc: 8,
            confidence: 0.0,
            sample_count: 0,
        };
    }

    // Build histogram of DLC values
    let mut dlc_counts: HashMap<u8, usize> = HashMap::new();
    for frame in &matching {
        *dlc_counts.entry(frame.dlc).or_default() += 1;
    }

    // Find most common DLC
    let (detected_dlc, max_count) = dlc_counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(dlc, count)| (*dlc, *count))
        .unwrap_or((8, 0));

    let confidence = if matching.is_empty() {
        0.0
    } else {
        max_count as f64 / matching.len() as f64
    };

    DlcDetectionResult {
        detected_dlc,
        confidence,
        sample_count: matching.len(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_frame(id: u32, timestamp: f64, data: Vec<u8>) -> CanFrameDto {
        CanFrameDto {
            timestamp,
            channel: "vcan0".to_string(),
            can_id: id,
            is_extended: false,
            is_fd: false,
            brs: false,
            esi: false,
            dlc: data.len() as u8,
            data,
        }
    }

    #[test]
    fn test_parse_data_pattern() {
        let pattern = parse_data_pattern("01 ?? FF");
        assert_eq!(pattern.len(), 3);
        assert_eq!(pattern[0], Some(0x01));
        assert_eq!(pattern[1], None); // Wildcard
        assert_eq!(pattern[2], Some(0xFF));
    }

    #[test]
    fn test_match_data_pattern() {
        let pattern = parse_data_pattern("01 ?? FF");
        assert!(match_data_pattern(&[0x01, 0x00, 0xFF], &pattern));
        assert!(match_data_pattern(&[0x01, 0xAB, 0xFF], &pattern));
        assert!(!match_data_pattern(&[0x01, 0xAB, 0xFE], &pattern));
        assert!(!match_data_pattern(&[0x02, 0xAB, 0xFF], &pattern));
    }

    #[test]
    fn test_calculate_frame_stats_empty() {
        let stats = calculate_frame_stats(vec![]);
        assert_eq!(stats.unique_messages, 0);
        assert_eq!(stats.frame_rate, 0.0);
    }

    #[test]
    fn test_calculate_frame_stats() {
        let frames = vec![
            make_frame(0x100, 0.0, vec![0, 1, 2, 3, 4, 5, 6, 7]),
            make_frame(0x100, 0.001, vec![0, 1, 2, 3, 4, 5, 6, 7]),
            make_frame(0x200, 0.002, vec![0, 1, 2, 3, 4, 5, 6, 7]),
        ];
        let stats = calculate_frame_stats(frames);
        assert_eq!(stats.unique_messages, 2);
        assert!(stats.frame_rate > 0.0);
    }

    #[test]
    fn test_get_message_counts() {
        let frames = vec![
            make_frame(0x100, 0.0, vec![]),
            make_frame(0x100, 0.001, vec![]),
            make_frame(0x200, 0.002, vec![]),
        ];
        let counts = get_message_counts(frames);
        assert_eq!(counts.len(), 2);
        assert_eq!(counts[0].can_id, 0x100); // Higher count first
        assert_eq!(counts[0].count, 2);
        assert_eq!(counts[1].can_id, 0x200);
        assert_eq!(counts[1].count, 1);
    }

    #[test]
    fn test_detect_dlc() {
        let frames = vec![
            make_frame(0x100, 0.0, vec![0; 8]),
            make_frame(0x100, 0.001, vec![0; 8]),
            make_frame(0x100, 0.002, vec![0; 4]),
            make_frame(0x200, 0.003, vec![0; 2]),
        ];
        let result = detect_dlc(frames, 0x100, false);
        assert_eq!(result.detected_dlc, 8);
        assert!(result.confidence > 0.6); // 2/3 = 0.666
        assert_eq!(result.sample_count, 3);
    }
}
