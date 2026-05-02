// Tauri commands for traffic simulator

use super::engine::{CompiledScript, OutgoingFrame};
/// Average bits per CAN frame (header + 8 data bytes + stuff bits + CRC + EOF)
const BITS_PER_FRAME: f64 = 111.0;
use crate::AppState;
use dbc_rs::Dbc;
use socketcan::{CanFdSocket, CanSocket, EmbeddedFrame, ExtendedId, Socket, StandardId};
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

// Re-export types and state for backward compatibility
pub use super::state::SimulatorState;
pub use super::types::{InterfaceInfo, MessageInfo, SignalInfo, SimulatorConfig, SimulatorStats};

#[tauri::command]
pub fn sim_get_config(state: tauri::State<'_, Arc<SimulatorState>>) -> SimulatorConfig {
    let config = state.config.blocking_lock();
    SimulatorConfig {
        interface: config.interface.clone(),
        rate_mbps: state.get_rate(),
    }
}

#[tauri::command]
pub fn sim_set_config(
    state: tauri::State<'_, Arc<SimulatorState>>,
    config: SimulatorConfig,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("Cannot change interface while running".to_string());
    }
    let mut current = state.config.blocking_lock();
    current.interface = config.interface;
    state.set_rate(config.rate_mbps);
    Ok(())
}

#[tauri::command]
pub fn sim_set_rate(state: tauri::State<'_, Arc<SimulatorState>>, rate_mbps: f64) {
    state.set_rate(rate_mbps);
}

#[tauri::command]
pub fn sim_get_stats(state: tauri::State<'_, Arc<SimulatorState>>) -> SimulatorStats {
    let running = state.running.load(Ordering::SeqCst);
    let frames_sent = state.frames_sent.load(Ordering::SeqCst);

    let elapsed_secs = if let Some(start) = *state.start_time.blocking_lock() {
        start.elapsed().as_secs_f64()
    } else {
        0.0
    };

    let actual_rate_mbps = if elapsed_secs > 0.0 {
        (frames_sent as f64 * BITS_PER_FRAME) / elapsed_secs / 1_000_000.0
    } else {
        0.0
    };

    let frames_per_sec = if elapsed_secs > 0.0 {
        frames_sent as f64 / elapsed_secs
    } else {
        0.0
    };

    SimulatorStats {
        running,
        frames_sent,
        elapsed_secs,
        actual_rate_mbps,
        frames_per_sec,
        target_rate_mbps: state.get_rate(),
    }
}

#[tauri::command]
pub fn sim_list_interfaces() -> Vec<InterfaceInfo> {
    let mut interfaces = Vec::new();

    // Check common vcan interfaces
    for i in 0..4 {
        let name = format!("vcan{}", i);
        let available = CanSocket::open(&name).is_ok();
        interfaces.push(InterfaceInfo { name, available });
    }

    // Check common can interfaces
    for i in 0..2 {
        let name = format!("can{}", i);
        let available = CanSocket::open(&name).is_ok();
        interfaces.push(InterfaceInfo { name, available });
    }

    interfaces
}

#[tauri::command]
pub async fn sim_start(
    state: tauri::State<'_, Arc<SimulatorState>>,
    app_state: tauri::State<'_, Arc<AppState>>,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("Simulator already running".to_string());
    }

    let config = state.config.lock().await.clone();
    let script = state.script.lock().await.clone();

    // Script is required
    let script_code = script.ok_or("No script loaded. Load a script before starting.")?;

    // Open socket (use FD socket to support both classic CAN and CAN FD)
    let socket = CanFdSocket::open(&config.interface)
        .map_err(|e| format!("Failed to open {}: {}", config.interface, e))?;

    // Get loaded DBC from app state
    let user_dbc = app_state.dbc.lock().clone();

    // Reset stats
    state.frames_sent.store(0, Ordering::SeqCst);
    *state.start_time.lock().await = Some(Instant::now());
    state.script_logs.lock().await.clear();
    state.running.store(true, Ordering::SeqCst);

    // Clone state for the spawned task
    let state = Arc::clone(&state);

    // Spawn the generator task
    tokio::task::spawn_blocking(move || {
        run_script_generator(state, socket, script_code, user_dbc);
    });

    Ok(())
}

#[tauri::command]
pub fn sim_stop(state: tauri::State<'_, Arc<SimulatorState>>) {
    state.running.store(false, Ordering::SeqCst);
}

