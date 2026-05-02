//! Workflow Node Executors
//!
//! Implementations for all workflow node types that process CAN data.

use crate::dto::CanFrameDto;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─────────────────────────────────────────────────────────────────────────────
// Port Data Types
// ─────────────────────────────────────────────────────────────────────────────

/// Decoded signal value from DBC decode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedSignal {
    pub message_name: String,
    pub signal_name: String,
    pub value: f64,
    pub unit: String,
    pub timestamp: f64,
    pub can_id: u32,
}

/// Data that flows through workflow ports
#[derive(Debug, Clone, Default)]
pub struct PortData {
    /// CAN frames (for frame-based nodes)
    pub frames: Vec<CanFrameDto>,
    /// Decoded signals (for signal-based nodes)
    pub signals: Vec<DecodedSignal>,
    /// Numeric value (for logic nodes like threshold/counter)
    pub value: Option<f64>,
    /// Counter value
    pub count: Option<i64>,
    /// Trigger flag
    pub triggered: bool,
}

impl PortData {
    pub fn from_frames(frames: Vec<CanFrameDto>) -> Self {
        Self {
            frames,
            ..Default::default()
        }
    }

    pub fn from_signals(signals: Vec<DecodedSignal>) -> Self {
        Self {
            signals,
            ..Default::default()
        }
    }

    #[allow(dead_code)]
    pub fn from_value(value: f64) -> Self {
        Self {
            value: Some(value),
            ..Default::default()
        }
    }

