//! Rhai-based scripting engine for CAN traffic simulation
//!
//! Uses signal definitions from the loaded DBC file for encoding.

use dbc_rs::Dbc;
use rhai::{AST, CallFnOptions, Engine, EvalAltResult, Position, Scope};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Helper to create a Rhai runtime error
fn rhai_error(msg: impl Into<String>) -> Box<EvalAltResult> {
    EvalAltResult::ErrorRuntime(msg.into().into(), Position::NONE).into()
}

/// Frame to be sent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutgoingFrame {
    pub id: u32,
    pub data: Vec<u8>,
    pub extended: bool,
    pub fd: bool,
}

/// Script validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Pending signal values waiting to be encoded
#[derive(Debug, Clone, Default)]
struct SignalValues {
    /// (message_name, signal_name) -> physical value
    values: HashMap<(String, String), f64>,
}

/// Compiled script with its engine
pub struct CompiledScript {
    engine: Engine,
    ast: AST,
    scope: Scope<'static>,
    /// Frames queued for sending
    outgoing_frames: Arc<RwLock<Vec<OutgoingFrame>>>,
    /// Log messages from script
    logs: Arc<RwLock<Vec<String>>>,
}

impl CompiledScript {
    /// Create a new script engine and compile the script
    pub fn compile(script: &str, dbc: Option<Arc<Dbc>>) -> Result<Self, ValidationResult> {
        let mut engine = Engine::new();

        // Shared state
        let signal_values: Arc<RwLock<SignalValues>> =
            Arc::new(RwLock::new(SignalValues::default()));
        let outgoing_frames: Arc<RwLock<Vec<OutgoingFrame>>> = Arc::new(RwLock::new(Vec::new()));
        let logs: Arc<RwLock<Vec<String>>> = Arc::new(RwLock::new(Vec::new()));

        // Register set_signal function: set_signal(message_name, signal_name, value)
        let sv_clone = Arc::clone(&signal_values);
        engine.register_fn(
            "set_signal",
            move |msg_name: &str, sig_name: &str, value: f64| {
                let mut sv = sv_clone.write().unwrap();
                sv.values
                    .insert((msg_name.to_string(), sig_name.to_string()), value);
            },
        );

        // Register send_message function (by name) - returns error if DBC not loaded or message not found
        let dbc_clone = dbc.clone();
        let sv_clone2 = Arc::clone(&signal_values);
        let frames_clone = Arc::clone(&outgoing_frames);
        engine.register_fn("send_message", move |name: &str| -> Result<(), Box<EvalAltResult>> {
            let Some(ref dbc) = dbc_clone else {
                return Err(rhai_error("send_message: No DBC loaded. Load a DBC file first or use send() for raw frames."));
            };

            // Find message by name
            let msg = dbc.messages().iter().find(|m| m.name() == name);
            let Some(msg) = msg else {
                let available: Vec<_> = dbc.messages().iter().take(5).map(|m| m.name()).collect();
                return Err(rhai_error(format!(
                    "send_message: Message '{}' not found in DBC. Available: {:?}{}",
                    name,
                    available,
                    if dbc.messages().len() > 5 { "..." } else { "" }
                )));
            };

            // Create payload buffer
            let mut payload = vec![0u8; msg.dlc() as usize];

            // Encode all signals for this message
            let sv = sv_clone2.read().unwrap();
            let msg_name = msg.name().to_string();
            for sig in msg.signals().iter() {
                let key = (msg_name.clone(), sig.name().to_string());
                if let Some(&value) = sv.values.get(&key) {
                    if let Err(e) = sig.encode_to(value, &mut payload) {
                        return Err(rhai_error(format!(
                            "send_message: Encode error for {}.{}: {:?}",
                            msg_name, sig.name(), e
                        )));
                    }
                }
            }

            // Queue frame (CAN FD if DLC > 8)
            let is_fd = msg.dlc() > 8;
            let mut frames = frames_clone.write().unwrap();
            frames.push(OutgoingFrame {
                id: msg.id(),
                data: payload,
                extended: msg.is_extended(),
                fd: is_fd,
            });
            Ok(())
        });

        // Register send_message by ID - returns error if DBC not loaded or ID not found
        let dbc_clone2 = dbc.clone();
        let sv_clone3 = Arc::clone(&signal_values);
        let frames_clone2 = Arc::clone(&outgoing_frames);
        engine.register_fn("send_message", move |id: i64| -> Result<(), Box<EvalAltResult>> {
            let Some(ref dbc) = dbc_clone2 else {
                return Err(rhai_error("send_message: No DBC loaded. Load a DBC file first or use send() for raw frames."));
            };

            // Find message by ID
            let msg = dbc.messages().iter().find(|m| m.id() == id as u32);
            let Some(msg) = msg else {
                let available: Vec<_> = dbc.messages().iter().take(5).map(|m| format!("0x{:X} ({})", m.id(), m.name())).collect();
                return Err(rhai_error(format!(
                    "send_message: Message ID 0x{:X} not found in DBC. Available: {:?}{}",
                    id,
                    available,
                    if dbc.messages().len() > 5 { "..." } else { "" }
                )));
            };

            // Create payload buffer
            let mut payload = vec![0u8; msg.dlc() as usize];

            // Encode all signals for this message
            let sv = sv_clone3.read().unwrap();
            let msg_name = msg.name().to_string();
            for sig in msg.signals().iter() {
                let key = (msg_name.clone(), sig.name().to_string());
                if let Some(&value) = sv.values.get(&key) {
                    if let Err(e) = sig.encode_to(value, &mut payload) {
                        return Err(rhai_error(format!(
                            "send_message: Encode error for {}.{}: {:?}",
                            msg_name, sig.name(), e
                        )));
                    }
                }
            }

            // Queue frame (CAN FD if DLC > 8)
            let is_fd = msg.dlc() > 8;
            let mut frames = frames_clone2.write().unwrap();
            frames.push(OutgoingFrame {
                id: msg.id(),
                data: payload,
                extended: msg.is_extended(),
                fd: is_fd,
            });
            Ok(())
        });

        // Register raw send function (for ad-hoc classic CAN messages)
        let frames_clone3 = Arc::clone(&outgoing_frames);
        engine.register_fn("send", move |id: i64, data: rhai::Array| {
            let mut frames = frames_clone3.write().unwrap();
            let data_bytes: Vec<u8> = data
                .iter()
                .take(8) // Classic CAN: max 8 bytes
                .map(|v| v.as_int().unwrap_or(0) as u8)
                .collect();
            frames.push(OutgoingFrame {
                id: id as u32,
                data: data_bytes,
                extended: false,
                fd: false,
            });
        });

        // Register CAN FD send function (up to 64 bytes)
        let frames_clone4 = Arc::clone(&outgoing_frames);
        engine.register_fn("send_fd", move |id: i64, data: rhai::Array| {
            let mut frames = frames_clone4.write().unwrap();
            let data_bytes: Vec<u8> = data
                .iter()
                .take(64) // CAN FD: max 64 bytes
                .map(|v| v.as_int().unwrap_or(0) as u8)
                .collect();
            frames.push(OutgoingFrame {
                id: id as u32,
                data: data_bytes,
                extended: false,
                fd: true,
            });
        });

        // Register math functions
        engine
            .register_fn("sin", |x: f64| x.sin())
            .register_fn("cos", |x: f64| x.cos())
            .register_fn("tan", |x: f64| x.tan())
            .register_fn("sqrt", |x: f64| x.sqrt())
            .register_fn("abs", |x: f64| x.abs())
            .register_fn("abs", |x: i64| x.abs())
            .register_fn("floor", |x: f64| x.floor())
            .register_fn("ceil", |x: f64| x.ceil())
            .register_fn("round", |x: f64| x.round())
            .register_fn("min", |a: f64, b: f64| a.min(b))
            .register_fn("max", |a: f64, b: f64| a.max(b))
            .register_fn("min", |a: i64, b: i64| a.min(b))
            .register_fn("max", |a: i64, b: i64| a.max(b))
            .register_fn("clamp", |x: f64, min: f64, max: f64| x.clamp(min, max))
            .register_fn("pow", |base: f64, exp: f64| base.powf(exp));

        // Register random functions
        engine
            .register_fn("rand", rand::random::<f64>)
            .register_fn("rand_range", |min: f64, max: f64| {
                min + rand::random::<f64>() * (max - min)
            })
            .register_fn("rand_int", |min: i64, max: i64| {
                use rand::Rng;
                rand::rng().random_range(min..=max)
            });

        // Register log function
        let logs_clone3 = Arc::clone(&logs);
        engine.register_fn("log", move |msg: &str| {
            let mut logs = logs_clone3.write().unwrap();
            logs.push(msg.to_string());
        });

        // Compile the script
        let ast = match engine.compile(script) {
            Ok(ast) => ast,
            Err(e) => {
                return Err(ValidationResult {
                    valid: false,
                    errors: vec![format!("Compilation error: {}", e)],
                    warnings: vec![],
                });
            }
        };

        Ok(Self {
            engine,
            ast,
            scope: Scope::new(),
            outgoing_frames,
            logs,
        })
    }

