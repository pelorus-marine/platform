//! Workflow Types
//!
//! Data structures for workflow definitions and status.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─────────────────────────────────────────────────────────────────────────────
// DTOs - Match frontend types.ts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
    pub config: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowConnection {
    pub id: String,
    #[serde(rename = "fromNode")]
    pub from_node: String,
    #[serde(rename = "fromOutput")]
    pub from_output: usize,
    #[serde(rename = "toNode")]
    pub to_node: String,
    #[serde(rename = "toInput")]
    pub to_input: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub nodes: Vec<WorkflowNode>,
    pub connections: Vec<WorkflowConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStatus {
    pub running: bool,
    pub frames_processed: u64,
    pub frames_written: u64,
    pub errors: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Payloads - Sent to frontend via Tauri events
// ─────────────────────────────────────────────────────────────────────────────

/// Log message event payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogPayload {
    pub message: String,
    pub level: String,
    pub node_id: Option<String>,
}

/// Status update event payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStatusPayload {
    pub running: bool,
    pub frames_processed: u64,
    pub frames_written: u64,
    pub current_node: Option<String>,
}

/// Error event payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowErrorPayload {
    pub message: String,
    pub node_id: Option<String>,
    pub fatal: bool,
}

/// Node execution event payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeExecutedPayload {
    pub node_id: String,
    pub frames_in: u64,
    pub frames_out: u64,
}