    pub fn trigger() -> Self {
        Self {
            triggered: true,
            ..Default::default()
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Executor Trait
// ─────────────────────────────────────────────────────────────────────────────

/// Context provided to node executors
pub struct ExecutionContext<'a> {
    /// Node configuration from workflow definition
    pub config: &'a HashMap<String, serde_json::Value>,
    /// FastDbc for O(1) message lookup and efficient decode/encode
    pub fast_dbc: Option<&'a dbc_rs::FastDbc>,
    /// Pre-allocated decode buffer (sized for max signals in any message)
    pub decode_buffer: &'a mut Vec<f64>,
}

/// Output from a node execution - maps output port index to data
pub type NodeOutputs = HashMap<usize, PortData>;

/// Trait for workflow node executors
pub trait NodeExecutor: Send + Sync {
    /// Execute the node with given inputs
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs;

    /// Get the node type name
    #[allow(dead_code)]
    fn node_type(&self) -> &'static str;

    /// Reset any internal state
    #[allow(dead_code)]
    fn reset(&mut self) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter by ID Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Filter frames by CAN ID
pub struct FilterIdExecutor {
    ids: std::collections::HashSet<u32>,
    mode: FilterMode,
    /// Cached config string to avoid re-parsing on every execute
    cached_ids_str: String,
    cached_mode_str: String,
}

#[derive(Clone, Copy, PartialEq)]
pub enum FilterMode {
    Include,
    Exclude,
}

impl FilterIdExecutor {
    pub fn new() -> Self {
        Self {
            ids: std::collections::HashSet::new(),
            mode: FilterMode::Include,
            cached_ids_str: String::new(),
            cached_mode_str: String::new(),
        }
    }

    fn update_config(&mut self, config: &HashMap<String, serde_json::Value>) {
        // Get current config strings
        let ids_str = config.get("ids").and_then(|v| v.as_str()).unwrap_or("");
        let mode_str = config
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("include");

        // Only re-parse if config changed
        if ids_str != self.cached_ids_str {
            self.cached_ids_str = ids_str.to_string();
            self.ids = ids_str
                .split(',')
                .filter_map(|s| {
                    let s = s.trim().trim_start_matches("0x").trim_start_matches("0X");
                    u32::from_str_radix(s, 16).ok()
                })
                .collect();
        }

        if mode_str != self.cached_mode_str {
            self.cached_mode_str = mode_str.to_string();
            self.mode = if mode_str == "exclude" {
                FilterMode::Exclude
            } else {
                FilterMode::Include
            };
        }
    }
}

impl Default for FilterIdExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeExecutor for FilterIdExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        self.update_config(ctx.config);

        let mut match_frames = Vec::new();
        let mut other_frames = Vec::new();

        // Get frames from first input
        let empty_frames = Vec::new();
        let frames = inputs.first().map(|p| &p.frames).unwrap_or(&empty_frames);

        for frame in frames {
            let matches_filter = self.ids.contains(&frame.can_id);
            let passes = match self.mode {
                FilterMode::Include => matches_filter,
                FilterMode::Exclude => !matches_filter,
            };

            if passes {
                match_frames.push(frame.clone());
            } else {
                other_frames.push(frame.clone());
            }
        }

        let mut outputs = HashMap::new();
        outputs.insert(0, PortData::from_frames(match_frames)); // match output
        outputs.insert(1, PortData::from_frames(other_frames)); // other output
        outputs
    }

    fn node_type(&self) -> &'static str {
        "filter-id"
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter by Data Pattern Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Filter frames by data pattern with mask
pub struct FilterDataExecutor {
    /// Cached parsed pattern bytes
    pattern: Vec<u8>,
    /// Cached parsed mask bytes
    mask: Vec<u8>,
    /// Cached config strings
    cached_pattern_str: String,
    cached_mask_str: String,
}

impl FilterDataExecutor {
    pub fn new() -> Self {
        Self {
            pattern: Vec::new(),
            mask: Vec::new(),
            cached_pattern_str: String::new(),
            cached_mask_str: String::new(),
        }
    }

    fn parse_hex_bytes(s: &str) -> Vec<u8> {
        let s = s.trim().replace(' ', "");
        (0..s.len())
            .step_by(2)
            .filter_map(|i| {
                s.get(i..i + 2)
                    .and_then(|byte_str| u8::from_str_radix(byte_str, 16).ok())
            })
            .collect()
    }

    fn update_config(&mut self, config: &HashMap<String, serde_json::Value>) {
        let pattern_str = config.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
        let mask_str = config
            .get("mask")
            .and_then(|v| v.as_str())
            .unwrap_or("FFFFFFFFFFFFFFFF");

        if pattern_str != self.cached_pattern_str {
            self.cached_pattern_str = pattern_str.to_string();
            self.pattern = Self::parse_hex_bytes(pattern_str);
        }
        if mask_str != self.cached_mask_str {
            self.cached_mask_str = mask_str.to_string();
            self.mask = Self::parse_hex_bytes(mask_str);
        }
    }
}

impl Default for FilterDataExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeExecutor for FilterDataExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        self.update_config(ctx.config);

        let pattern = &self.pattern;
        let mask = &self.mask;

        let mut match_frames = Vec::new();
        let mut other_frames = Vec::new();

        let empty_frames = Vec::new();
        let frames = inputs.first().map(|p| &p.frames).unwrap_or(&empty_frames);

        for frame in frames {
            let matches = Self::data_matches(&frame.data, pattern, mask);
            if matches {
                match_frames.push(frame.clone());
            } else {
                other_frames.push(frame.clone());
            }
        }

        let mut outputs = HashMap::new();
        outputs.insert(0, PortData::from_frames(match_frames));
        outputs.insert(1, PortData::from_frames(other_frames));
        outputs
    }

    fn node_type(&self) -> &'static str {
        "filter-data"
    }
}

