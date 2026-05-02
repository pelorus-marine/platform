//! Rhai-based scripting engine for workflow frame processing
//!
//! Different from simulator engine - focused on processing/transforming frames.

#![allow(dead_code)] // Engine not yet integrated into workflow executor
#![allow(clippy::arc_with_non_send_sync)] // Rhai `Dynamic` state is not `Sync`; `Arc` is shared only with Rhai engine callbacks.

use crate::dto::CanFrameDto;
use rhai::{AST, CallFnOptions, Dynamic, Engine, Scope};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Script validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Frame wrapper for Rhai scripts
#[derive(Debug, Clone)]
pub struct ScriptFrame {
    pub id: i64,
    pub data: Vec<u8>,
    pub dlc: i64,
    pub timestamp: f64,
    pub extended: bool,
    pub channel: String,
}

impl ScriptFrame {
    pub fn from_dto(frame: &CanFrameDto) -> Self {
        Self {
            id: frame.can_id as i64,
            data: frame.data.clone(),
            dlc: frame.dlc as i64,
            timestamp: frame.timestamp,
            extended: frame.is_extended,
            channel: frame.channel.clone(),
        }
    }

    pub fn to_dto(&self) -> CanFrameDto {
        CanFrameDto {
            can_id: self.id as u32,
            data: self.data.clone(),
            timestamp: self.timestamp,
            is_extended: self.extended,
            is_fd: false,
            brs: false,
            esi: false,
            dlc: self.dlc as u8,
            channel: self.channel.clone(),
        }
    }
}

/// Frame to be sent to CAN interface
#[derive(Debug, Clone)]
pub struct SendFrame {
    pub id: u32,
    pub data: Vec<u8>,
    pub extended: bool,
    pub fd: bool,
}

/// Compiled workflow script with its engine
pub struct WorkflowScript {
    engine: Engine,
    ast: AST,
    scope: Scope<'static>,
    /// Frames queued for output to next node
    output_frames: Arc<RwLock<Vec<ScriptFrame>>>,
    /// Frames queued for sending to CAN interface
    send_frames: Arc<RwLock<Vec<SendFrame>>>,
    /// Persistent state across frames
    state: Arc<RwLock<HashMap<String, Dynamic>>>,
    /// Log messages from script
    logs: Arc<RwLock<Vec<String>>>,
}

