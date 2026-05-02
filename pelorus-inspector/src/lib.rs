//! Pelorus Inspector library — Tauri command surface and MDF4 / CAN helpers.
#![forbid(unsafe_code)]

pub mod agent;
pub mod analysis;
pub mod can_iface;
pub mod commands;
pub mod config;
pub mod decode;
pub mod dto;
pub mod live_capture;
pub mod simulator;
pub mod state;
pub mod storage;
pub mod vss;
pub mod workflow;

// Re-export commonly used types
pub use state::{AppState, InitialFiles};

// Re-export DTO types for shared components
pub use dto::{CanBpfFilter, CanFrameDto, DecodedSignalDto};

// Re-export filter types, utilities, and commands
pub use commands::filter::{
    DbcMessageCache, DbcMessageInfo, DlcDetectionResult, FilterConfig, FilterResult, FrameStats,
    MatchStatus, MessageCount, build_message_cache_from_dbc, calculate_frame_stats, detect_dlc,
    filter_frames_with_cache, get_message_counts, match_data_pattern, parse_data_pattern,
};

// Re-export MDF4 CAN_DataFrame parsing (also used by workflows).
pub use agent::ops::parse_can_dataframe;

// Re-export config for session management
pub use config::SessionConfig;

pub use simulator::SimulatorState;
pub use workflow::WorkflowState;
