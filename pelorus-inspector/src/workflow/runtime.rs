//! Workflow DAG Runtime Engine
//!
//! Executes workflow graphs as a DAG (Directed Acyclic Graph), routing data
//! between nodes according to connections. All execution happens in Rust,
//! with only events sent to the TypeScript frontend.

use std::collections::HashMap;

use super::executors::{ExecutionContext, NodeExecutor, NodeOutputs, PortData, create_executor};
use super::types::{Workflow, WorkflowNode};
use crate::dto::CanFrameDto;
use dbc_rs::FastDbc;
use tauri::AppHandle;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime State
// ─────────────────────────────────────────────────────────────────────────────

/// The workflow runtime engine
pub struct WorkflowRuntime {
    /// Workflow definition
    workflow: Workflow,
    /// Executors for each node (by node ID)
    executors: HashMap<String, Box<dyn NodeExecutor>>,
    /// Topological execution order (node IDs)
    execution_order: Vec<String>,
    /// Connections grouped by source node
    #[allow(dead_code)]
    connections_from: HashMap<String, Vec<ConnectionInfo>>,
    /// FastDbc for O(1) message lookup during decode/encode
    fast_dbc: Option<FastDbc>,
    /// Pre-allocated decode buffer (sized for max signals in any message)
    decode_buffer: Vec<f64>,
    /// App handle for event emission
    app: AppHandle,
    /// Statistics
    frames_processed: u64,
    frames_written: u64,
}

/// Connection info for routing data
#[allow(dead_code)]
struct ConnectionInfo {
    from_output: usize,
    to_node: String,
    to_input: usize,
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Payloads
// ─────────────────────────────────────────────────────────────────────────────

use super::state::emit_error;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Implementation
// ─────────────────────────────────────────────────────────────────────────────

impl WorkflowRuntime {
    /// Create a new workflow runtime
    pub fn new(workflow: Workflow, app: AppHandle) -> Result<Self, String> {
        // Validate workflow
        if workflow.nodes.is_empty() {
            return Err("Workflow has no nodes".to_string());
        }

        // Build execution order (topological sort)
        let execution_order = topological_sort(&workflow)?;

        // Create executors for each node
        let mut executors: HashMap<String, Box<dyn NodeExecutor>> = HashMap::new();
        for node in &workflow.nodes {
            if let Some(executor) = create_executor(&node.node_type) {
                executors.insert(node.id.clone(), executor);
            }
            // CAN/MDF4/Script nodes don't have standard executors
            // They're handled specially by the runtime
        }

        // Group connections by source node
        let mut connections_from: HashMap<String, Vec<ConnectionInfo>> = HashMap::new();
        for conn in &workflow.connections {
            connections_from
                .entry(conn.from_node.clone())
                .or_default()
                .push(ConnectionInfo {
                    from_output: conn.from_output,
                    to_node: conn.to_node.clone(),
                    to_input: conn.to_input,
                });
        }

        Ok(Self {
            workflow,
            executors,
            execution_order,
            connections_from,
            fast_dbc: None,
            decode_buffer: Vec::new(),
            app,
            frames_processed: 0,
            frames_written: 0,
        })
    }

    /// Set DBC database for decode/encode operations
    /// Creates FastDbc for O(1) message lookup and pre-allocates decode buffer
    #[allow(dead_code)]
    pub fn set_dbc(&mut self, dbc: dbc_rs::Dbc) {
        let fast_dbc = FastDbc::new(dbc);
        // Pre-allocate decode buffer sized for max signals in any message
        self.decode_buffer = vec![0.0f64; fast_dbc.max_signals()];
        self.fast_dbc = Some(fast_dbc);
    }