impl WorkflowScript {
    /// Create a new script engine and compile the script
    pub fn compile(script: &str) -> Result<Self, ValidationResult> {
        let mut engine = Engine::new();

        // Shared state
        let output_frames: Arc<RwLock<Vec<ScriptFrame>>> = Arc::new(RwLock::new(Vec::new()));
        let send_frames: Arc<RwLock<Vec<SendFrame>>> = Arc::new(RwLock::new(Vec::new()));
        let state: Arc<RwLock<HashMap<String, Dynamic>>> = Arc::new(RwLock::new(HashMap::new()));
        let logs: Arc<RwLock<Vec<String>>> = Arc::new(RwLock::new(Vec::new()));

        // Register ScriptFrame type
        engine
            .register_type_with_name::<ScriptFrame>("Frame")
            .register_get("id", |f: &mut ScriptFrame| f.id)
            .register_set("id", |f: &mut ScriptFrame, v: i64| f.id = v)
            .register_get("data", |f: &mut ScriptFrame| f.data.clone())
            .register_set("data", |f: &mut ScriptFrame, v: Vec<Dynamic>| {
                f.data = v
                    .into_iter()
                    .map(|d| d.as_int().unwrap_or(0) as u8)
                    .collect();
            })
            .register_get("dlc", |f: &mut ScriptFrame| f.dlc)
            .register_get("timestamp", |f: &mut ScriptFrame| f.timestamp)
            .register_get("extended", |f: &mut ScriptFrame| f.extended)
            .register_set("extended", |f: &mut ScriptFrame, v: bool| f.extended = v)
            .register_get("channel", |f: &mut ScriptFrame| f.channel.clone())
            .register_fn("get_byte", |f: &mut ScriptFrame, idx: i64| -> i64 {
                f.data.get(idx as usize).map(|&b| b as i64).unwrap_or(0)
            })
            .register_fn("set_byte", |f: &mut ScriptFrame, idx: i64, val: i64| {
                if let Some(b) = f.data.get_mut(idx as usize) {
                    *b = val as u8;
                }
            })
            .register_fn("clone", |f: &mut ScriptFrame| f.clone());

        // Register emit function - outputs a frame
        let frames_clone = Arc::clone(&output_frames);
        engine.register_fn("emit", move |frame: ScriptFrame| {
            frames_clone.write().unwrap().push(frame);
        });

        // Register emit_new function - creates and outputs a new frame
        let frames_clone2 = Arc::clone(&output_frames);
        engine.register_fn("emit_new", move |id: i64, data: Vec<Dynamic>| {
            let data_bytes: Vec<u8> = data
                .into_iter()
                .map(|d| d.as_int().unwrap_or(0) as u8)
                .collect();
            let frame = ScriptFrame {
                id,
                data: data_bytes.clone(),
                dlc: data_bytes.len() as i64,
                timestamp: 0.0,
                extended: false,
                channel: String::new(),
            };
            frames_clone2.write().unwrap().push(frame);
        });

        // Register drop function - just a no-op, frame won't be emitted
        engine.register_fn("drop", || {
            // No-op - if emit isn't called, frame is dropped
        });

        // Register state functions
        let state_clone = Arc::clone(&state);
        engine.register_fn("state_get", move |key: &str| -> Dynamic {
            state_clone
                .read()
                .unwrap()
                .get(key)
                .cloned()
                .unwrap_or(Dynamic::ZERO)
        });

        let state_clone2 = Arc::clone(&state);
        engine.register_fn("state_set", move |key: &str, value: Dynamic| {
            state_clone2.write().unwrap().insert(key.to_string(), value);
        });

        let state_clone3 = Arc::clone(&state);
        engine.register_fn("state_inc", move |key: &str| -> i64 {
            let mut st = state_clone3.write().unwrap();
            let current = st.get(key).and_then(|v| v.as_int().ok()).unwrap_or(0);
            let new_val = current + 1;
            st.insert(key.to_string(), Dynamic::from(new_val));
            new_val
        });

        // Register log function
        let logs_clone = Arc::clone(&logs);
        engine.register_fn("log", move |msg: &str| {
            logs_clone.write().unwrap().push(msg.to_string());
        });

        let logs_clone2 = Arc::clone(&logs);
        engine.register_fn("debug", move |msg: &str| {
            logs_clone2
                .write()
                .unwrap()
                .push(format!("[DEBUG] {}", msg));
        });

        // Register utility functions
        engine.register_fn(
            "get_bits",
            |frame: &mut ScriptFrame, start: i64, len: i64| -> i64 {
                // Extract bits from frame data (simplified)
                let start_byte = start as usize / 8;
                let start_bit = start as usize % 8;
                if start_byte >= frame.data.len() {
                    return 0;
                }
                let byte = frame.data[start_byte];
                let mask = ((1u16 << len) - 1) as u8;
                ((byte >> start_bit) & mask) as i64
            },
        );

        engine.register_fn(
            "set_bits",
            |frame: &mut ScriptFrame, start: i64, len: i64, val: i64| {
                let start_byte = start as usize / 8;
                let start_bit = start as usize % 8;
                if start_byte >= frame.data.len() {
                    return;
                }
                let mask = ((1u16 << len) - 1) as u8;
                let byte = &mut frame.data[start_byte];
                *byte = (*byte & !(mask << start_bit)) | (((val as u8) & mask) << start_bit);
            },
        );

        // Math functions
        engine
            .register_fn("abs", |x: i64| x.abs())
            .register_fn("min", |a: i64, b: i64| a.min(b))
            .register_fn("max", |a: i64, b: i64| a.max(b))
            .register_fn("clamp", |x: i64, min: i64, max: i64| x.clamp(min, max));

        // Register send functions - queue frames for CAN transmission
        let send_clone = Arc::clone(&send_frames);
        engine.register_fn("send", move |id: i64, data: Vec<Dynamic>| {
            let data_bytes: Vec<u8> = data
                .into_iter()
                .map(|d| d.as_int().unwrap_or(0) as u8)
                .collect();
            send_clone.write().unwrap().push(SendFrame {
                id: id as u32,
                data: data_bytes,
                extended: false,
                fd: false,
            });
        });

        let send_clone2 = Arc::clone(&send_frames);
        engine.register_fn("send_extended", move |id: i64, data: Vec<Dynamic>| {
            let data_bytes: Vec<u8> = data
                .into_iter()
                .map(|d| d.as_int().unwrap_or(0) as u8)
                .collect();
            send_clone2.write().unwrap().push(SendFrame {
                id: id as u32,
                data: data_bytes,
                extended: true,
                fd: false,
            });
        });

        let send_clone3 = Arc::clone(&send_frames);
        engine.register_fn("send_fd", move |id: i64, data: Vec<Dynamic>| {
            let data_bytes: Vec<u8> = data
                .into_iter()
                .map(|d| d.as_int().unwrap_or(0) as u8)
                .collect();
            send_clone3.write().unwrap().push(SendFrame {
                id: id as u32,
                data: data_bytes,
                extended: false,
                fd: true,
            });
        });

        let send_clone4 = Arc::clone(&send_frames);
        engine.register_fn("send_fd_extended", move |id: i64, data: Vec<Dynamic>| {
            let data_bytes: Vec<u8> = data
                .into_iter()
                .map(|d| d.as_int().unwrap_or(0) as u8)
                .collect();
            send_clone4.write().unwrap().push(SendFrame {
                id: id as u32,
                data: data_bytes,
                extended: true,
                fd: true,
            });
        });

        // Compile the script
        let ast = match engine.compile(script) {
            Ok(ast) => ast,
            Err(e) => {
                return Err(ValidationResult {
                    valid: false,
                    errors: vec![format!("Compile error: {}", e)],
                    warnings: vec![],
                });
            }
        };

        // Check for on_frame function
        let mut warnings = vec![];
        if !script.contains("fn on_frame") {
            warnings.push("Script does not define 'fn on_frame(frame)' callback".to_string());
        }

        if !warnings.is_empty() {
            // Still return success but with warnings
            log::warn!("Script compiled with warnings: {:?}", warnings);
        }

        Ok(Self {
            engine,
            ast,
            scope: Scope::new(),
            output_frames,
            send_frames,
            state,
            logs,
        })
    }

