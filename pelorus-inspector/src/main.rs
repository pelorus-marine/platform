//! Pelorus Inspector — Tauri app for MDF4 replay, SocketCAN capture, DBC decoding.
//!
//! Supports:
//! - Live capture from SocketCAN interfaces (Linux)
//! - MDF4 recordings
//! - DBC-based signal decoding
//! - Lab tools: CAN interface setup, Rhai simulator, workflow DAG, SQLite artifact stash, frame analysis

#![forbid(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::Parser;
use pelorus_inspector::{
    AppState, InitialFiles, SimulatorState, WorkflowState, base_commands, storage::StorageState,
};
use std::path::PathBuf;
use std::sync::Arc;

/// Pelorus Inspector with MDF4 and SocketCAN support.
#[derive(Parser, Debug)]
#[command(author, version, about)]
struct Args {
    /// DBC file to load on startup
    #[arg(short, long)]
    dbc: Option<String>,

    /// MDF4 file to load on startup
    #[arg(short, long)]
    mdf4: Option<String>,

    /// VSS (.vspec) catalog to load on startup
    #[arg(long)]
    vss: Option<String>,
}

fn app_data_directory() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pelorus-inspector")
}

fn main() {
    let app_state = create_app_state();
    let simulator_state = Arc::new(SimulatorState::default());
    let workflow_state = Arc::new(WorkflowState::default());
    let storage_state = Arc::new(
        StorageState::new(app_data_directory()).expect("failed to open Pelorus Inspector storage"),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .manage(simulator_state)
        .manage(workflow_state)
        .manage(storage_state)
        .invoke_handler(base_commands!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Create the application state from CLI args.
fn create_app_state() -> Arc<AppState> {
    let args = Args::parse();
    let initial_files = InitialFiles {
        dbc_path: args.dbc,
        mdf4_path: args.mdf4,
        vss_path: args.vss,
    };
    Arc::new(AppState::with_initial_files(initial_files))
}