impl FilterDataExecutor {
    fn data_matches(data: &[u8], pattern: &[u8], mask: &[u8]) -> bool {
        if pattern.is_empty() {
            return true;
        }

        for (i, &p) in pattern.iter().enumerate() {
            let data_byte = data.get(i).copied().unwrap_or(0);
            let mask_byte = mask.get(i).copied().unwrap_or(0xFF);
            if (data_byte & mask_byte) != (p & mask_byte) {
                return false;
            }
        }
        true
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter by Signal Name Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Filter decoded signals by name
pub struct FilterSignalNameExecutor {
    /// Cached parsed signal names (lowercase for case-insensitive matching)
    names: Vec<String>,
    /// Cached mode
    exclude_mode: bool,
    /// Cached config strings
    cached_names_str: String,
    cached_mode_str: String,
}

impl FilterSignalNameExecutor {
    pub fn new() -> Self {
        Self {
            names: Vec::new(),
            exclude_mode: false,
            cached_names_str: String::new(),
            cached_mode_str: String::new(),
        }
    }

    fn update_config(&mut self, config: &HashMap<String, serde_json::Value>) {
        let names_str = config.get("names").and_then(|v| v.as_str()).unwrap_or("");
        let mode_str = config
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("include");

        if names_str != self.cached_names_str {
            self.cached_names_str = names_str.to_string();
            self.names = names_str
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }
        if mode_str != self.cached_mode_str {
            self.cached_mode_str = mode_str.to_string();
            self.exclude_mode = mode_str == "exclude";
        }
    }
}

impl Default for FilterSignalNameExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeExecutor for FilterSignalNameExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        self.update_config(ctx.config);

        let mut match_signals = Vec::new();
        let mut other_signals = Vec::new();

        let empty_signals = Vec::new();
        let signals = inputs.first().map(|p| &p.signals).unwrap_or(&empty_signals);

        for signal in signals {
            let name_matches = self.names.iter().any(|n| {
                signal.signal_name.eq_ignore_ascii_case(n) || signal.signal_name.contains(n)
            });

            let passes = if self.exclude_mode {
                !name_matches
            } else {
                name_matches
            };

            if passes {
                match_signals.push(signal.clone());
            } else {
                other_signals.push(signal.clone());
            }
        }

        let mut outputs = HashMap::new();
        outputs.insert(0, PortData::from_signals(match_signals));
        outputs.insert(1, PortData::from_signals(other_signals));
        outputs
    }

    fn node_type(&self) -> &'static str {
        "filter-signal-name"
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter by Signal Value Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Filter signals by comparing value
#[derive(Default)]
pub struct FilterSignalValueExecutor;

impl FilterSignalValueExecutor {
    pub fn new() -> Self {
        Self
    }
}

impl NodeExecutor for FilterSignalValueExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        let signal_name = ctx
            .config
            .get("signal")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let operator = ctx
            .config
            .get("operator")
            .and_then(|v| v.as_str())
            .unwrap_or(">");
        let threshold = ctx
            .config
            .get("value")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let mut match_signals = Vec::new();
        let mut other_signals = Vec::new();

        let empty_signals = Vec::new();
        let signals = inputs.first().map(|p| &p.signals).unwrap_or(&empty_signals);

        for signal in signals {
            // Check if this is the signal we're filtering
            let is_target =
                signal_name.is_empty() || signal.signal_name.eq_ignore_ascii_case(signal_name);

            if !is_target {
                // Not the target signal, pass through to 'other'
                other_signals.push(signal.clone());
                continue;
            }

            let passes = match operator {
                ">" => signal.value > threshold,
                "<" => signal.value < threshold,
                ">=" => signal.value >= threshold,
                "<=" => signal.value <= threshold,
                "==" => (signal.value - threshold).abs() < f64::EPSILON,
                "!=" => (signal.value - threshold).abs() >= f64::EPSILON,
                _ => false,
            };

            if passes {
                match_signals.push(signal.clone());
            } else {
                other_signals.push(signal.clone());
            }
        }

        let mut outputs = HashMap::new();
        outputs.insert(0, PortData::from_signals(match_signals));
        outputs.insert(1, PortData::from_signals(other_signals));
        outputs
    }

    fn node_type(&self) -> &'static str {
        "filter-signal-value"
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DBC Decode Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Decode CAN frames to signals using FastDbc (O(1) lookup, zero-allocation)
pub struct DecodeExecutor {
    /// Blacklist of CAN IDs that have no matching message in DBC
    blacklist: std::collections::HashSet<u32>,
}

impl DecodeExecutor {
    pub fn new() -> Self {
        Self {
            blacklist: std::collections::HashSet::new(),
        }
    }
}