    /// Initialize the script (run top-level code)
    pub fn initialize(&mut self) -> Result<(), String> {
        self.engine
            .run_ast_with_scope(&mut self.scope, &self.ast)
            .map_err(|e| format!("Script init error: {}", e))
    }

    /// Process a frame through the script
    pub fn on_frame(&mut self, frame: ScriptFrame) -> Result<(), String> {
        let options = CallFnOptions::new().eval_ast(false);

        self.engine
            .call_fn_with_options::<()>(options, &mut self.scope, &self.ast, "on_frame", (frame,))
            .map_err(|e| format!("on_frame error: {}", e))
    }

    /// Take output frames (clears the buffer)
    pub fn take_output(&mut self) -> Vec<ScriptFrame> {
        std::mem::take(&mut *self.output_frames.write().unwrap())
    }

    /// Take log messages (clears the buffer)
    pub fn take_logs(&mut self) -> Vec<String> {
        std::mem::take(&mut *self.logs.write().unwrap())
    }

    /// Take send frames (clears the buffer)
    pub fn take_send_frames(&mut self) -> Vec<SendFrame> {
        std::mem::take(&mut *self.send_frames.write().unwrap())
    }
}

/// Validate a workflow script without running it
pub fn validate_workflow_script(script: &str) -> ValidationResult {
    match WorkflowScript::compile(script) {
        Ok(_) => {
            let mut warnings = vec![];
            if !script.contains("fn on_frame") {
                warnings.push("Script does not define 'fn on_frame(frame)' callback".to_string());
            }
            ValidationResult {
                valid: true,
                errors: vec![],
                warnings,
            }
        }
        Err(result) => result,
    }
}

