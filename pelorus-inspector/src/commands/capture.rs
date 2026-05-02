//! SocketCAN capture commands (Linux only).
//!
//! Architecture:
//! - Socket thread: reads frames from SocketCAN, sends via channel
//! - Processor thread: receives frames, processes them, emits updates
//! - No shared state between threads (no mutex contention)

use crate::dto::CanErrorDto;
use crate::state::AppState;
use std::sync::Arc;
use tauri::State;

/// Message type for capture channel.
#[cfg(target_os = "linux")]
enum CaptureMessage {
    Frame(crate::dto::CanFrameDto),
    Error(CanErrorDto),
}

/// List available SocketCAN interfaces.
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn list_can_interfaces() -> Result<Vec<String>, String> {
    use std::fs;

    let mut interfaces = Vec::new();

    if let Ok(entries) = fs::read_dir("/sys/class/net") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let type_path = entry.path().join("type");

            // Type 280 is ARPHRD_CAN
            if let Ok(type_val) = fs::read_to_string(&type_path) {
                if type_val.trim() == "280" && !interfaces.contains(&name) {
                    interfaces.push(name.clone());
                }
            }

            // Also include vcan/can prefixed interfaces
            if (name.starts_with("vcan") || name.starts_with("can")) && !interfaces.contains(&name)
            {
                interfaces.push(name);
            }
        }
    }

    Ok(interfaces)
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn list_can_interfaces() -> Result<Vec<String>, String> {
    Err("SocketCAN is only available on Linux".to_string())
}

/// Start capturing CAN frames from an interface.
///
/// Architecture:
/// 1. Socket thread: reads frames, logs ALL to MDF4, sends to channel for display
/// 2. Processor thread: receives frames for live display only (can drop frames)
/// 3. Lossless MDF4 capture, lossy live display under high load
///
/// # Arguments
/// * `interface` - SocketCAN interface name (e.g., "can0", "vcan0")
/// * `capture_file` - Path to save MDF4 file
/// * `append` - If true and file exists, append to existing file
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn start_capture(
    interface: String,
    capture_file: String,
    append: bool,
    filters: Option<Vec<crate::dto::CanBpfFilter>>,
    window: tauri::Window,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    use crate::dto::CanFrameDto;
    use crate::live_capture::LiveCaptureState;
    use mdf4_rs::can::RawCanLogger;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};
    use tauri::Emitter;
    use tokio::sync::oneshot;

    use socketcan::{CanFdSocket, CanFilter, Socket, SocketOptions};

    // Check if already running
    if *state.capture_running.lock() {
        return Err("Capture already running".to_string());
    }

    // Open CAN FD socket
    let socket =
        CanFdSocket::open(&interface).map_err(|e| format!("Failed to open interface: {}", e))?;

    // Apply kernel-level BPF filters if provided
    if let Some(ref filter_list) = filters {
        if !filter_list.is_empty() {
            let can_filters: Vec<CanFilter> = filter_list
                .iter()
                .map(|f| {
                    // Set EFF flag for extended IDs
                    let can_id = if f.is_extended {
                        f.can_id | 0x8000_0000 // CAN_EFF_FLAG
                    } else {
                        f.can_id
                    };
                    let mask = if f.is_extended {
                        f.mask | 0x8000_0000 // Match EFF flag too
                    } else {
                        f.mask
                    };

                    if f.inverted {
                        CanFilter::new_inverted(can_id, mask)
                    } else {
                        CanFilter::new(can_id, mask)
                    }
                })
                .collect();

            socket
                .set_filters(&can_filters)
                .map_err(|e| format!("Failed to set BPF filters: {}", e))?;

            log::info!(
                "Applied {} kernel-level CAN filter(s) on {}",
                can_filters.len(),
                interface
            );
        }
    }

    socket
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to set non-blocking: {}", e))?;

    // Bounded channel for frames and errors: socket thread -> processor thread (live display only)
    let (msg_tx, msg_rx) = mpsc::sync_channel::<CaptureMessage>(1024);

    // Channel for stop signal: main -> socket thread
    let (stop_tx, stop_rx) = oneshot::channel::<oneshot::Sender<Result<String, String>>>();

    // Store stop sender for stop_capture command
    *state.capture_stop_tx.lock() = Some(stop_tx);
    *state.capture_running.lock() = true;

    // Clone FastDbc for processor thread (O(1) lookup + zero-allocation decode)
    let fast_dbc_clone = state.fast_dbc.lock().clone();
    let vss_match_clone = state.vss_match.lock().clone();
    let interface_name = interface.clone();
    let capture_file_for_socket = capture_file.clone();
    let window_for_processor = window.clone();

    // Socket thread: reads frames, logs ALL to MDF4, sends to display channel
    let append_mode = append;
    std::thread::spawn(move || {
        use embedded_can::blocking::Can;

        let mut socket = socket;
        let start_time = Instant::now();
        let mut stop_rx = stop_rx;

        // MDF4 logger owned by socket thread for lossless capture
        // If append mode and file exists, load existing file
        let (mut logger, timestamp_offset_us) =
            if append_mode && std::path::Path::new(&capture_file_for_socket).exists() {
                match RawCanLogger::from_file(&capture_file_for_socket) {
                    Ok(l) => {
                        let offset = l.last_timestamp_us();
                        (Some(l), offset)
                    }
                    Err(_) => (RawCanLogger::new().ok(), 0),
                }
            } else {
                (RawCanLogger::new().ok(), 0)
            };

        loop {
            // Check for stop signal (non-blocking)
            match stop_rx.try_recv() {
                Ok(result_tx) => {
                    // Stop requested - finalize MDF4
                    let result = finalize_mdf4(logger, &capture_file_for_socket);
                    let _ = result_tx.send(result);
                    return;
                }
                Err(oneshot::error::TryRecvError::Empty) => {}
                Err(oneshot::error::TryRecvError::Closed) => {
                    // Abnormal exit - still try to save
                    let _ = finalize_mdf4(logger, &capture_file_for_socket);
                    return;
                }
            }

            match socket.receive() {
                Ok(frame) => {
                    // Add timestamp offset for append mode (continuing from previous capture)
                    let timestamp = start_time.elapsed().as_secs_f64()
                        + (timestamp_offset_us as f64 / 1_000_000.0);

                    // Handle error frames separately
                    if let socketcan::CanAnyFrame::Error(err_frame) = frame {
                        let error_dto =
                            CanErrorDto::from_error_frame(err_frame, timestamp, &interface_name);
                        let _ = msg_tx.try_send(CaptureMessage::Error(error_dto));
                    } else if let Some(frame_dto) =
                        CanFrameDto::from_any_frame(&frame, timestamp, &interface_name)
                    {
                        // Log EVERY frame to MDF4 (lossless)
                        log_frame_to_mdf4(&mut logger, &frame_dto);

                        // Send to display channel (lossy - drop if full)
                        let _ = msg_tx.try_send(CaptureMessage::Frame(frame_dto));
                    }
                }
                Err(socketcan::Error::Io(ref e)) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(1));
                }
                Err(e) => {
                    let _ = window.emit("capture-error", format!("Read error: {}", e));
                    let _ = finalize_mdf4(logger, &capture_file_for_socket);
                    return;
                }
            }
        }
    });

    // Processor thread: live display only (no MDF4 logging)
    std::thread::spawn(move || {
        let mut capture_state =
            LiveCaptureState::new(capture_file, fast_dbc_clone, vss_match_clone);
        let mut last_update = Instant::now();
        let update_interval = Duration::from_millis(100);

        loop {
            // Process frames and errors (non-blocking with timeout)
            match msg_rx.recv_timeout(Duration::from_millis(10)) {
                Ok(CaptureMessage::Frame(frame)) => {
                    capture_state.process_frame(frame);
                }
                Ok(CaptureMessage::Error(error)) => {
                    capture_state.process_error(
                        error.timestamp,
                        &error.channel,
                        &error.error_type,
                        &error.details,
                    );
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    // Socket thread exited
                    return;
                }
            }

            // Send periodic updates
            if last_update.elapsed() >= update_interval {
                capture_state.update_rates();
                let update = capture_state.generate_update();
                let _ = window_for_processor.emit("live-capture-update", &update);
                last_update = Instant::now();
            }
        }
    });

    Ok(())
}