impl Default for DecodeExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeExecutor for DecodeExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        let mut signals = Vec::new();

        // Need FastDbc to decode
        let Some(fast_dbc) = ctx.fast_dbc else {
            log::warn!("DecodeExecutor: No DBC loaded");
            let mut outputs = HashMap::new();
            outputs.insert(0, PortData::from_signals(signals));
            return outputs;
        };

        let empty_frames = Vec::new();
        let frames = inputs.first().map(|p| &p.frames).unwrap_or(&empty_frames);

        // Pre-allocate signals capacity for batch processing
        signals.reserve(frames.len() * 8); // Estimate ~8 signals per message

        for frame in frames {
            // Skip blacklisted CAN IDs (no match in DBC)
            if self.blacklist.contains(&frame.can_id) {
                continue;
            }

            // O(1) message lookup via FastDbc
            let msg = if frame.is_extended {
                fast_dbc.get_extended(frame.can_id)
            } else {
                fast_dbc.get(frame.can_id)
            };

            let Some(message) = msg else {
                // Blacklist this CAN ID - no matching message
                self.blacklist.insert(frame.can_id);
                continue;
            };

            // Zero-allocation decode into pre-allocated buffer
            let count = message.decode_into(&frame.data, ctx.decode_buffer);
            if count == 0 {
                continue;
            }

            let msg_name = message.name();
            let msg_signals = message.signals();

            for (i, signal) in msg_signals.iter().enumerate().take(count) {
                signals.push(DecodedSignal {
                    message_name: msg_name.to_string(),
                    signal_name: signal.name().to_string(),
                    value: ctx.decode_buffer[i],
                    unit: signal.unit().unwrap_or("").to_string(),
                    timestamp: frame.timestamp,
                    can_id: frame.can_id,
                });
            }
        }

        let mut outputs = HashMap::new();
        outputs.insert(0, PortData::from_signals(signals));
        outputs
    }

    fn node_type(&self) -> &'static str {
        "decode"
    }

    fn reset(&mut self) {
        self.blacklist.clear();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DBC Encode Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Encode signals to CAN frames using FastDbc (O(1) lookup)
pub struct EncodeExecutor {
    /// Blacklist of CAN IDs that have no matching message in DBC
    blacklist: std::collections::HashSet<u32>,
}

impl EncodeExecutor {
    pub fn new() -> Self {
        Self {
            blacklist: std::collections::HashSet::new(),
        }
    }
}

impl Default for EncodeExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeExecutor for EncodeExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        let mut frames = Vec::new();

        // Need FastDbc to encode
        let Some(fast_dbc) = ctx.fast_dbc else {
            log::warn!("EncodeExecutor: No DBC loaded");
            let mut outputs = HashMap::new();
            outputs.insert(0, PortData::from_frames(frames));
            return outputs;
        };

        let empty_signals = Vec::new();
        let signals = inputs.first().map(|p| &p.signals).unwrap_or(&empty_signals);

        // Group signals by CAN ID for batch encoding
        let mut signal_groups: HashMap<u32, Vec<&DecodedSignal>> = HashMap::new();
        for signal in signals {
            if !self.blacklist.contains(&signal.can_id) {
                signal_groups.entry(signal.can_id).or_default().push(signal);
            }
        }

        // Pre-allocate frames capacity
        frames.reserve(signal_groups.len());

        // Encode each message using O(1) lookup
        for (can_id, msg_signals) in signal_groups {
            // O(1) message lookup via FastDbc
            let is_extended = msg_signals
                .first()
                .map(|s| s.can_id > 0x7FF)
                .unwrap_or(false);
            let msg = if is_extended {
                fast_dbc.get_extended(can_id)
            } else {
                fast_dbc.get(can_id)
            };

            let Some(message) = msg else {
                // Blacklist this CAN ID - no matching message
                self.blacklist.insert(can_id);
                continue;
            };

            let msg_dlc = message.dlc() as usize;
            let mut data = vec![0u8; msg_dlc];

            for decoded in &msg_signals {
                // Find signal by name and encode
                if let Some(signal) = message.signals().find(&decoded.signal_name) {
                    // encode_to may fail if value out of range, ignore errors
                    let _ = signal.encode_to(decoded.value, &mut data);
                }
            }

            // Use timestamp from first signal
            let timestamp = msg_signals.first().map(|s| s.timestamp).unwrap_or(0.0);

            frames.push(CanFrameDto {
                can_id,
                data,
                timestamp,
                is_extended,
                is_fd: false,
                brs: false,
                esi: false,
                dlc: msg_dlc as u8,
                channel: String::new(),
            });
        }

        let mut outputs = HashMap::new();
        outputs.insert(0, PortData::from_frames(frames));
        outputs
    }

    fn node_type(&self) -> &'static str {
        "encode"
    }

    fn reset(&mut self) {
        self.blacklist.clear();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Compare value against threshold
#[derive(Default)]
pub struct ThresholdExecutor;

impl ThresholdExecutor {
    pub fn new() -> Self {
        Self
    }
}

impl NodeExecutor for ThresholdExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        let field = ctx
            .config
            .get("field")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let operator = ctx
            .config
            .get("operator")
            .and_then(|v| v.as_str())
            .unwrap_or(">");
        let threshold = ctx
            .config
            .get("value")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let input = inputs.first().cloned().unwrap_or_default();

        // Get the value to compare
        let value = if let Some(v) = input.value {
            v
        } else if !input.signals.is_empty() {
            // Look for signal by name, or use first signal value
            if field.is_empty() {
                input.signals.first().map(|s| s.value).unwrap_or(0.0)
            } else {
                input
                    .signals
                    .iter()
                    .find(|s| s.signal_name.eq_ignore_ascii_case(field))
                    .map(|s| s.value)
                    .unwrap_or(0.0)
            }
        } else {
            0.0
        };

        let above = match operator {
            ">" => value > threshold,
            "<" => value < threshold,
            ">=" => value >= threshold,
            "<=" => value <= threshold,
            "==" => (value - threshold).abs() < f64::EPSILON,
            "!=" => (value - threshold).abs() >= f64::EPSILON,
            _ => false,
        };

        let mut outputs = HashMap::new();

        // Output 0 = above, Output 1 = below
        if above {
            outputs.insert(0, PortData::trigger());
            outputs.insert(1, PortData::default());
        } else {
            outputs.insert(0, PortData::default());
            outputs.insert(1, PortData::trigger());
        }

        outputs
    }

    fn node_type(&self) -> &'static str {
        "threshold"
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter Executor
// ─────────────────────────────────────────────────────────────────────────────

