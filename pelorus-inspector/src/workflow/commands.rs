//! Workflow Execution Commands
//!
//! Backend execution of visual workflows for CAN data processing.
//! Uses Tauri events for real-time status updates to the frontend.

use crate::dto::CanFrameDto;
use crate::commands::mdf::parse_can_dataframe;
use std::sync::Arc;
use tauri::{AppHandle, State};

// Re-export types and state for backward compatibility
pub use super::state::{WorkflowState, emit_error, emit_log, emit_status};
pub use super::types::{Workflow, WorkflowConnection, WorkflowStatus};

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

/// Workflow input source
enum WorkflowSource {
    Can {
        interface: String,
    },
    Mdf4 {
        path: String,
        mode: String,
        loop_playback: bool,
    },
    Simulator {
        interface: String,
        rate_hz: f64,
        mode: String,
        script: String,
    },
}

#[tauri::command]
pub async fn workflow_start(
    workflow: Workflow,
    state: State<'_, Arc<WorkflowState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let mut running = state.running.lock();
    if *running {
        return Err("Workflow already running".to_string());
    }

    // Validate workflow
    if workflow.nodes.is_empty() {
        return Err("Workflow has no nodes".to_string());
    }

    // Find input nodes (CAN, MDF4, or Simulator as source)
    let can_nodes: Vec<_> = workflow
        .nodes
        .iter()
        .filter(|n| n.node_type == "can")
        .collect();

    let mdf4_nodes: Vec<_> = workflow
        .nodes
        .iter()
        .filter(|n| n.node_type == "mdf4")
        .collect();

    let simulator_nodes: Vec<_> = workflow
        .nodes
        .iter()
        .filter(|n| n.node_type == "simulator")
        .collect();

    log::info!(
        "Found {} CAN nodes, {} MDF4 nodes, {} Simulator nodes",
        can_nodes.len(),
        mdf4_nodes.len(),
        simulator_nodes.len()
    );

    // Determine source and sink based on connections
    // For now: if we have both CAN and MDF4, CAN is input and MDF4 is output
    // If we have only MDF4 nodes, first one with a file is input, second is output
    let (source, output_path) = if !can_nodes.is_empty() {
        // CAN -> MDF4 workflow
        let interface = can_nodes
            .first()
            .and_then(|n| n.config.get("interface"))
            .and_then(|v| v.as_str())
            .ok_or("CAN node has no interface configured")?
            .to_string();

        let output = mdf4_nodes
            .first()
            .and_then(|n| n.config.get("file"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        (WorkflowSource::Can { interface }, output)
    } else if mdf4_nodes.len() >= 2 {
        // MDF4 -> MDF4 workflow (copy/transform)
        let input_node = &mdf4_nodes[0];
        let output_node = &mdf4_nodes[1];

        let input_path = input_node
            .config
            .get("file")
            .and_then(|v| v.as_str())
            .ok_or("Input MDF4 node has no file configured")?
            .to_string();

        let mode = input_node
            .config
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("realtime")
            .to_string();

        let loop_playback = input_node
            .config
            .get("loop")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let output_path = output_node
            .config
            .get("file")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        log::info!(
            "MDF4 input: {}, mode: {}, loop: {}",
            input_path,
            mode,
            loop_playback
        );

        (
            WorkflowSource::Mdf4 {
                path: input_path,
                mode,
                loop_playback,
            },
            output_path,
        )
    } else if !simulator_nodes.is_empty() {
        // Simulator -> MDF4/CAN workflow
        let sim_node = simulator_nodes.first().unwrap();

        let interface = sim_node
            .config
            .get("interface")
            .and_then(|v| v.as_str())
            .unwrap_or("vcan0")
            .to_string();

        let rate_hz = sim_node
            .config
            .get("rate")
            .and_then(|v| v.as_f64())
            .unwrap_or(100.0);

        let mode = sim_node
            .config
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("continuous")
            .to_string();

        let script = sim_node
            .config
            .get("script")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let output = mdf4_nodes
            .first()
            .and_then(|n| n.config.get("file"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        (
            WorkflowSource::Simulator {
                interface,
                rate_hz,
                mode,
                script,
            },
            output,
        )
    } else if mdf4_nodes.len() == 1 {
        return Err("MDF4 workflow needs both input and output nodes".to_string());
    } else {
        return Err("Workflow has no input nodes (CAN, MDF4, or Simulator)".to_string());
    };

    log::info!("Output MDF4 path: {:?}", output_path);

    *running = true;
    *state.workflow.lock() = Some(workflow.clone());
    *state.stop_flag.lock() = false;

    {
        let mut stats = state.stats.lock();
        stats.running = true;
        stats.frames_processed = 0;
        stats.frames_written = 0;
        stats.errors.clear();
    }

    // Spawn the workflow execution thread
    let state_clone = state.inner().clone();
    let app_clone = app.clone();

    // Emit workflow started event
    emit_log(&app, "Workflow started", "info", None);

    std::thread::spawn(move || {
        let result = match source {
            WorkflowSource::Can { interface } => {
                emit_log(
                    &app_clone,
                    &format!("CAN workflow: {} -> {:?}", interface, output_path),
                    "info",
                    None,
                );
                run_can_workflow(
                    &interface,
                    output_path.as_deref(),
                    &workflow,
                    &state_clone,
                    &app_clone,
                )
            }
            WorkflowSource::Mdf4 {
                path,
                mode,
                loop_playback,
            } => {
                emit_log(
                    &app_clone,
                    &format!("MDF4 workflow: {} -> {:?}", path, output_path),
                    "info",
                    None,
                );
                run_mdf4_workflow(
                    &path,
                    &mode,
                    loop_playback,
                    output_path.as_deref(),
                    &workflow,
                    &state_clone,
                    &app_clone,
                )
            }
            WorkflowSource::Simulator {
                interface,
                rate_hz,
                mode,
                script,
            } => {
                emit_log(
                    &app_clone,
                    &format!(
                        "Simulator workflow: {} @ {}Hz -> {:?}",
                        interface, rate_hz, output_path
                    ),
                    "info",
                    None,
                );
                run_simulator_workflow(
                    &interface,
                    rate_hz,
                    &mode,
                    &script,
                    output_path.as_deref(),
                    &workflow,
                    &state_clone,
                    &app_clone,
                )
            }
        };

        if let Err(e) = result {
            log::error!("Workflow error: {}", e);
            emit_error(&app_clone, &e, None, true);
            let mut stats = state_clone.stats.lock();
            stats.errors.push(e);
        }

        *state_clone.running.lock() = false;
        state_clone.stats.lock().running = false;

        // Emit final stopped status
        let stats = state_clone.stats.lock();
        emit_status(
            &app_clone,
            false,
            stats.frames_processed,
            stats.frames_written,
            None,
        );
        emit_log(&app_clone, "Workflow stopped", "info", None);
    });

    Ok(())
}

#[tauri::command]
pub fn workflow_stop(state: State<'_, Arc<WorkflowState>>) -> Result<(), String> {
    *state.stop_flag.lock() = true;
    log::info!("Workflow stop requested");
    Ok(())
}

#[tauri::command]
pub fn workflow_get_status(state: State<'_, Arc<WorkflowState>>) -> WorkflowStatus {
    state.stats.lock().clone()
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Execution - CAN Source (Linux SocketCAN only)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn run_can_workflow(
    can_interface: &str,
    mdf4_path: Option<&str>,
    workflow: &Workflow,
    state: &Arc<WorkflowState>,
    app: &AppHandle,
) -> Result<(), String> {
    use super::runtime::WorkflowRuntime;
    use socketcan::{CanSocket, EmbeddedFrame, Frame, Socket};

    // Open CAN socket
    let socket = CanSocket::open(can_interface).map_err(|e| {
        let msg = format!("Failed to open CAN socket {}: {}", can_interface, e);
        emit_error(app, &msg, None, true);
        msg
    })?;

    socket
        .set_read_timeout(std::time::Duration::from_millis(100))
        .map_err(|e| {
            let msg = format!("Failed to set socket timeout: {}", e);
            emit_error(app, &msg, None, true);
            msg
        })?;

    emit_log(
        app,
        &format!("Opened CAN socket on {}", can_interface),
        "info",
        None,
    );

    // Open MDF4 file for writing if specified
    let mut mdf4_writer: Option<Mdf4Writer> = if let Some(path) = mdf4_path {
        emit_log(
            app,
            &format!("Creating MDF4 output: {}", path),
            "info",
            None,
        );
        Some(Mdf4Writer::new(path)?)
    } else {
        emit_log(
            app,
            "No MDF4 output configured - frames will not be saved",
            "warn",
            None,
        );
        None
    };

    // Create workflow runtime (DAG executor)
    let mut runtime = WorkflowRuntime::new(workflow.clone(), app.clone()).inspect_err(|e| {
        emit_error(app, e, None, true);
    })?;

    emit_log(
        app,
        &format!(
            "Workflow runtime initialized with {} nodes",
            workflow.nodes.len()
        ),
        "info",
        None,
    );

    // Emit initial status
    emit_status(app, true, 0, 0, None);

    // Track last status emit time for throttling
    let mut last_status_emit = std::time::Instant::now();
    let status_emit_interval = std::time::Duration::from_millis(100);

    // Main loop
    loop {
        // Check stop flag
        if *state.stop_flag.lock() {
            emit_log(app, "Workflow stop requested", "info", None);
            break;
        }

        // Read frame from CAN socket
        match socket.read_frame() {
            Ok(frame) => {
                let can_id = frame.raw_id();
                let is_extended = can_id & 0x80000000 != 0;
                let id = if is_extended {
                    can_id & 0x1FFFFFFF
                } else {
                    can_id & 0x7FF
                };

                let can_frame = CanFrameDto {
                    can_id: id,
                    data: frame.data().to_vec(),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs_f64(),
                    is_extended,
                    is_fd: false,
                    brs: false,
                    esi: false,
                    dlc: frame.data().len() as u8,
                    channel: can_interface.to_string(),
                };

                // Execute workflow DAG on this frame
                let output_frames = runtime.execute(vec![can_frame]);

                // Update stats and write output frames
                let (processed, written) = {
                    let mut stats = state.stats.lock();
                    let (runtime_processed, _) = runtime.stats();
                    stats.frames_processed = runtime_processed;

                    // Write output frames to MDF4 if configured
                    if let Some(ref mut writer) = mdf4_writer {
                        for output_frame in &output_frames {
                            if writer.write_frame(output_frame).is_ok() {
                                stats.frames_written += 1;
                            }
                        }
                    }

                    (stats.frames_processed, stats.frames_written)
                };

                // Throttled status emission
                if last_status_emit.elapsed() >= status_emit_interval {
                    emit_status(app, true, processed, written, None);
                    last_status_emit = std::time::Instant::now();
                }
            }
            Err(e) => {
                // Timeout is expected, other errors should be logged
                if e.kind() != std::io::ErrorKind::WouldBlock {
                    emit_log(app, &format!("CAN read error: {}", e), "warn", None);
                }
            }
        }
    }

    // Finalize MDF4 file
    if let Some(writer) = mdf4_writer {
        writer.finalize()?;
        emit_log(app, "MDF4 file finalized", "success", None);
    }

    // Emit final status
    let stats = state.stats.lock();
    emit_status(
        app,
        false,
        stats.frames_processed,
        stats.frames_written,
        None,
    );

    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn run_can_workflow(
    _can_interface: &str,
    _mdf4_path: Option<&str>,
    _workflow: &Workflow,
    _state: &Arc<WorkflowState>,
    _app: &AppHandle,
) -> Result<(), String> {
    Err("CAN-sourced workflows require Linux with SocketCAN.".to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Execution - MDF4 Source
// ─────────────────────────────────────────────────────────────────────────────

fn run_mdf4_workflow(
    input_path: &str,
    mode: &str,
    loop_playback: bool,
    output_path: Option<&str>,
    workflow: &Workflow,
    state: &Arc<WorkflowState>,
    app: &AppHandle,
) -> Result<(), String> {
    use super::runtime::WorkflowRuntime;
    use mdf4_rs::MDF;

    // Open input MDF4 file
    let mdf = MDF::from_file(input_path).map_err(|e| {
        let msg = format!("Failed to open MDF4 file {}: {:?}", input_path, e);
        emit_error(app, &msg, None, true);
        msg
    })?;

    emit_log(
        app,
        &format!("Opened MDF4 input: {}", input_path),
        "info",
        None,
    );

    // Open MDF4 file for writing if specified
    let mut mdf4_writer: Option<Mdf4Writer> = if let Some(path) = output_path {
        emit_log(
            app,
            &format!("Creating MDF4 output: {}", path),
            "info",
            None,
        );
        Some(Mdf4Writer::new(path)?)
    } else {
        emit_log(app, "No MDF4 output configured", "warn", None);
        None
    };

    // Create workflow runtime (DAG executor)
    let mut runtime = WorkflowRuntime::new(workflow.clone(), app.clone()).inspect_err(|e| {
        emit_error(app, e, None, true);
    })?;

    emit_log(
        app,
        &format!(
            "Workflow runtime initialized with {} nodes",
            workflow.nodes.len()
        ),
        "info",
        None,
    );

    // Calculate timing for realtime playback
    let realtime = mode == "realtime";
    let mut first_timestamp: Option<f64> = None;

    // Emit initial status
    emit_status(app, true, 0, 0, None);

    // Track last status emit time for throttling
    let mut last_status_emit = std::time::Instant::now();
    let status_emit_interval = std::time::Duration::from_millis(100);
    let mut frame_count = 0u64;

    loop {
        // Reset runtime stats for each loop iteration
        runtime.reset_stats();
        let loop_start_time = std::time::Instant::now();

        // Stream CAN frames from the MDF file (memory-efficient iteration)
        // The iterator is created fresh each loop to support looping playback
        let frame_iter = iter_can_frames_from_mdf(&mdf);

        for can_frame in frame_iter {
            frame_count += 1;

            // Capture first timestamp for realtime playback
            if first_timestamp.is_none() {
                first_timestamp = Some(can_frame.timestamp);
            }

            // Check stop flag
            if *state.stop_flag.lock() {
                emit_log(app, "Workflow stop requested", "info", None);
                // Finalize and exit
                if let Some(writer) = mdf4_writer {
                    writer.finalize()?;
                    emit_log(app, "MDF4 file finalized", "success", None);
                }
                let stats = state.stats.lock();
                emit_status(
                    app,
                    false,
                    stats.frames_processed,
                    stats.frames_written,
                    None,
                );
                return Ok(());
            }

            // Realtime playback: wait for correct time
            if realtime {
                if let Some(first_ts) = first_timestamp {
                    let frame_offset_s = can_frame.timestamp - first_ts;
                    let target_elapsed = std::time::Duration::from_secs_f64(frame_offset_s);
                    let actual_elapsed = loop_start_time.elapsed();
                    if target_elapsed > actual_elapsed {
                        std::thread::sleep(target_elapsed - actual_elapsed);
                    }
                }
            }

            // Execute workflow DAG on this frame
            let output_frames = runtime.execute(vec![can_frame]);

            // Update stats and write output frames
            let (processed, written) = {
                let mut stats = state.stats.lock();
                let (runtime_processed, _) = runtime.stats();
                stats.frames_processed = runtime_processed;

                // Write output frames to MDF4 if configured
                if let Some(ref mut writer) = mdf4_writer {
                    for output_frame in &output_frames {
                        if writer.write_frame(output_frame).is_ok() {
                            stats.frames_written += 1;
                        }
                    }
                }

                (stats.frames_processed, stats.frames_written)
            };

            // Throttled status emission
            if last_status_emit.elapsed() >= status_emit_interval {
                emit_status(app, true, processed, written, None);
                last_status_emit = std::time::Instant::now();
            }
        }

        // Check if we should loop
        if !loop_playback {
            break;
        }

        emit_log(
            app,
            &format!("Looping MDF4 playback ({} frames processed)", frame_count),
            "info",
            None,
        );
        first_timestamp = None; // Reset for next loop iteration timing
    }

    // Finalize MDF4 file
    if let Some(writer) = mdf4_writer {
        writer.finalize()?;
        emit_log(app, "MDF4 file finalized", "success", None);
    }

    // Emit final status
    let stats = state.stats.lock();
    emit_status(
        app,
        false,
        stats.frames_processed,
        stats.frames_written,
        None,
    );
    emit_log(
        app,
        &format!("Processed {} frames total", frame_count),
        "info",
        None,
    );

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Execution - Simulator Source (Linux SocketCAN for bus output)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
#[allow(clippy::too_many_arguments)]
fn run_simulator_workflow(
    interface: &str,
    rate_hz: f64,
    mode: &str,
    script: &str,
    mdf4_path: Option<&str>,
    workflow: &Workflow,
    state: &Arc<WorkflowState>,
    app: &AppHandle,
) -> Result<(), String> {
    use super::runtime::WorkflowRuntime;
    use crate::simulator::engine::CompiledScript;
    use socketcan::{CanSocket, EmbeddedFrame, Socket, StandardId};

    // Compile script if provided
    let mut compiled_script = if !script.is_empty() {
        emit_log(app, "Compiling simulator script...", "info", None);
        Some(CompiledScript::compile(script, None).map_err(|e| {
            let msg = format!("Script compile error: {:?}", e);
            emit_error(app, &msg, None, true);
            msg
        })?)
    } else {
        None
    };

    // Open CAN socket for output if interface specified
    let socket = if !interface.is_empty() {
        emit_log(
            app,
            &format!("Opening CAN socket: {}", interface),
            "info",
            None,
        );
        Some(CanSocket::open(interface).map_err(|e| {
            let msg = format!("Failed to open CAN socket {}: {}", interface, e);
            emit_error(app, &msg, None, true);
            msg
        })?)
    } else {
        None
    };

    // Open MDF4 file for writing if specified
    let mut mdf4_writer: Option<Mdf4Writer> = if let Some(path) = mdf4_path {
        emit_log(
            app,
            &format!("Creating MDF4 output: {}", path),
            "info",
            None,
        );
        Some(Mdf4Writer::new(path)?)
    } else {
        None
    };

    // Create workflow runtime (DAG executor)
    let mut runtime = WorkflowRuntime::new(workflow.clone(), app.clone()).inspect_err(|e| {
        emit_error(app, e, None, true);
    })?;

    emit_log(
        app,
        &format!(
            "Workflow runtime initialized with {} nodes",
            workflow.nodes.len()
        ),
        "info",
        None,
    );
    emit_log(
        app,
        &format!(
            "Simulator: {}Hz, mode={}, script={}",
            rate_hz,
            mode,
            if script.is_empty() { "none" } else { "loaded" }
        ),
        "info",
        None,
    );

    // Emit initial status
    emit_status(app, true, 0, 0, None);

    // Calculate frame interval
    let frame_interval = std::time::Duration::from_secs_f64(1.0 / rate_hz);
    let mut last_frame_time = std::time::Instant::now();
    let mut last_status_emit = std::time::Instant::now();
    let status_emit_interval = std::time::Duration::from_millis(100);
    let start_time = std::time::Instant::now();

    // Main loop
    loop {
        // Check stop flag
        if *state.stop_flag.lock() {
            emit_log(app, "Simulator workflow stop requested", "info", None);
            break;
        }

        // Rate limiting
        let elapsed = last_frame_time.elapsed();
        if elapsed < frame_interval {
            std::thread::sleep(frame_interval - elapsed);
        }
        last_frame_time = std::time::Instant::now();

        // Generate frames from script
        let frames = if let Some(ref mut script) = compiled_script {
            let time_ms = start_time.elapsed().as_millis() as u64;
            let _ = script.on_tick(time_ms);

            // Forward script logs to frontend
            for log_msg in script.take_logs() {
                emit_log(app, &log_msg, "info", Some("simulator"));
            }

            let outgoing = script.take_frames();
            outgoing
                .into_iter()
                .map(|f| CanFrameDto {
                    can_id: f.id,
                    data: f.data.clone(),
                    timestamp: start_time.elapsed().as_secs_f64(),
                    is_extended: f.extended,
                    is_fd: f.fd,
                    brs: false,
                    esi: false,
                    dlc: f.data.len() as u8,
                    channel: interface.to_string(),
                })
                .collect::<Vec<_>>()
        } else {
            // No script - generate a test frame
            vec![CanFrameDto {
                can_id: 0x100,
                data: vec![0, 0, 0, 0, 0, 0, 0, 0],
                timestamp: start_time.elapsed().as_secs_f64(),
                is_extended: false,
                is_fd: false,
                brs: false,
                esi: false,
                dlc: 8,
                channel: interface.to_string(),
            }]
        };

        if frames.is_empty() {
            continue;
        }

        // Send frames to CAN interface if configured
        if let Some(ref socket) = socket {
            for frame in &frames {
                if let Some(id) = StandardId::new(frame.can_id as u16) {
                    let can_frame = socketcan::CanFrame::new(id, &frame.data).unwrap();
                    let _ = socket.write_frame(&can_frame);
                }
            }
        }

        // Execute workflow DAG on these frames
        let output_frames = runtime.execute(frames);

        // Update stats and write output frames
        {
            let mut stats = state.stats.lock();
            let (runtime_processed, _) = runtime.stats();
            stats.frames_processed = runtime_processed;

            // Write output frames to MDF4 if configured
            if let Some(ref mut writer) = mdf4_writer {
                for frame in &output_frames {
                    if writer.write_frame(frame).is_ok() {
                        stats.frames_written += 1;
                    }
                }
            }
        }

        // Throttled status emit
        if last_status_emit.elapsed() >= status_emit_interval {
            let stats = state.stats.lock();
            emit_status(
                app,
                true,
                stats.frames_processed,
                stats.frames_written,
                None,
            );
            last_status_emit = std::time::Instant::now();
        }
    }

    // Finalize MDF4 file
    if let Some(writer) = mdf4_writer {
        writer.finalize()?;
        emit_log(app, "MDF4 file finalized", "success", None);
    }

    // Emit final status
    let stats = state.stats.lock();
    emit_status(
        app,
        false,
        stats.frames_processed,
        stats.frames_written,
        None,
    );

    Ok(())
}

#[cfg(not(target_os = "linux"))]
#[allow(clippy::too_many_arguments)]
fn run_simulator_workflow(
    _interface: &str,
    _rate_hz: f64,
    _mode: &str,
    _script: &str,
    _mdf4_path: Option<&str>,
    _workflow: &Workflow,
    _state: &Arc<WorkflowState>,
    _app: &AppHandle,
) -> Result<(), String> {
    Err("Simulator workflows with CAN output require Linux with SocketCAN.".to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// MDF4 Frame Reader (Streaming)
// ─────────────────────────────────────────────────────────────────────────────

/// Streaming iterator over CAN frames from an MDF4 file.
///
/// This iterator processes frames one at a time without loading the entire file
/// into memory. It uses the new `iter_values()` method from mdf4-rs to stream
/// decoded values on-demand.
fn iter_can_frames_from_mdf(mdf: &mdf4_rs::MDF) -> impl Iterator<Item = CanFrameDto> + '_ {
    mdf.channel_groups().into_iter().flat_map(|cg| {
        let channels = cg.channels();

        // Get channel name for FD detection
        let channel_name = cg
            .source()
            .ok()
            .flatten()
            .and_then(|s| s.name)
            .or_else(|| cg.name().ok().flatten())
            .unwrap_or_default();

        // Find Timestamp and CAN_DataFrame channels
        let mut timestamp_ch = None;
        let mut dataframe_ch = None;

        for ch in channels.iter() {
            let name = ch.name().ok().flatten().unwrap_or_default();
            match name.as_str() {
                "Timestamp" => timestamp_ch = Some(ch),
                "CAN_DataFrame" => dataframe_ch = Some(ch),
                _ => {}
            }
        }

        // Create streaming iterators if both channels exist
        let iter: Box<dyn Iterator<Item = CanFrameDto>> = if let (Some(ts_ch), Some(df_ch)) =
            (timestamp_ch, dataframe_ch)
        {
            // Try to create streaming iterators
            match (ts_ch.iter_values(), df_ch.iter_values()) {
                (Ok(ts_iter), Ok(df_iter)) => {
                    let channel_name_owned = channel_name.clone();
                    Box::new(ts_iter.zip(df_iter).enumerate().filter_map(
                        move |(i, (ts_result, df_result))| {
                            // Parse timestamp
                            let timestamp = ts_result
                                .ok()
                                .flatten()
                                .and_then(|v| v.as_f64())
                                .map(|t| if t > 1e9 { t / 1_000_000.0 } else { t })
                                .unwrap_or(i as f64 * 0.001);

                            // Parse dataframe
                            if let Ok(Some(mdf4_rs::DecodedValue::ByteArray(bytes))) = df_result {
                                parse_can_dataframe(&bytes, timestamp, &channel_name_owned)
                            } else {
                                None
                            }
                        },
                    ))
                }
                _ => Box::new(std::iter::empty()),
            }
        } else {
            Box::new(std::iter::empty())
        };

        iter
    })
}

/// Read CAN frames from an MDF4 file (ASAM CAN_DataFrame format).
///
/// Note: For large files (1GB+), prefer using `iter_can_frames_from_mdf` instead
/// to avoid loading all frames into memory at once.
#[allow(dead_code)]
fn read_can_frames_from_mdf(mdf: &mdf4_rs::MDF) -> Result<Vec<CanFrameDto>, String> {
    let mut frames = Vec::new();

    for cg in mdf.channel_groups() {
        let channels = cg.channels();

        // Get channel name for FD detection
        let channel_name = cg
            .source()
            .ok()
            .flatten()
            .and_then(|s| s.name)
            .or_else(|| cg.name().ok().flatten())
            .unwrap_or_default();

        // Find Timestamp and CAN_DataFrame channels
        let mut timestamp_ch = None;
        let mut dataframe_ch = None;

        for ch in channels.iter() {
            let name = ch.name().ok().flatten().unwrap_or_default();
            match name.as_str() {
                "Timestamp" => timestamp_ch = Some(ch),
                "CAN_DataFrame" => dataframe_ch = Some(ch),
                _ => {}
            }
        }

        // Process CAN_DataFrame channel
        if let (Some(ts_ch), Some(df_ch)) = (timestamp_ch, dataframe_ch) {
            let timestamps = ts_ch.values().unwrap_or_default();
            let dataframes = df_ch.values().unwrap_or_default();

            for (i, (ts_opt, df_opt)) in timestamps.iter().zip(dataframes.iter()).enumerate() {
                // Parse timestamp
                let timestamp = ts_opt
                    .as_ref()
                    .and_then(|v| v.as_f64())
                    .map(|t| if t > 1e9 { t / 1_000_000.0 } else { t })
                    .unwrap_or(i as f64 * 0.001);

                if let Some(mdf4_rs::DecodedValue::ByteArray(bytes)) = df_opt {
                    if let Some(frame) = parse_can_dataframe(bytes, timestamp, &channel_name) {
                        frames.push(frame);
                    }
                }
            }
        }
    }

    if frames.is_empty() {
        return Err("No CAN data found in MDF4 file".to_string());
    }

    Ok(frames)
}

// ─────────────────────────────────────────────────────────────────────────────
// MDF4 Writer (using mdf4-rs RawCanLogger)
// ─────────────────────────────────────────────────────────────────────────────

struct Mdf4Writer {
    path: String,
    logger: mdf4_rs::can::RawCanLogger<mdf4_rs::writer::VecWriter>,
    frame_count: u64,
}

impl Mdf4Writer {
    fn new(path: &str) -> Result<Self, String> {
        let logger = mdf4_rs::can::RawCanLogger::new()
            .map_err(|e| format!("Failed to create MDF4 logger: {:?}", e))?;

        Ok(Self {
            path: path.to_string(),
            logger,
            frame_count: 0,
        })
    }

    fn write_frame(&mut self, frame: &CanFrameDto) -> Result<(), String> {
        use mdf4_rs::can::FdFlags;

        let timestamp_us = (frame.timestamp * 1_000_000.0) as u64;

        if frame.is_fd {
            let flags = FdFlags::new(frame.brs, frame.esi);
            if frame.is_extended {
                self.logger
                    .log_fd_extended(frame.can_id, timestamp_us, &frame.data, flags);
            } else {
                self.logger
                    .log_fd(frame.can_id, timestamp_us, &frame.data, flags);
            }
        } else if frame.is_extended {
            self.logger
                .log_extended(frame.can_id, timestamp_us, &frame.data);
        } else {
            self.logger.log(frame.can_id, timestamp_us, &frame.data);
        }

        self.frame_count += 1;
        Ok(())
    }

    fn finalize(self) -> Result<(), String> {
        let bytes = self
            .logger
            .finalize()
            .map_err(|e| format!("Failed to finalize MDF4: {:?}", e))?;

        std::fs::write(&self.path, bytes)
            .map_err(|e| format!("Failed to write MDF4 file: {}", e))?;

        log::info!("Wrote {} frames to {}", self.frame_count, self.path);

        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Script Validation
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn workflow_validate_script(script: String) -> super::script_engine::ValidationResult {
    super::script_engine::validate_workflow_script(&script)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycle Detection
// ─────────────────────────────────────────────────────────────────────────────

/// Check if adding a connection would create a cycle in the workflow graph.
/// Uses BFS to check if `to_node` can reach `from_node`.
#[tauri::command]
pub fn workflow_would_create_cycle(
    connections: Vec<WorkflowConnection>,
    from_node: String,
    to_node: String,
) -> bool {
    use std::collections::{HashSet, VecDeque};

    // BFS to check if to_node can reach from_node
    let mut visited = HashSet::new();
    let mut queue = VecDeque::new();
    queue.push_back(to_node.clone());

    while let Some(current) = queue.pop_front() {
        if current == from_node {
            return true;
        }
        if visited.contains(&current) {
            continue;
        }
        visited.insert(current.clone());

        // Find all nodes that current connects to
        for conn in &connections {
            if conn.from_node == current {
                queue.push_back(conn.to_node.clone());
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn test_no_cycle() {
        let connections = vec![make_connection("A", "B"), make_connection("B", "C")];
        // Adding A->C would not create a cycle
        assert!(!workflow_would_create_cycle(
            connections,
            "A".into(),
            "C".into()
        ));
    }

    #[test]
    fn test_direct_cycle() {
        let connections = vec![make_connection("A", "B")];
        // Adding B->A would create a cycle
        assert!(workflow_would_create_cycle(
            connections,
            "B".into(),
            "A".into()
        ));
    }

    #[test]
    fn test_indirect_cycle() {
        let connections = vec![make_connection("A", "B"), make_connection("B", "C")];
        // Adding C->A would create a cycle
        assert!(workflow_would_create_cycle(
            connections,
            "C".into(),
            "A".into()
        ));
    }
}
