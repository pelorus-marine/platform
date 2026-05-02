//! Pelorus Inspector — Tauri app for MDF4 replay, SocketCAN capture, DBC decoding.
//!
//! Supports:
//! - Live capture from SocketCAN interfaces (Linux)
//! - MDF4 recordings
//! - DBC-based signal decoding

#![forbid(unsafe_code)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::Parser;
use pelorus_inspector::{AppState, InitialFiles, base_commands};
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
}

fn main() {
    let app_state = create_app_state();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(base_commands!())
        // Pro: add .setup(pro::setup) here
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Create the application state from CLI args.
fn create_app_state() -> Arc<AppState> {
    let args = Args::parse();
    let initial_files = InitialFiles {
        dbc_path: args.dbc,
        mdf4_path: args.mdf4,
    };
    Arc::new(AppState::with_initial_files(initial_files))
}
