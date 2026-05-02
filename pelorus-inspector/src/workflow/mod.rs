//! Workflow Module - Visual workflow editor for CAN data processing pipelines.

pub mod commands;
pub mod executors;
pub mod runtime;
pub mod script_engine;
pub mod state;
pub mod types;

// Re-exports for external use
pub use commands::*;
pub use state::WorkflowState;
