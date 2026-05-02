//! CAN frame decoding using DBC definitions.

use crate::dto::{CanFrameDto, DecodedSignalDto};
use dbc_rs::Dbc;

/// Result of decoding a frame - either signals or an error message.
pub enum DecodeResult {
    Signals(Vec<DecodedSignalDto>),
    Error(String),
}

/// Decode a CAN frame using dbc-rs, returning signals or an error.
pub fn decode_frame(frame: &CanFrameDto, dbc: &Dbc) -> DecodeResult {
    let decoded = match dbc.decode(frame.can_id, &frame.data, frame.is_extended) {
        Ok(signals) => signals,
        Err(e) => {
            let msg = format!(
                "Frame 0x{:X}: {} (DLC={}, data={} bytes)",
                frame.can_id,
                e,
                frame.dlc,
                frame.data.len()
            );
            log::warn!("Decode error: {}", msg);
            return DecodeResult::Error(msg);
        }
    };

    // Get message name for the signals
    let message_name = dbc
        .messages()
        .find_by_id(if frame.is_extended {
            frame.can_id | 0x80000000
        } else {
            frame.can_id
        })
        .map(|m| m.name())
        .unwrap_or("Unknown");

    DecodeResult::Signals(
        decoded
            .iter()
            .map(|sig| DecodedSignalDto::from_dbc_signal(sig, frame.timestamp, message_name))
            .collect(),
    )
}
