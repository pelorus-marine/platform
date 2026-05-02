//! MDF4 file loading, parsing, and export commands.

use crate::dto::{CanFrameDto, DecodedSignalDto};
use crate::state::AppState;
use mdf4_rs::can::{FdFlags, RawCanLogger};
use std::sync::Arc;
use tauri::State;

/// Load an MDF4 file and extract CAN frames.
///
/// Supports the ASAM MDF4 Bus Logging format with CAN_DataFrame channel.
/// Uses FastDbc for O(1) message lookup and zero-allocation decoding.
#[tauri::command]
pub async fn load_mdf4(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(Vec<CanFrameDto>, Vec<DecodedSignalDto>), String> {
    let mdf =
        mdf4_rs::MDF::from_file(&path).map_err(|e| format!("Failed to open MDF4: {:?}", e))?;

    let mut frames = Vec::new();
    let mut decoded_signals = Vec::new();

    // Use FastDbc for O(1) lookup and zero-allocation decoding
    // FastDbc also provides access to value descriptions via .dbc()
    let fast_dbc_guard = state.fast_dbc.lock();
    let fast_dbc = fast_dbc_guard.as_ref();

    // Pre-allocate decode buffers if we have a DBC
    let mut decode_buffer = fast_dbc
        .map(|f| vec![0.0f64; f.max_signals()])
        .unwrap_or_default();
    let mut raw_buffer = fast_dbc
        .map(|f| vec![0i64; f.max_signals()])
        .unwrap_or_default();

    for cg in mdf.channel_groups() {
        let channels = cg.channels();
        // Prefer source name (e.g., "CAN1") over group name (e.g., "CAN_DataFrame")
        let channel_name = cg
            .source()
            .ok()
            .flatten()
            .and_then(|s| s.name)
            .or_else(|| cg.name().ok().flatten())
            .unwrap_or_default();

        // Find Timestamp and CAN_DataFrame channels (ASAM MDF4 Bus Logging format)
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
                // Parse timestamp (can be Float seconds or UInt microseconds)
                let timestamp = ts_opt
                    .as_ref()
                    .and_then(|v| v.as_f64())
                    .map(|t| {
                        // If timestamp is very large, it's probably microseconds
                        if t > 1e9 { t / 1_000_000.0 } else { t }
                    })
                    .unwrap_or(i as f64 * 0.001);

                if let Some(mdf4_rs::DecodedValue::ByteArray(bytes)) = df_opt {
                    if let Some(frame) = parse_can_dataframe(bytes, timestamp, &channel_name) {
                        // Decode using FastDbc (O(1) lookup + zero-allocation)
                        if let Some(fast) = fast_dbc {
                            let msg = if frame.is_extended {
                                fast.get_extended(frame.can_id)
                            } else {
                                fast.get(frame.can_id)
                            };

                            if let Some(msg) = msg {
                                // Decode physical and raw values into pre-allocated buffers
                                let count = msg.decode_into(&frame.data, &mut decode_buffer);
                                msg.decode_raw_into(&frame.data, &mut raw_buffer);
                                let message_name = msg.name();
                                let msg_id = msg.id();

                                for (idx, signal) in msg.signals().iter().enumerate().take(count) {
                                    let signal_name = signal.name();
                                    let raw_value = raw_buffer[idx];

                                    // Look up value description from DBC (VAL_ entries)
                                    // Use u64::try_from since value descriptions use unsigned keys
                                    let description =
                                        u64::try_from(raw_value).ok().and_then(|rv| {
                                            fast.dbc()
                                                .value_descriptions_for_signal(msg_id, signal_name)
                                                .and_then(|vd| vd.get(rv).map(|s| s.to_string()))
                                        });

                                    decoded_signals.push(DecodedSignalDto {
                                        timestamp: frame.timestamp,
                                        message_name: message_name.to_string(),
                                        signal_name: signal_name.to_string(),
                                        value: decode_buffer[idx],
                                        raw_value,
                                        unit: signal.unit().unwrap_or("").to_string(),
                                        description,
                                    });
                                }
                            }
                        }
                        frames.push(frame);
                    }
                }
            }
        }
    }

    if frames.is_empty() {
        return Err(
            "No CAN data found in MDF4 file. Expected ASAM CAN_DataFrame format.".to_string(),
        );
    }

    // Persist the MDF4 path for next session
    if let Err(e) = state.session.lock().set_mdf4_path(Some(path.clone())) {
        log::warn!("Failed to save MDF4 path: {}", e);
    }

    Ok((frames, decoded_signals))
}