/// Log a frame to MDF4.
#[cfg(target_os = "linux")]
fn log_frame_to_mdf4(
    logger: &mut Option<mdf4_rs::can::RawCanLogger<mdf4_rs::writer::VecWriter>>,
    frame: &crate::dto::CanFrameDto,
) {
    use mdf4_rs::can::FdFlags;

    let Some(logger) = logger else { return };
    let timestamp_us = (frame.timestamp * 1_000_000.0) as u64;

    if frame.is_fd {
        let flags = FdFlags::new(frame.brs, frame.esi);
        if frame.is_extended {
            logger.log_fd_extended(frame.can_id, timestamp_us, &frame.data, flags);
        } else {
            logger.log_fd(frame.can_id, timestamp_us, &frame.data, flags);
        }
    } else if frame.is_extended {
        logger.log_extended(frame.can_id, timestamp_us, &frame.data);
    } else {
        logger.log(frame.can_id, timestamp_us, &frame.data);
    }
}

/// Finalize MDF4 and write to disk.
#[cfg(target_os = "linux")]
fn finalize_mdf4(
    logger: Option<mdf4_rs::can::RawCanLogger<mdf4_rs::writer::VecWriter>>,
    path: &str,
) -> Result<String, String> {
    if let Some(logger) = logger {
        let bytes = logger
            .finalize()
            .map_err(|e| format!("Failed to finalize MDF4: {:?}", e))?;
        std::fs::write(path, bytes).map_err(|e| format!("Failed to write MDF4: {}", e))?;
    }
    Ok(path.to_string())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn start_capture(
    _interface: String,
    _capture_file: String,
    _append: bool,
    _filters: Option<Vec<crate::dto::CanBpfFilter>>,
    _window: tauri::Window,
    _state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    Err("SocketCAN is only available on Linux".to_string())
}

/// Stop the current capture and wait for MDF4 to be written.
///
/// Returns the path to the finalized MDF4 file.
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn stop_capture(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    use tokio::sync::oneshot;

    // Take the stop sender
    let stop_tx = state.capture_stop_tx.lock().take();

    if let Some(tx) = stop_tx {
        // Create channel for result
        let (result_tx, result_rx) = oneshot::channel();

        // Send stop signal with result channel
        if tx.send(result_tx).is_err() {
            return Err("Capture thread already stopped".to_string());
        }

        // Wait for result
        let result = result_rx.await.map_err(|_| "Capture thread panicked")?;

        *state.capture_running.lock() = false;
        result
    } else {
        *state.capture_running.lock() = false;
        Err("No capture running".to_string())
    }
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn stop_capture(_state: State<'_, Arc<AppState>>) -> Result<String, String> {
    Err("SocketCAN is only available on Linux".to_string())
}

/// Check if a capture is currently running.
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn is_capture_running(state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    Ok(*state.capture_running.lock())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn is_capture_running(_state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    Ok(false)
}
