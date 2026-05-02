//! MDF4 file loading, parsing, and export commands.

pub use crate::agent::ops::parse_can_dataframe;
use crate::agent::ops::{export_can_frames_to_mdf4_path, load_mdf4 as load_mdf4_inner};
use crate::dto::{CanFrameDto, DecodedSignalDto};
use crate::state::AppState;
use std::sync::Arc;
use tauri::State;

/// Load an MDF4 file and extract CAN frames.
///
/// Supports the ASAM MDF4 Bus Logging format with CAN_DataFrame channel.
/// Uses FastDbc for O(1) message lookup and zero-allocation decoding.
#[tauri::command]
pub async fn load_mdf4(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(Vec<CanFrameDto>, Vec<DecodedSignalDto>), String> {
    load_mdf4_inner(&state, &path)
}

/// Export CAN frames to an MDF4 file.
///
/// Takes a list of frames and writes them to the specified path as an MDF4 file
/// using the ASAM MDF4 Bus Logging CAN_DataFrame format.
#[tauri::command]
pub async fn export_logs(path: String, frames: Vec<CanFrameDto>) -> Result<usize, String> {
    export_can_frames_to_mdf4_path(&path, &frames)
}
