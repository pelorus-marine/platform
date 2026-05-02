//! Simulator Types
//!
//! Data structures for traffic simulator configuration and status.

use serde::{Deserialize, Serialize};

/// Simulator configuration for traffic generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulatorConfig {
    pub interface: String,
    pub rate_mbps: f64,
}

impl Default for SimulatorConfig {
    fn default() -> Self {
        Self {
            interface: "vcan0".to_string(),
            rate_mbps: 0.5,
        }
    }
}

/// Runtime statistics for the simulator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulatorStats {
    pub running: bool,
    pub frames_sent: u64,
    pub elapsed_secs: f64,
    pub actual_rate_mbps: f64,
    pub frames_per_sec: f64,
    pub target_rate_mbps: f64,
}

/// Information about a CAN interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterfaceInfo {
    pub name: String,
    pub available: bool,
}

/// Signal info for frontend display.
#[derive(Debug, Clone, Serialize)]
pub struct SignalInfo {
    pub name: String,
    pub message_name: String,
    pub message_id: u32,
    pub start_bit: u16,
    pub length: u8,
    pub factor: f64,
    pub offset: f64,
    pub min: f64,
    pub max: f64,
    pub unit: String,
}

/// Message info for frontend display.
#[derive(Debug, Clone, Serialize)]
pub struct MessageInfo {
    pub name: String,
    pub id: u32,
    pub dlc: u8,
    pub signal_count: usize,
}
