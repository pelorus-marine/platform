//! Application state management.

use crate::config::SessionConfig;
use dbc_rs::{Dbc, FastDbc};
use parking_lot::Mutex;

#[cfg(target_os = "linux")]
use tokio::sync::oneshot;

/// Initial file paths from command line arguments.
#[derive(Default)]
pub struct InitialFiles {
    pub dbc_path: Option<String>,
    pub mdf4_path: Option<String>,
}

/// Type alias for the stop channel sender.
/// Sends a result channel that will receive the finalized file path.
#[cfg(target_os = "linux")]
pub type CaptureStopTx = oneshot::Sender<oneshot::Sender<Result<String, String>>>;

/// Global application state shared across Tauri commands.
pub struct AppState {
    /// Loaded DBC database for signal decoding.
    pub dbc: Mutex<Option<Dbc>>,

    /// High-performance DBC wrapper with O(1) message lookup.
    /// Created alongside dbc for fast decoding in hot paths.
    pub fast_dbc: Mutex<Option<FastDbc>>,

    /// Path to the currently loaded DBC file.
    pub dbc_path: Mutex<Option<String>>,

    /// Initial files from command line.
    pub initial_files: Mutex<InitialFiles>,

    /// Session configuration for persistence.
    pub session: Mutex<SessionConfig>,

    /// Whether a SocketCAN capture is currently running.
    #[cfg(target_os = "linux")]
    pub capture_running: Mutex<bool>,

    /// Channel to signal capture to stop and receive result.
    #[cfg(target_os = "linux")]
    pub capture_stop_tx: Mutex<Option<CaptureStopTx>>,
}

impl AppState {
    pub fn with_initial_files(initial_files: InitialFiles) -> Self {
        let session = SessionConfig::load();
        Self {
            dbc: Mutex::new(None),
            fast_dbc: Mutex::new(None),
            dbc_path: Mutex::new(None),
            initial_files: Mutex::new(initial_files),
            session: Mutex::new(session),
            #[cfg(target_os = "linux")]
            capture_running: Mutex::new(false),
            #[cfg(target_os = "linux")]
            capture_stop_tx: Mutex::new(None),
        }
    }

    /// Set the DBC database and create the corresponding FastDbc wrapper.
    /// This ensures both are always updated atomically.
    pub fn set_dbc(&self, dbc: Dbc) {
        let fast_dbc = FastDbc::new(dbc.clone());
        *self.dbc.lock() = Some(dbc);
        *self.fast_dbc.lock() = Some(fast_dbc);
    }

    /// Clear the DBC database and FastDbc wrapper.
    pub fn clear_dbc(&self) {
        *self.dbc.lock() = None;
        *self.fast_dbc.lock() = None;
    }
}

impl Default for AppState {
    fn default() -> Self {
        let session = SessionConfig::load();
        Self {
            dbc: Mutex::new(None),
            fast_dbc: Mutex::new(None),
            dbc_path: Mutex::new(None),
            initial_files: Mutex::new(InitialFiles::default()),
            session: Mutex::new(session),
            #[cfg(target_os = "linux")]
            capture_running: Mutex::new(false),
            #[cfg(target_os = "linux")]
            capture_stop_tx: Mutex::new(None),
        }
    }
}
