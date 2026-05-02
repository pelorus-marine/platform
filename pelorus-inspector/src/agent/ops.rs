//! Core MDF4 / DBC / VSS operations without Tauri — used by commands and `pelorus-agent`.

use crate::decode::{DecodeResult, decode_frame};
use crate::dto::{CanFrameDto, DecodeResponse, DecodedSignalDto, VssSnapshotDto};
use crate::state::AppState;
use crate::vss::{catalog_to_snapshot_dto, parse_catalog_yaml};
use dbc_rs::Dbc;
use mdf4_rs::can::{FdFlags, RawCanLogger};

/// Decode CAN frames using the DBC (+ optional VSS match index) held in `state`.
pub fn decode_frames(state: &AppState, frames: &[CanFrameDto]) -> DecodeResponse {
    let dbc_guard = state.dbc.lock();
    let vss_match = state.vss_match.lock().clone();
    let Some(ref dbc) = *dbc_guard else {
        return DecodeResponse {
            signals: Vec::new(),
            errors: Vec::new(),
        };
    };

    let mut signals = Vec::new();
    let mut errors = Vec::new();

    for frame in frames {
        match decode_frame(frame, dbc, vss_match.as_ref()) {
            DecodeResult::Signals(sigs) => signals.extend(sigs),
            DecodeResult::Error(err) => errors.push(err),
        }
    }

    DecodeResponse { signals, errors }
}

/// Load and parse a DBC file into `state` (session path optional persistence).
pub fn load_dbc(state: &AppState, path: &str) -> Result<String, String> {
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read DBC: {}", e))?;

    let dbc = Dbc::parse(&content).map_err(|e| format!("Failed to parse DBC: {:?}", e))?;
    let msg_count = dbc.messages().len();

    state.set_dbc(dbc);
    *state.dbc_path.lock() = Some(path.to_string());

    if let Err(e) = state.session.lock().set_dbc_path(Some(path.to_string())) {
        log::warn!("Failed to save session: {}", e);
    }

    Ok(format!("Loaded {} messages", msg_count))
}

/// Load a `.vspec` YAML catalog into `state`.
pub fn load_vss(state: &AppState, path: &str) -> Result<VssSnapshotDto, String> {
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read VSS file: {e}"))?;
    let catalog = parse_catalog_yaml(&content)?;
    state.set_vss_catalog(Some(catalog));
    *state.vss_path.lock() = Some(path.to_string());
    if let Err(e) = state.session.lock().set_vss_path(Some(path.to_string())) {
        log::warn!("Failed to persist VSS session path: {}", e);
    }
    Ok(catalog_to_snapshot_dto(
        state.vss_catalog.lock().as_ref().unwrap(),
    ))
}

