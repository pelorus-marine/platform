//! Message Decoder Commands
//!
//! Analyzes CAN frame patterns to detect potential signals.
//! This runs asynchronously in Rust to avoid blocking the UI.

use crate::dto::CanFrameDto;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

/// Result of analyzing frames for a single message ID
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub message_id: u32,
    pub is_extended: bool,
    pub frame_count: usize,
    pub min_dlc: u8,
    pub max_dlc: u8,
    pub avg_interval_ms: f64,
    pub min_interval_ms: f64,
    pub max_interval_ms: f64,
    pub byte_patterns: Vec<BytePattern>,
    pub potential_signals: Vec<PotentialSignal>,
}

/// Pattern detected for a single byte position
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BytePattern {
    pub byte_index: usize,
    pub min: u8,
    pub max: u8,
    pub unique_values: usize,
    pub constant_value: Option<u8>,
    pub is_counter: bool,
    pub is_bitfield: bool,
    pub entropy: f64,
}

/// Potential signal detected from byte patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PotentialSignal {
    pub name: String,
    pub start_bit: usize,
    pub length: usize,
    pub is_signed: bool,
    pub min_value: f64,
    pub max_value: f64,
    pub confidence: f64,
    #[serde(rename = "type")]
    pub signal_type: SignalType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SignalType {
    Counter,
    Gauge,
    Bitfield,
    Constant,
    Unknown,
}

// ─────────────────────────────────────────────────────────────────────────────
// Tauri Commands
// ─────────────────────────────────────────────────────────────────────────────

/// Analyze CAN frames for a specific message ID to detect patterns and signals.
///
/// This command runs the analysis in a blocking task to avoid blocking the
/// async runtime, making it suitable for large datasets.
#[tauri::command]
pub async fn analyze_message_frames(
    message_id: u32,
    is_extended: bool,
    frames: Vec<CanFrameDto>,
) -> Result<AnalysisResult, String> {
    // Run CPU-intensive analysis in a blocking task
    tokio::task::spawn_blocking(move || analyze_frames(&frames, message_id, is_extended))
        .await
        .map_err(|e| format!("Analysis task failed: {}", e))?
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Functions
// ─────────────────────────────────────────────────────────────────────────────

/// Analyze frames and detect patterns
fn analyze_frames(
    frames: &[CanFrameDto],
    message_id: u32,
    is_extended: bool,
) -> Result<AnalysisResult, String> {
    if frames.is_empty() {
        return Err("No frames to analyze".to_string());
    }

    // Find DLC range
    let dlcs: Vec<u8> = frames.iter().map(|f| f.dlc).collect();
    let min_dlc = *dlcs.iter().min().unwrap_or(&0);
    let max_dlc = *dlcs.iter().max().unwrap_or(&0);

    // Calculate intervals
    let mut timestamps: Vec<f64> = frames.iter().map(|f| f.timestamp).collect();
    timestamps.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let intervals: Vec<f64> = timestamps
        .windows(2)
        .map(|w| (w[1] - w[0]) * 1000.0) // Convert to ms
        .collect();

    let avg_interval_ms = if !intervals.is_empty() {
        intervals.iter().sum::<f64>() / intervals.len() as f64
    } else {
        0.0
    };

    let min_interval_ms = intervals
        .iter()
        .copied()
        .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .unwrap_or(0.0);

    let max_interval_ms = intervals
        .iter()
        .copied()
        .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .unwrap_or(0.0);

    // Analyze bytes
    let byte_patterns = analyze_bytes(frames);

    // Detect potential signals
    let potential_signals = detect_signals(&byte_patterns);

    Ok(AnalysisResult {
        message_id,
        is_extended,
        frame_count: frames.len(),
        min_dlc,
        max_dlc,
        avg_interval_ms,
        min_interval_ms,
        max_interval_ms,
        byte_patterns,
        potential_signals,
    })
}

/// Analyze byte patterns across all frames
fn analyze_bytes(frames: &[CanFrameDto]) -> Vec<BytePattern> {
    let max_bytes = frames.iter().map(|f| f.data.len()).max().unwrap_or(0);
    let mut patterns = Vec::with_capacity(max_bytes);

    for byte_idx in 0..max_bytes {
        let mut values_set: HashSet<u8> = HashSet::new();
        let mut byte_values: Vec<u8> = Vec::new();

        for frame in frames {
            if byte_idx < frame.data.len() {
                let val = frame.data[byte_idx];
                values_set.insert(val);
                byte_values.push(val);
            }
        }

        if byte_values.is_empty() {
            continue;
        }

        // Check if constant
        let constant_value = if values_set.len() == 1 {
            values_set.iter().next().copied()
        } else {
            None
        };

        // Check if counter (increments by 1 each frame)
        let is_counter = detect_counter(&byte_values);

        // Check if bitfield (few discrete values)
        let is_bitfield = values_set.len() <= 8 && values_set.len() > 1;

        // Calculate entropy
        let entropy = calculate_entropy(&byte_values);

        let min = *byte_values.iter().min().unwrap_or(&0);
        let max = *byte_values.iter().max().unwrap_or(&0);

        patterns.push(BytePattern {
            byte_index: byte_idx,
            min,
            max,
            unique_values: values_set.len(),
            constant_value,
            is_counter,
            is_bitfield,
            entropy,
        });
    }

    patterns
}

/// Check if byte values form a counter pattern
fn detect_counter(values: &[u8]) -> bool {
    if values.len() <= 2 {
        return false;
    }

    let counter_matches = values
        .windows(2)
        .filter(|w| w[1] == w[0].wrapping_add(1))
        .count();

    counter_matches as f64 > values.len() as f64 * 0.8
}

/// Calculate Shannon entropy of byte values
fn calculate_entropy(values: &[u8]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }

    let mut counts: HashMap<u8, usize> = HashMap::new();
    for &v in values {
        *counts.entry(v).or_insert(0) += 1;
    }

    let len = values.len() as f64;
    counts
        .values()
        .map(|&count| {
            let p = count as f64 / len;
            if p > 0.0 { -p * p.log2() } else { 0.0 }
        })
        .sum()
}