/// Execute a workflow script on a batch of frames
///
/// Compiles the script, runs initialization, processes all frames through on_frame,
/// and returns the collected output frames.
pub fn execute_workflow_script(
    script: &str,
    frames: Vec<CanFrameDto>,
) -> Result<Vec<CanFrameDto>, String> {
    // Compile script
    let mut compiled = WorkflowScript::compile(script).map_err(|r| r.errors.join("; "))?;

    // Initialize
    compiled.initialize()?;

    // Process each frame
    for frame in frames {
        let script_frame = ScriptFrame::from_dto(&frame);
        compiled.on_frame(script_frame)?;
    }

    // Collect output frames
    let output_frames = compiled.take_output();
    Ok(output_frames.into_iter().map(|f| f.to_dto()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_passthrough() {
        let script = r#"
            fn on_frame(frame) {
                emit(frame);
            }
        "#;

        let mut compiled = WorkflowScript::compile(script).unwrap();
        compiled.initialize().unwrap();

        let input = ScriptFrame {
            id: 0x100,
            data: vec![1, 2, 3, 4],
            dlc: 4,
            timestamp: 0.0,
            extended: false,
            channel: "vcan0".to_string(),
        };

        compiled.on_frame(input.clone()).unwrap();
        let output = compiled.take_output();
        assert_eq!(output.len(), 1);
        assert_eq!(output[0].id, 0x100);
    }

    #[test]
    fn test_filter() {
        let script = r#"
            fn on_frame(frame) {
                if frame.id == 0x100 {
                    emit(frame);
                }
            }
        "#;

        let mut compiled = WorkflowScript::compile(script).unwrap();
        compiled.initialize().unwrap();

        // ID 0x100 should pass
        let input1 = ScriptFrame {
            id: 0x100,
            data: vec![1, 2, 3, 4],
            dlc: 4,
            timestamp: 0.0,
            extended: false,
            channel: "vcan0".to_string(),
        };
        compiled.on_frame(input1).unwrap();
        assert_eq!(compiled.take_output().len(), 1);

        // ID 0x200 should be filtered
        let input2 = ScriptFrame {
            id: 0x200,
            data: vec![5, 6, 7, 8],
            dlc: 4,
            timestamp: 0.0,
            extended: false,
            channel: "vcan0".to_string(),
        };
        compiled.on_frame(input2).unwrap();
        assert_eq!(compiled.take_output().len(), 0);
    }

    #[test]
    fn test_modify() {
        let script = r#"
            fn on_frame(frame) {
                let modified = frame.clone();
                modified.id = frame.id + 0x1000;
                emit(modified);
            }
        "#;

        let mut compiled = WorkflowScript::compile(script).unwrap();
        compiled.initialize().unwrap();

        let input = ScriptFrame {
            id: 0x100,
            data: vec![1, 2, 3, 4],
            dlc: 4,
            timestamp: 0.0,
            extended: false,
            channel: "vcan0".to_string(),
        };

        compiled.on_frame(input).unwrap();
        let output = compiled.take_output();
        assert_eq!(output.len(), 1);
        assert_eq!(output[0].id, 0x1100);
    }

    #[test]
    fn test_state() {
        let script = r#"
            fn on_frame(frame) {
                let count = state_inc("counter");
                log("Frame " + count);
                emit(frame);
            }
        "#;

        let mut compiled = WorkflowScript::compile(script).unwrap();
        compiled.initialize().unwrap();

        let frame = ScriptFrame {
            id: 0x100,
            data: vec![1, 2, 3, 4],
            dlc: 4,
            timestamp: 0.0,
            extended: false,
            channel: "vcan0".to_string(),
        };

        for _ in 0..3 {
            compiled.on_frame(frame.clone()).unwrap();
        }

        let logs = compiled.take_logs();
        assert_eq!(logs.len(), 3);
        assert!(logs[0].contains("Frame 1"));
        assert!(logs[1].contains("Frame 2"));
        assert!(logs[2].contains("Frame 3"));
    }
}