/// Extract CAN frames (and optionally decoded signals) from an MDF4 bus log.
pub fn load_mdf4(
    state: &AppState,
    path: &str,
) -> Result<(Vec<CanFrameDto>, Vec<DecodedSignalDto>), String> {
    let mdf = mdf4_rs::MDF::from_file(path).map_err(|e| format!("Failed to open MDF4: {:?}", e))?;

    let mut frames = Vec::new();
    let mut decoded_signals = Vec::new();

    let fast_dbc_guard = state.fast_dbc.lock();
    let fast_dbc = fast_dbc_guard.as_ref();
    let vss_match = state.vss_match.lock().clone();

    let mut decode_buffer = fast_dbc
        .map(|f| vec![0.0f64; f.max_signals()])
        .unwrap_or_default();
    let mut raw_buffer = fast_dbc
        .map(|f| vec![0i64; f.max_signals()])
        .unwrap_or_default();

    for cg in mdf.channel_groups() {
        let channels = cg.channels();
        let channel_name = cg
            .source()
            .ok()
            .flatten()
            .and_then(|s| s.name)
            .or_else(|| cg.name().ok().flatten())
            .unwrap_or_default();

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

        if let (Some(ts_ch), Some(df_ch)) = (timestamp_ch, dataframe_ch) {
            let timestamps = ts_ch.values().unwrap_or_default();
            let dataframes = df_ch.values().unwrap_or_default();

            for (i, (ts_opt, df_opt)) in timestamps.iter().zip(dataframes.iter()).enumerate() {
                let timestamp = ts_opt
                    .as_ref()
                    .and_then(|v| v.as_f64())
                    .map(|t| if t > 1e9 { t / 1_000_000.0 } else { t })
                    .unwrap_or(i as f64 * 0.001);

                if let Some(mdf4_rs::DecodedValue::ByteArray(bytes)) = df_opt {
                    if let Some(frame) = parse_can_dataframe(bytes, timestamp, &channel_name) {
                        if let Some(fast) = fast_dbc {
                            let msg = if frame.is_extended {
                                fast.get_extended(frame.can_id)
                            } else {
                                fast.get(frame.can_id)
                            };

                            if let Some(msg) = msg {
                                let count = msg.decode_into(&frame.data, &mut decode_buffer);
                                msg.decode_raw_into(&frame.data, &mut raw_buffer);
                                let message_name = msg.name();
                                let msg_id = msg.id();

                                for (idx, signal) in msg.signals().iter().enumerate().take(count) {
                                    let signal_name = signal.name();
                                    let raw_value = raw_buffer[idx];

                                    let description =
                                        u64::try_from(raw_value).ok().and_then(|rv| {
                                            fast.dbc()
                                                .value_descriptions_for_signal(msg_id, signal_name)
                                                .and_then(|vd| vd.get(rv).map(|s| s.to_string()))
                                        });

                                    let vessel_path = vss_match
                                        .as_ref()
                                        .and_then(|m| m.lookup(signal_name))
                                        .map(std::string::ToString::to_string);
                                    decoded_signals.push(DecodedSignalDto {
                                        timestamp: frame.timestamp,
                                        message_name: message_name.to_string(),
                                        signal_name: signal_name.to_string(),
                                        value: decode_buffer[idx],
                                        raw_value,
                                        unit: signal.unit().unwrap_or("").to_string(),
                                        description,
                                        vessel_path,
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

    if let Err(e) = state.session.lock().set_mdf4_path(Some(path.to_string())) {
        log::warn!("Failed to save MDF4 path: {}", e);
    }

    Ok((frames, decoded_signals))
}

/// Parse an MDF `CAN_DataFrame` channel blob into a [`CanFrameDto`].
pub fn parse_can_dataframe(
    bytes: &[u8],
    timestamp: f64,
    channel_name: &str,
) -> Option<CanFrameDto> {
    if bytes.len() < 5 {
        return None;
    }

    let raw_id = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    let is_extended = (raw_id & 0x8000_0000) != 0;
    let can_id = raw_id & 0x1FFF_FFFF;

    let dlc = bytes[4];
    let data_len = mdf4_rs::can::dlc_to_len(dlc);

    let is_fd = channel_name.contains("FD") || data_len > 8;

    let (data, brs, esi) = if is_fd && bytes.len() > 6 && data_len > 8 {
        let fd_flags = bytes[5];
        let brs = (fd_flags & 0x01) != 0;
        let esi = (fd_flags & 0x02) != 0;
        let data_start = 6;
        let data_end = (data_start + data_len).min(bytes.len());
        let data: Vec<u8> = bytes[data_start..data_end].to_vec();
        (data, brs, esi)
    } else {
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

/// Write decoded CAN frames as MDF4 bus logging (same layout Inspector export uses).
pub fn export_can_frames_to_mdf4_path(path: &str, frames: &[CanFrameDto]) -> Result<usize, String> {
    if frames.is_empty() {
        return Err("No frames to export".to_string());
    }

    let mut logger =
        RawCanLogger::new().map_err(|e| format!("Failed to create logger: {:?}", e))?;

    for frame in frames {
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

    let mdf_bytes = logger
        .finalize()
        .map_err(|e| format!("Failed to finalize MDF4: {:?}", e))?;

    std::fs::write(path, &mdf_bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(frames.len())
}