/// Detect potential signals from byte patterns
fn detect_signals(patterns: &[BytePattern]) -> Vec<PotentialSignal> {
    let mut signals: Vec<PotentialSignal> = Vec::new();
    let mut signal_index = 1;

    // First pass: detect 8-bit signals
    for (idx, p) in patterns.iter().enumerate() {
        if p.constant_value.is_some() {
            signals.push(PotentialSignal {
                name: format!("Constant_{}", idx),
                start_bit: idx * 8,
                length: 8,
                is_signed: false,
                min_value: p.min as f64,
                max_value: p.max as f64,
                confidence: 1.0,
                signal_type: SignalType::Constant,
            });
        } else if p.is_counter {
            signals.push(PotentialSignal {
                name: format!("Counter_{}", signal_index),
                start_bit: idx * 8,
                length: 8,
                is_signed: false,
                min_value: p.min as f64,
                max_value: p.max as f64,
                confidence: 0.9,
                signal_type: SignalType::Counter,
            });
            signal_index += 1;
        } else if p.is_bitfield {
            signals.push(PotentialSignal {
                name: format!("Status_{}", signal_index),
                start_bit: idx * 8,
                length: 8,
                is_signed: false,
                min_value: p.min as f64,
                max_value: p.max as f64,
                confidence: 0.7,
                signal_type: SignalType::Bitfield,
            });
            signal_index += 1;
        } else if p.entropy > 3.0 {
            signals.push(PotentialSignal {
                name: format!("Signal_{}", signal_index),
                start_bit: idx * 8,
                length: 8,
                is_signed: false,
                min_value: p.min as f64,
                max_value: p.max as f64,
                confidence: 0.5,
                signal_type: SignalType::Gauge,
            });
            signal_index += 1;
        }
    }

    // Second pass: detect 16-bit signals
    detect_16bit_signals(patterns, &mut signals, &mut signal_index);

    // Sort by start bit
    signals.sort_by_key(|s| s.start_bit);
    signals
}

