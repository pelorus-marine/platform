//! Pelorus Inspector library — Tauri command surface and MDF4 / CAN helpers.
#![forbid(unsafe_code)]

pub mod commands;
pub mod config;
pub mod decode;
pub mod dto;
pub mod live_capture;
pub mod state;

// Re-export commonly used types
pub use state::{AppState, InitialFiles};

// Re-export DTO types for use by pro crate
pub use dto::{CanBpfFilter, CanFrameDto, DecodedSignalDto};

// Re-export filter types, utilities, and commands for use by pro crate
pub use commands::filter::{
    DbcMessageCache,
    DbcMessageInfo,
    // Types
    DlcDetectionResult,
    FilterConfig,
    FilterResult,
    FrameStats,
    MatchStatus,
    MessageCount,
    // Shared filter logic for pro crate
    build_message_cache_from_dbc,
    // Commands
    calculate_frame_stats,
    detect_dlc,
    filter_frames_with_cache,
    get_message_counts,
    match_data_pattern,
    parse_data_pattern,
};

// Re-export MDF4 parsing utilities
pub use commands::mdf::parse_can_dataframe;

// Re-export config for session management
pub use config::SessionConfig;
