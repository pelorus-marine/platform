//! `Pelorus.MultiFrameData` frame (`03-data-link.md` §4.3).

use crate::bus::CanFdFrame;
use crate::wire::{
    pack_identifier, unpack_identifier, DC_ID_MULTIFRAME_DATA, PRIORITY_MULTIFRAME,
};

use super::session_limits::MULTIFRAME_DATA_CHUNK;

/// One data frame in a multi-frame session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MultiframeData {
    /// Originator source address.
    pub source_address: u8,
    /// Session identifier.
    pub session_id: u16,
    /// Sequence number (first frame = 0).
    pub sequence_number: u32,
    /// Payload chunk (up to 58 bytes).
    pub data: pelorus_bounded::Vec<u8, MULTIFRAME_DATA_CHUNK>,
}

impl MultiframeData {
    /// Encode as CAN FD frame.
    pub fn into_can_frame(self) -> Result<CanFdFrame, pelorus_bounded::Error> {
        let id = pack_identifier(
            PRIORITY_MULTIFRAME,
            DC_ID_MULTIFRAME_DATA,
            self.source_address,
        );
        let chunk = self.data.as_slice();
        let mut payload = [0u8; 6 + MULTIFRAME_DATA_CHUNK];
        payload[0..2].copy_from_slice(&self.session_id.to_le_bytes());
        payload[2..6].copy_from_slice(&self.sequence_number.to_le_bytes());
        let n = chunk.len().min(MULTIFRAME_DATA_CHUNK);
        payload[6..6 + n].copy_from_slice(&chunk[..n]);
        Ok(CanFdFrame::new_fd(id, &payload[..6 + n]))
    }

    /// Parse `Pelorus.MultiFrameData`.
    pub fn parse(id: u32, payload: &[u8]) -> Option<Self> {
        let parts = unpack_identifier(id);
        if parts.dc_id != DC_ID_MULTIFRAME_DATA || payload.len() < 6 {
            return None;
        }
        let session_id = u16::from_le_bytes([payload[0], payload[1]]);
        let sequence_number = u32::from_le_bytes([
            payload[2], payload[3], payload[4], payload[5],
        ]);
        let mut data = pelorus_bounded::Vec::new();
        data.extend_from_slice(&payload[6..])
            .ok()?;
        Some(Self {
            source_address: parts.source_address,
            session_id,
            sequence_number,
            data,
        })
    }
}