/// Get available signals from loaded DBC
#[tauri::command]
pub fn sim_get_signals(app_state: tauri::State<'_, Arc<AppState>>) -> Vec<SignalInfo> {
    let dbc = app_state.dbc.lock();
    dbc.as_ref()
        .map(|dbc| {
            dbc.messages()
                .iter()
                .flat_map(|m| {
                    m.signals().iter().map(|s| SignalInfo {
                        name: s.name().to_string(),
                        message_name: m.name().to_string(),
                        message_id: m.id(),
                        start_bit: s.start_bit(),
                        length: s.length() as u8,
                        factor: s.factor(),
                        offset: s.offset(),
                        min: s.min(),
                        max: s.max(),
                        unit: s.unit().unwrap_or("").to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Get available messages from loaded DBC
#[tauri::command]
pub fn sim_get_messages(app_state: tauri::State<'_, Arc<AppState>>) -> Vec<MessageInfo> {
    let dbc = app_state.dbc.lock();
    dbc.as_ref()
        .map(|dbc| {
            dbc.messages()
                .iter()
                .map(|m| MessageInfo {
                    name: m.name().to_string(),
                    id: m.id(),
                    dlc: m.dlc(),
                    signal_count: m.signals().len(),
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Validate a script without loading it
#[tauri::command]
pub fn sim_validate_script(script: String) -> super::engine::ValidationResult {
    super::engine::validate_script(&script)
}

/// Load and compile a script for execution
#[tauri::command]
pub async fn sim_load_script(
    state: tauri::State<'_, Arc<SimulatorState>>,
    script: String,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("Cannot load script while simulator is running".to_string());
    }

    // Validate the script first
    let result = super::engine::validate_script(&script);
    if !result.valid {
        return Err(result.errors.join("\n"));
    }

    // Store the script
    *state.script.lock().await = Some(script);

    Ok(())
}

/// Clear the loaded script
#[tauri::command]
pub async fn sim_clear_script(state: tauri::State<'_, Arc<SimulatorState>>) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("Cannot clear script while simulator is running".to_string());
    }

    *state.script.lock().await = None;

    Ok(())
}

/// Get the current script (if any)
#[tauri::command]
pub async fn sim_get_script(
    state: tauri::State<'_, Arc<SimulatorState>>,
) -> Result<Option<String>, String> {
    Ok(state.script.lock().await.clone())
}

/// Get script execution logs
#[tauri::command]
pub async fn sim_get_logs(
    state: tauri::State<'_, Arc<SimulatorState>>,
) -> Result<Vec<String>, String> {
    let mut logs = state.script_logs.lock().await;
    Ok(std::mem::take(&mut *logs))
}

/// Check if a script is loaded
#[tauri::command]
pub async fn sim_has_script(state: tauri::State<'_, Arc<SimulatorState>>) -> Result<bool, String> {
    Ok(state.script.lock().await.is_some())
}

/// Run a user-provided script
fn run_script_generator(
    state: Arc<SimulatorState>,
    socket: CanFdSocket,
    script_code: String,
    dbc: Option<Dbc>,
) {
    // Wrap DBC in Arc for sharing with script engine
    let dbc = dbc.map(Arc::new);

    // Compile the script with DBC access
    let mut compiled = match CompiledScript::compile(&script_code, dbc) {
        Ok(c) => c,
        Err(result) => {
            let mut logs = state.script_logs.blocking_lock();
            logs.push(format!("Script compilation failed: {:?}", result.errors));
            state.running.store(false, Ordering::SeqCst);
            return;
        }
    };

    // Initialize the script
    if let Err(e) = compiled.initialize() {
        let mut logs = state.script_logs.blocking_lock();
        logs.push(format!("Script initialization failed: {}", e));
        state.running.store(false, Ordering::SeqCst);
        return;
    }

    let start_time = Instant::now();
    let tick_interval = Duration::from_millis(1); // 1ms tick rate

    while state.running.load(Ordering::SeqCst) {
        let time_ms = start_time.elapsed().as_millis() as u64;

        // Call on_tick
        if let Err(e) = compiled.on_tick(time_ms) {
            let mut logs = state.script_logs.blocking_lock();
            logs.push(format!("Script error: {}", e));
            // Stop on script error to avoid flooding logs
            state.running.store(false, Ordering::SeqCst);
            break;
        }

        // Get frames to send
        let frames = compiled.take_frames();

        for frame in frames {
            if send_frame(&socket, &frame) {
                state.frames_sent.fetch_add(1, Ordering::SeqCst);
            }
        }

        // Collect script logs
        let script_logs = compiled.take_logs();
        if !script_logs.is_empty() {
            let mut logs = state.script_logs.blocking_lock();
            logs.extend(script_logs);
        }

        // Sleep until next tick
        std::thread::sleep(tick_interval);
    }
}

/// Send a single CAN frame (classic or FD)
fn send_frame(socket: &CanFdSocket, frame: &OutgoingFrame) -> bool {
    use socketcan::embedded_can::Id;

    let id: Id = if frame.extended {
        match ExtendedId::new(frame.id) {
            Some(id) => id.into(),
            None => return false,
        }
    } else {
        match StandardId::new(frame.id as u16) {
            Some(id) => id.into(),
            None => return false,
        }
    };

    if frame.fd {
        // CAN FD frame (up to 64 bytes)
        if let Some(fd_frame) = socketcan::CanFdFrame::new(id, &frame.data) {
            return socket.write_frame(&fd_frame).is_ok();
        }
    } else {
        // Classic CAN frame (up to 8 bytes)
        if let Some(can_frame) = socketcan::CanDataFrame::new(id, &frame.data) {
            return socket.write_frame(&can_frame).is_ok();
        }
    }
    false
}
