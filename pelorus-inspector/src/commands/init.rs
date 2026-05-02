//! Initialization commands.

use crate::state::AppState;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

/// Initial files response for frontend.
#[derive(Serialize)]
pub struct InitialFilesResponse {
    pub dbc_path: Option<String>,
    pub mdf4_path: Option<String>,
}

/// Get initial files specified via command line arguments.
/// Falls back to saved session if no CLI argument provided.
#[tauri::command]
pub async fn get_initial_files(
    state: State<'_, Arc<AppState>>,
) -> Result<InitialFilesResponse, String> {
    let files = state.initial_files.lock();
    let session = state.session.lock();

    // CLI args take priority, fall back to saved session
    let dbc_path = files.dbc_path.clone().or_else(|| session.dbc_path.clone());
    let mdf4_path = files
        .mdf4_path
        .clone()
        .or_else(|| session.mdf4_path.clone());

    Ok(InitialFilesResponse {
        dbc_path,
        mdf4_path,
    })
}