/// Count triggers
pub struct CounterExecutor {
    count: i64,
    last_reset: std::time::Instant,
}

impl CounterExecutor {
    pub fn new() -> Self {
        Self {
            count: 0,
            last_reset: std::time::Instant::now(),
        }
    }
}

impl Default for CounterExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeExecutor for CounterExecutor {
    fn execute(&mut self, inputs: &[PortData], ctx: &mut ExecutionContext) -> NodeOutputs {
        let reset_interval = ctx
            .config
            .get("resetInterval")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        // Reset if interval has elapsed
        if reset_interval > 0.0 {
            let elapsed = self.last_reset.elapsed().as_secs_f64();
            if elapsed >= reset_interval {
                self.count = 0;
                self.last_reset = std::time::Instant::now();
            }
        }

        // Count triggers
        let input = inputs.first().cloned().unwrap_or_default();
        if input.triggered {
            self.count += 1;
        }
        // Also count frames as triggers
        self.count += input.frames.len() as i64;

        let output = PortData {
            count: Some(self.count),
            value: Some(self.count as f64),
            ..Default::default()
        };

        let mut outputs = HashMap::new();
        outputs.insert(0, output);
        outputs
    }

    fn node_type(&self) -> &'static str {
        "counter"
    }

    fn reset(&mut self) {
        self.count = 0;
        self.last_reset = std::time::Instant::now();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Executor Factory
// ─────────────────────────────────────────────────────────────────────────────

/// Create an executor for a given node type
pub fn create_executor(node_type: &str) -> Option<Box<dyn NodeExecutor>> {
    match node_type {
        "filter-id" => Some(Box::new(FilterIdExecutor::new())),
        "filter-data" => Some(Box::new(FilterDataExecutor::new())),
        "filter-signal-name" => Some(Box::new(FilterSignalNameExecutor::new())),
        "filter-signal-value" => Some(Box::new(FilterSignalValueExecutor::new())),
        "decode" => Some(Box::new(DecodeExecutor::new())),
        "encode" => Some(Box::new(EncodeExecutor::new())),
        "threshold" => Some(Box::new(ThresholdExecutor::new())),
        "counter" => Some(Box::new(CounterExecutor::new())),
        // CAN and MDF4 are handled specially by the runtime
        "can" | "mdf4" => None,
        // Script uses workflow_script_engine
        "script" => None,
        _ => {
            log::warn!("Unknown node type: {}", node_type);
            None
        }
    }
}