    /// Initialize the script (run top-level code)
    pub fn initialize(&mut self) -> Result<(), String> {
        self.engine
            .run_ast_with_scope(&mut self.scope, &self.ast)
            .map_err(|e| format!("Initialization error: {}", e))
    }

    /// Call on_tick if defined
    pub fn on_tick(&mut self, time_ms: u64) -> Result<(), Box<EvalAltResult>> {
        if self.ast.iter_functions().any(|f| f.name == "on_tick") {
            let options = CallFnOptions::new().eval_ast(false).rewind_scope(false);

            let _: () = self.engine.call_fn_with_options(
                options,
                &mut self.scope,
                &self.ast,
                "on_tick",
                (time_ms as i64,),
            )?;
        }
        Ok(())
    }

    /// Get frames queued for sending and clear the queue
    pub fn take_frames(&mut self) -> Vec<OutgoingFrame> {
        let mut frames = self.outgoing_frames.write().unwrap();
        std::mem::take(&mut *frames)
    }

    /// Get and clear logs
    pub fn take_logs(&mut self) -> Vec<String> {
        let mut logs = self.logs.write().unwrap();
        std::mem::take(&mut *logs)
    }
}

/// Validate a script without running it
pub fn validate_script(script: &str) -> ValidationResult {
    match CompiledScript::compile(script, None) {
        Ok(_) => ValidationResult {
            valid: true,
            errors: vec![],
            warnings: vec![],
        },
        Err(result) => result,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raw_send() {
        let script = r#"
            fn on_tick(t) {
                if t % 10 == 0 {
                    send(0x100, [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
                }
            }
        "#;

        let mut compiled = CompiledScript::compile(script, None).unwrap();
        compiled.initialize().unwrap();

        // Tick 0 should send (0 % 10 == 0)
        compiled.on_tick(0).unwrap();
        let frames = compiled.take_frames();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].id, 0x100);
        assert_eq!(frames[0].data, vec![1, 2, 3, 4, 5, 6, 7, 8]);

        // Tick 5 should not send
        compiled.on_tick(5).unwrap();
        let frames = compiled.take_frames();
        assert!(frames.is_empty());

        // Tick 10 should send
        compiled.on_tick(10).unwrap();
        let frames = compiled.take_frames();
        assert_eq!(frames.len(), 1);
        assert!(!frames[0].fd); // Classic CAN
    }

    #[test]
    fn test_send_fd() {
        let script = r#"
            fn on_tick(t) {
                if t == 0 {
                    send_fd(0x200, [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                                   0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10]);
                }
            }
        "#;

        let mut compiled = CompiledScript::compile(script, None).unwrap();
        compiled.initialize().unwrap();

        compiled.on_tick(0).unwrap();
        let frames = compiled.take_frames();
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].id, 0x200);
        assert_eq!(frames[0].data.len(), 16); // 16 bytes for FD
        assert!(frames[0].fd); // FD flag set
    }

    #[test]
    fn test_send_message_without_dbc_errors() {
        let script = r#"
            fn on_tick(t) {
                if t == 0 {
                    send_message("EngineData");
                }
            }
        "#;

        let mut compiled = CompiledScript::compile(script, None).unwrap();
        compiled.initialize().unwrap();

        // Should error because no DBC loaded
        let result = compiled.on_tick(0);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("No DBC loaded"),
            "Error should mention no DBC: {}",
            err
        );
    }
}
