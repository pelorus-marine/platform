//! Tauri command handlers.
//!
//! Each submodule contains related commands grouped by functionality.
//!
//! # Extension Point
//!
//! Pro versions can add commands by:
//! 1. Creating a `pro/` module with additional commands
//! 2. Using the `all_commands!` macro with additional handlers

mod capture;
mod dbc;
pub mod filter;
mod init;
pub mod mdf;

pub use capture::*;
pub use dbc::*;
pub use filter::*;
pub use init::*;
pub use mdf::*;

/// Generate the base command handler.
///
/// This macro makes it easy for pro versions to extend with additional commands:
///
/// ```ignore
/// // In pro/mod.rs:
/// pub fn invoke_handler() -> impl Fn(tauri::ipc::Invoke) -> bool {
///     tauri::generate_handler![
///         // Base commands
///         commands::load_dbc,
///         commands::clear_dbc,
///         // ... all base commands ...
///         // Pro commands
///         pro::commands::sync_to_cloud,
///         pro::commands::run_script,
///     ]
/// }
/// ```
#[macro_export]
macro_rules! base_commands {
    () => {
        tauri::generate_handler![
            pelorus_inspector::commands::load_dbc,
            pelorus_inspector::commands::clear_dbc,
            pelorus_inspector::commands::get_dbc_path,
            pelorus_inspector::commands::save_dbc_content,
            pelorus_inspector::commands::update_dbc_content,
            pelorus_inspector::commands::decode_single_frame,
            pelorus_inspector::commands::decode_frames,
            pelorus_inspector::commands::get_dbc_info,
            pelorus_inspector::commands::get_dbc_specification,
            pelorus_inspector::commands::load_mdf4,
            pelorus_inspector::commands::export_logs,
            pelorus_inspector::commands::list_can_interfaces,
            pelorus_inspector::commands::start_capture,
            pelorus_inspector::commands::stop_capture,
            pelorus_inspector::commands::is_capture_running,
            pelorus_inspector::commands::get_initial_files,
            // Frame filter commands (all computation in Rust)
            pelorus_inspector::commands::filter_frames,
            pelorus_inspector::commands::calculate_frame_stats,
            pelorus_inspector::commands::get_message_counts,
            pelorus_inspector::commands::detect_dlc,
        ]
    };
    // Extended version: base + additional commands
    ($($extra:path),+ $(,)?) => {
        tauri::generate_handler![
            pelorus_inspector::commands::load_dbc,
            pelorus_inspector::commands::clear_dbc,
            pelorus_inspector::commands::get_dbc_path,
            pelorus_inspector::commands::save_dbc_content,
            pelorus_inspector::commands::update_dbc_content,
            pelorus_inspector::commands::decode_single_frame,
            pelorus_inspector::commands::decode_frames,
            pelorus_inspector::commands::get_dbc_info,
            pelorus_inspector::commands::get_dbc_specification,
            pelorus_inspector::commands::load_mdf4,
            pelorus_inspector::commands::export_logs,
            pelorus_inspector::commands::list_can_interfaces,
            pelorus_inspector::commands::start_capture,
            pelorus_inspector::commands::stop_capture,
            pelorus_inspector::commands::is_capture_running,
            pelorus_inspector::commands::get_initial_files,
            // Frame filter commands (all computation in Rust)
            pelorus_inspector::commands::filter_frames,
            pelorus_inspector::commands::calculate_frame_stats,
            pelorus_inspector::commands::get_message_counts,
            pelorus_inspector::commands::detect_dlc,
            $($extra),+
        ]
    };
}