/// Parse a CAN_DataFrame ByteArray into a CanFrameDto.
///
/// ASAM CAN_DataFrame format:
/// - Bytes 0-3: CAN ID (little-endian, bit 31 = extended ID flag)
/// - Byte 4: DLC
/// - Bytes 5+: Data (8 bytes for classic CAN, up to 64 for CAN FD)
///
/// For CAN FD with DLC > 8, byte 5 contains FD flags (BRS, ESI).
pub fn parse_can_dataframe(
    bytes: &[u8],
    timestamp: f64,
    channel_name: &str,
) -> Option<CanFrameDto> {
    if bytes.len() < 5 {
        return None;
    }

    // Parse CAN ID (bytes 0-3, little-endian)
    let raw_id = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    let is_extended = (raw_id & 0x8000_0000) != 0;
    let can_id = raw_id & 0x1FFF_FFFF; // Mask off extended flag

    // Parse DLC (byte 4)
    let dlc = bytes[4];
    let data_len = mdf4_rs::can::dlc_to_len(dlc);

    // Determine if this is CAN FD based on group name or data length
    let is_fd = channel_name.contains("FD") || data_len > 8;

    // Parse data and FD flags
    let (data, brs, esi) = if is_fd && bytes.len() > 6 && data_len > 8 {
        // CAN FD with large data: byte 5 = FD flags, bytes 6+ = data
        let fd_flags = bytes[5];
        let brs = (fd_flags & 0x01) != 0;
        let esi = (fd_flags & 0x02) != 0;
        let data_start = 6;
        let data_end = (data_start + data_len).min(bytes.len());
        let data: Vec<u8> = bytes[data_start..data_end].to_vec();
        (data, brs, esi)
    } else {
        // Classic CAN or CAN FD with small data: bytes 5+ = data
        let data_start = 5;
        let data_end = (data_start + data_len).min(bytes.len());
        let data: Vec<u8> = bytes[data_start..data_end].to_vec();
        (data, false, false)
    };

    let mut frame = CanFrameDto::from_mdf4(timestamp, channel_name.to_string(), can_id, dlc, data);
    frame.is_extended = is_extended;
    frame.is_fd = is_fd;
    frame.brs = brs;
    frame.esi = esi;

    Some(frame)
}

/// Export CAN frames to an MDF4 file.
///
/// Takes a list of frames and writes them to the specified path as an MDF4 file
/// using the ASAM MDF4 Bus Logging CAN_DataFrame format.
#[tauri::command]
pub async fn export_logs(path: String, frames: Vec<CanFrameDto>) -> Result<usize, String> {
    if frames.is_empty() {
        return Err("No frames to export".to_string());
    }

    let mut logger =
        RawCanLogger::new().map_err(|e| format!("Failed to create logger: {:?}", e))?;

    for frame in &frames {
        // Convert timestamp from seconds to microseconds
        let timestamp_us = (frame.timestamp * 1_000_000.0) as u64;

        if frame.is_fd {
            // CAN FD frame
            let flags = FdFlags::new(frame.brs, frame.esi);
            if frame.is_extended {
                logger.log_fd_extended(frame.can_id, timestamp_us, &frame.data, flags);
            } else {
                logger.log_fd(frame.can_id, timestamp_us, &frame.data, flags);
            }
        } else {
            // Classic CAN frame
            if frame.is_extended {
                logger.log_extended(frame.can_id, timestamp_us, &frame.data);
            } else {
                logger.log(frame.can_id, timestamp_us, &frame.data);
            }
        }
    }

    let mdf_bytes = logger
        .finalize()
        .map_err(|e| format!("Failed to finalize MDF4: {:?}", e))?;

    std::fs::write(&path, &mdf_bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(frames.len())
}