    /// Execute the workflow graph with input frames
    pub fn execute(&mut self, input_frames: Vec<CanFrameDto>) -> Vec<CanFrameDto> {
        // Map of node outputs: node_id -> (output_port -> PortData)
        let mut node_outputs: HashMap<String, NodeOutputs> = HashMap::new();

        // Seed input nodes with frames
        for node in &self.workflow.nodes {
            if node.node_type == "can" || node.node_type == "mdf4" {
                // Input nodes get the input frames
                let mut outputs = HashMap::new();
                outputs.insert(0, PortData::from_frames(input_frames.clone()));
                node_outputs.insert(node.id.clone(), outputs);
            }
        }

        // Execute nodes in topological order
        let execution_order = self.execution_order.clone();
        let workflow_nodes = self.workflow.nodes.clone(); // Clone to avoid borrow issues

        for node_id in &execution_order {
            let Some(node) = workflow_nodes.iter().find(|n| &n.id == node_id) else {
                continue;
            };

            // Skip I/O nodes (they're handled specially)
            if node.node_type == "can" || node.node_type == "mdf4" {
                continue;
            }

            // Gather inputs from connected nodes
            let inputs = self.gather_inputs(node_id, &node_outputs);

            // Execute the node
            if let Some(executor) = self.executors.get_mut(node_id) {
                // Count processed frames before execution
                for input in &inputs {
                    self.frames_processed += input.frames.len() as u64;
                }

                let outputs = {
                    let mut ctx = ExecutionContext {
                        config: &node.config,
                        fast_dbc: self.fast_dbc.as_ref(),
                        decode_buffer: &mut self.decode_buffer,
                    };
                    executor.execute(&inputs, &mut ctx)
                };

                node_outputs.insert(node_id.clone(), outputs);
            } else if node.node_type == "script" {
                // Handle script nodes using workflow_script_engine
                let outputs = self.execute_script_node(node, &inputs);
                node_outputs.insert(node_id.clone(), outputs);
            }
        }

        // Collect output frames from sink nodes
        let mut output_frames = Vec::new();
        for node in &self.workflow.nodes {
            // Sink nodes: MDF4 or CAN without outgoing connections
            if node.node_type == "mdf4" || node.node_type == "can" {
                // Check if this node has incoming connections (it's a sink)
                let has_incoming = self
                    .workflow
                    .connections
                    .iter()
                    .any(|c| c.to_node == node.id);
                if has_incoming {
                    // Get frames that were routed to this node
                    let inputs = self.gather_inputs(&node.id, &node_outputs);
                    for input in inputs {
                        output_frames.extend(input.frames);
                    }
                }
            }
        }

        self.frames_written += output_frames.len() as u64;
        output_frames
    }

    /// Gather inputs for a node from connected sources
    fn gather_inputs(
        &self,
        node_id: &str,
        node_outputs: &HashMap<String, NodeOutputs>,
    ) -> Vec<PortData> {
        let mut inputs = Vec::new();

        // Find connections TO this node
        for conn in &self.workflow.connections {
            if conn.to_node == node_id {
                if let Some(source_outputs) = node_outputs.get(&conn.from_node) {
                    if let Some(port_data) = source_outputs.get(&conn.from_output) {
                        // Ensure we have enough input slots
                        while inputs.len() <= conn.to_input {
                            inputs.push(PortData::default());
                        }
                        // Merge data into the input slot
                        let slot = &mut inputs[conn.to_input];
                        slot.frames.extend(port_data.frames.clone());
                        slot.signals.extend(port_data.signals.clone());
                        if port_data.value.is_some() {
                            slot.value = port_data.value;
                        }
                        if port_data.count.is_some() {
                            slot.count = port_data.count;
                        }
                        if port_data.triggered {
                            slot.triggered = true;
                        }
                    }
                }
            }
        }

        inputs
    }

    /// Execute a script node using the Rhai engine
    fn execute_script_node(&mut self, node: &WorkflowNode, inputs: &[PortData]) -> NodeOutputs {
        use super::script_engine as workflow_script_engine;

        let script = node
            .config
            .get("script")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let frames: Vec<CanFrameDto> = inputs.iter().flat_map(|p| p.frames.clone()).collect();

        // Execute script
        let result = workflow_script_engine::execute_workflow_script(script, frames);

        let mut outputs = HashMap::new();
        match result {
            Ok(output_frames) => {
                outputs.insert(0, PortData::from_frames(output_frames));
            }
            Err(e) => {
                emit_error(
                    &self.app,
                    &format!("Script error: {}", e),
                    Some(&node.id),
                    false,
                );
                outputs.insert(0, PortData::default());
            }
        }
        outputs
    }

