//! Simulator Module - CAN traffic generation and scripting.

pub mod commands;
pub mod engine;
pub mod state;
pub mod types;

// Re-exports for main / Tauri discovery
pub use commands::*;
