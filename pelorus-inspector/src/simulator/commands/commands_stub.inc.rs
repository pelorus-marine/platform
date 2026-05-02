// Simulator command stubs for non-Linux targets (no SocketCAN).

/// Average bits per CAN frame (header + 8 data bytes + stuff bits + CRC + EOF)
const BITS_PER_FRAME: f64 = 111.0;
use crate::AppState;
use std::sync::Arc;
use std::sync::atomic::Ordering;

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
    Vec::new()
}

#[tauri::command]
pub async fn sim_start(
    _state: tauri::State<'_, Arc<SimulatorState>>,
    _app_state: tauri::State<'_, Arc<AppState>>,
) -> Result<(), String> {
    Err("Traffic simulator requires Linux with SocketCAN.".to_string())
}

#[tauri::command]
pub fn sim_stop(state: tauri::State<'_, Arc<SimulatorState>>) {
    state.running.store(false, Ordering::SeqCst);
}

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

#[tauri::command]
pub fn sim_validate_script(script: String) -> super::engine::ValidationResult {
    super::engine::validate_script(&script)
}

#[tauri::command]
pub async fn sim_load_script(
    state: tauri::State<'_, Arc<SimulatorState>>,
    script: String,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("Cannot load script while simulator is running".to_string());
    }
    let result = super::engine::validate_script(&script);
    if !result.valid {
        return Err(result.errors.join("\n"));
    }
    *state.script.lock().await = Some(script);
    Ok(())
}

#[tauri::command]
pub async fn sim_clear_script(state: tauri::State<'_, Arc<SimulatorState>>) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("Cannot clear script while simulator is running".to_string());
    }
    *state.script.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn sim_get_script(
    state: tauri::State<'_, Arc<SimulatorState>>,
) -> Result<Option<String>, String> {
    Ok(state.script.lock().await.clone())
}

#[tauri::command]
pub async fn sim_get_logs(
    state: tauri::State<'_, Arc<SimulatorState>>,
) -> Result<Vec<String>, String> {
    let mut logs = state.script_logs.lock().await;
    Ok(std::mem::take(&mut *logs))
}

#[tauri::command]
pub async fn sim_has_script(state: tauri::State<'_, Arc<SimulatorState>>) -> Result<bool, String> {
    Ok(state.script.lock().await.is_some())
}
