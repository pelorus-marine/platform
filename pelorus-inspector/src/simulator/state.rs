//! Simulator State
//!
//! Runtime state management for the traffic simulator.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Instant;
use tokio::sync::Mutex;

use super::types::SimulatorConfig;

/// Simulator state shared between commands.
pub struct SimulatorState {
    pub running: AtomicBool,
    pub frames_sent: AtomicU64,
    pub rate_mbps: AtomicU64, // Stored as bits (rate * 1000)
    pub start_time: Mutex<Option<Instant>>,
    pub config: Mutex<SimulatorConfig>,
    pub script: Mutex<Option<String>>,
    pub script_logs: Mutex<Vec<String>>,
}

impl Default for SimulatorState {
    fn default() -> Self {
        Self {
            running: AtomicBool::new(false),
            frames_sent: AtomicU64::new(0),
            rate_mbps: AtomicU64::new(500), // 0.5 Mbit/s * 1000
            start_time: Mutex::new(None),
            config: Mutex::new(SimulatorConfig::default()),
            script: Mutex::new(None),
            script_logs: Mutex::new(Vec::new()),
        }
    }
}

impl SimulatorState {
    pub fn get_rate(&self) -> f64 {
        self.rate_mbps.load(Ordering::SeqCst) as f64 / 1000.0
    }

    pub fn set_rate(&self, rate: f64) {
        let rate = rate.clamp(0.01, 8.0);
        self.rate_mbps
            .store((rate * 1000.0) as u64, Ordering::SeqCst);
    }
}