/// Detect potential 16-bit signals from consecutive high-entropy bytes
fn detect_16bit_signals(
    patterns: &[BytePattern],
    signals: &mut Vec<PotentialSignal>,
    signal_index: &mut usize,
) {
    for i in 0..patterns.len().saturating_sub(1) {
        let p1 = &patterns[i];
        let p2 = &patterns[i + 1];

        // Check for two consecutive high-entropy, non-counter, non-bitfield bytes
        if p1.entropy > 2.0
            && p2.entropy > 2.0
            && !p1.is_counter
            && !p2.is_counter
            && !p1.is_bitfield
            && !p2.is_bitfield
        {
            // Find existing 8-bit signals at these positions
            let existing_indices: Vec<usize> = signals
                .iter()
                .enumerate()
                .filter(|(_, s)| s.start_bit == i * 8 || s.start_bit == (i + 1) * 8)
                .map(|(idx, _)| idx)
                .collect();

            if existing_indices.len() == 2 {
                // Remove the two 8-bit signals (remove in reverse order to preserve indices)
                for &idx in existing_indices.iter().rev() {
                    signals.remove(idx);
                }

                // Add one 16-bit signal
                signals.push(PotentialSignal {
                    name: format!("Value_{}", *signal_index),
                    start_bit: i * 8,
                    length: 16,
                    is_signed: false,
                    min_value: (p1.min as u16 * 256 + p2.min as u16) as f64,
                    max_value: (p1.max as u16 * 256 + p2.max as u16) as f64,
                    confidence: 0.6,
                    signal_type: SignalType::Gauge,
                });
                *signal_index += 1;
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_frame(data: Vec<u8>, timestamp: f64) -> CanFrameDto {
        CanFrameDto {
            timestamp,
            channel: "test".to_string(),
            can_id: 0x100,
            is_extended: false,
            is_fd: false,
            brs: false,
            esi: false,
            dlc: data.len() as u8,
            data,
        }
    }

    #[test]
    fn test_detect_counter() {
        // Counter pattern
        let values: Vec<u8> = (0..10).collect();
        assert!(detect_counter(&values));

        // Wrapping counter
        let values: Vec<u8> = (250..=255).chain(0..5).collect();
        assert!(detect_counter(&values));

        // Not a counter
        let values: Vec<u8> = vec![1, 5, 2, 8, 3];
        assert!(!detect_counter(&values));
    }

    #[test]
    fn test_calculate_entropy() {
        // All same values = 0 entropy
        let values = vec![5, 5, 5, 5, 5];
        assert!((calculate_entropy(&values) - 0.0).abs() < 0.001);

        // Two equal values = 1 bit entropy
        let values = vec![0, 1, 0, 1, 0, 1];
        assert!((calculate_entropy(&values) - 1.0).abs() < 0.1);

        // Higher entropy with more unique values
        let values: Vec<u8> = (0..=255).collect();
        assert!(calculate_entropy(&values) > 7.0);
    }

    #[test]
    fn test_analyze_constant_byte() {
        let frames: Vec<CanFrameDto> = (0..10)
            .map(|i| make_frame(vec![0x42, i as u8], i as f64 * 0.01))
            .collect();

        let result = analyze_frames(&frames, 0x100, false).unwrap();

        assert_eq!(result.frame_count, 10);
        assert_eq!(result.byte_patterns.len(), 2);
        assert!(result.byte_patterns[0].constant_value.is_some());
        assert!(result.byte_patterns[1].is_counter);
    }

    #[test]
    fn test_analyze_intervals() {
        let frames: Vec<CanFrameDto> = (0..5)
            .map(|i| make_frame(vec![0x00], i as f64 * 0.010)) // 10ms intervals
            .collect();

        let result = analyze_frames(&frames, 0x100, false).unwrap();

        assert!((result.avg_interval_ms - 10.0).abs() < 0.1);
    }
}