    /// Get current statistics
    pub fn stats(&self) -> (u64, u64) {
        (self.frames_processed, self.frames_written)
    }

    /// Reset statistics
    pub fn reset_stats(&mut self) {
        self.frames_processed = 0;
        self.frames_written = 0;
    }

    /// Reset all executor states
    #[allow(dead_code)]
    pub fn reset(&mut self) {
        for executor in self.executors.values_mut() {
            executor.reset();
        }
        self.reset_stats();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Topological Sort
// ─────────────────────────────────────────────────────────────────────────────

/// Perform topological sort on workflow nodes
fn topological_sort(workflow: &Workflow) -> Result<Vec<String>, String> {
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();

    // Initialize
    for node in &workflow.nodes {
        in_degree.insert(&node.id, 0);
        adj.insert(&node.id, Vec::new());
    }

    // Build adjacency list and in-degrees
    for conn in &workflow.connections {
        if let Some(v) = adj.get_mut(conn.from_node.as_str()) {
            v.push(&conn.to_node);
        }
        *in_degree.get_mut(conn.to_node.as_str()).unwrap_or(&mut 0) += 1;
    }

    // Find nodes with no incoming edges (sources)
    let mut queue: Vec<&str> = in_degree
        .iter()
        .filter(|(_, deg)| **deg == 0)
        .map(|(id, _)| *id)
        .collect();

    let mut result = Vec::new();

    while let Some(node_id) = queue.pop() {
        result.push(node_id.to_string());

        if let Some(neighbors) = adj.get(node_id) {
            for &neighbor in neighbors {
                if let Some(deg) = in_degree.get_mut(neighbor) {
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push(neighbor);
                    }
                }
            }
        }
    }

    // Check for cycles
    if result.len() != workflow.nodes.len() {
        return Err("Workflow contains a cycle".to_string());
    }

    Ok(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workflow::types::WorkflowConnection;

    fn make_workflow(nodes: Vec<WorkflowNode>, connections: Vec<WorkflowConnection>) -> Workflow {
        Workflow {
            id: "test".to_string(),
            name: "Test Workflow".to_string(),
            nodes,
            connections,
        }
    }

    fn make_node(id: &str, node_type: &str) -> WorkflowNode {
        WorkflowNode {
            id: id.to_string(),
            node_type: node_type.to_string(),
            label: id.to_string(),
            x: 0.0,
            y: 0.0,
            inputs: vec![],
            outputs: vec![],
            config: HashMap::new(),
        }
    }

    fn make_connection(from: &str, to: &str) -> WorkflowConnection {
        WorkflowConnection {
            id: format!("{}-{}", from, to),
            from_node: from.to_string(),
            from_output: 0,
            to_node: to.to_string(),
            to_input: 0,
        }
    }

    #[test]
    fn test_topological_sort_simple() {
        let workflow = make_workflow(
            vec![
                make_node("a", "can"),
                make_node("b", "filter-id"),
                make_node("c", "mdf4"),
            ],
            vec![make_connection("a", "b"), make_connection("b", "c")],
        );

        let order = topological_sort(&workflow).unwrap();
        assert_eq!(order.len(), 3);

        // a must come before b, b must come before c
        let a_pos = order.iter().position(|x| x == "a").unwrap();
        let b_pos = order.iter().position(|x| x == "b").unwrap();
        let c_pos = order.iter().position(|x| x == "c").unwrap();
        assert!(a_pos < b_pos);
        assert!(b_pos < c_pos);
    }

    #[test]
    fn test_topological_sort_cycle() {
        let workflow = make_workflow(
            vec![
                make_node("a", "can"),
                make_node("b", "filter-id"),
                make_node("c", "mdf4"),
            ],
            vec![
                make_connection("a", "b"),
                make_connection("b", "c"),
                make_connection("c", "a"), // Creates cycle
            ],
        );

        let result = topological_sort(&workflow);
        assert!(result.is_err());
    }
}
