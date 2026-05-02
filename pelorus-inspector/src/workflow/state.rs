//! Workflow State
//!
//! Runtime state management and event emission for workflow execution.

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};

use super::types::{
    Workflow, WorkflowErrorPayload, WorkflowLogPayload, WorkflowNodeExecutedPayload,
    WorkflowStatus, WorkflowStatusPayload,
};

// ─────────────────────────────────────────────────────────────────────────────
// Event Emission Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Emit a workflow log message to the frontend
pub fn emit_log(app: &AppHandle, message: &str, level: &str, node_id: Option<&str>) {
    let payload = WorkflowLogPayload {
        message: message.to_string(),
        level: level.to_string(),
        node_id: node_id.map(|s| s.to_string()),
    };
    let _ = app.emit("workflow:runtime-log", &payload);
}

/// Emit workflow status update to the frontend
pub fn emit_status(
    app: &AppHandle,
    running: bool,
    processed: u64,
    written: u64,
    current_node: Option<&str>,
) {
    let payload = WorkflowStatusPayload {
        running,
        frames_processed: processed,
        frames_written: written,
        current_node: current_node.map(|s| s.to_string()),
    };
    let _ = app.emit("workflow:runtime-status", &payload);
}

/// Emit workflow error to the frontend
pub fn emit_error(app: &AppHandle, message: &str, node_id: Option<&str>, fatal: bool) {
    let payload = WorkflowErrorPayload {
        message: message.to_string(),
        node_id: node_id.map(|s| s.to_string()),
        fatal,
    };
    let _ = app.emit("workflow:runtime-error", &payload);
}

/// Emit node execution stats to the frontend
#[allow(dead_code)]
pub fn emit_node_executed(app: &AppHandle, node_id: &str, frames_in: u64, frames_out: u64) {
    let payload = WorkflowNodeExecutedPayload {
        node_id: node_id.to_string(),
        frames_in,
        frames_out,
    };
    let _ = app.emit("workflow:node-executed", &payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow State
// ─────────────────────────────────────────────────────────────────────────────

pub struct WorkflowState {
    pub(super) running: Mutex<bool>,
    pub(super) workflow: Mutex<Option<Workflow>>,
    pub(super) stats: Mutex<WorkflowStatus>,
    pub(super) stop_flag: Mutex<bool>,
}

impl Default for WorkflowState {
    fn default() -> Self {
        Self {
            running: Mutex::new(false),
            workflow: Mutex::new(None),
            stats: Mutex::new(WorkflowStatus {
                running: false,
                frames_processed: 0,
                frames_written: 0,
                errors: vec![],
            }),
            stop_flag: Mutex::new(false),
        }
    }
}
