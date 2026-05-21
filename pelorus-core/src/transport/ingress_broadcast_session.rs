//! Broadcast multi-frame receiver (`03-data-link.md` §4.5).

use pelorus_bounded::Vec;

use super::{
    BroadcastOpenControl, IngressResult, MultiframeData, TransportReasonCode, crc32,
    session_limits::{DEFAULT_REASSEMBLY_CAP, MULTIFRAME_DATA_CHUNK},
};

/// Single broadcast ingress session (v1.0: one per node).
#[derive(Debug, Clone)]
pub struct IngressBroadcastSession {
    active: bool,
    session_id: u16,
    total_size: u32,
    content_crc32: u32,
    filled: u32,
    buffer: Vec<u8, DEFAULT_REASSEMBLY_CAP>,
}

impl Default for IngressBroadcastSession {
    fn default() -> Self {
        Self::new()
    }
}

impl IngressBroadcastSession {
    /// Idle receiver.
    #[must_use]
    pub fn new() -> Self {
        Self {
            active: false,
            session_id: 0,
            total_size: 0,
            content_crc32: 0,
            filled: 0,
            buffer: Vec::new(),
        }
    }

    /// `true` when a session is open.
    #[must_use]
    pub const fn is_active(&self) -> bool {
        self.active
    }

    /// Reassembled bytes (valid only after [`IngressResult::Complete`]).
    #[must_use]
    pub fn payload(&self) -> &[u8] {
        &self.buffer.as_slice()[..self.total_size as usize]
    }

    /// Open a broadcast session (`03` §4.5 step 1).
    pub fn open(&mut self, open: BroadcastOpenControl) -> IngressResult {
        if self.active {
            return IngressResult::Rejected(TransportReasonCode::SessionExists);
        }
        if open.total_size as usize > DEFAULT_REASSEMBLY_CAP {
            return IngressResult::Rejected(TransportReasonCode::NoResources);
        }
        self.buffer.clear();
        for _ in 0..open.total_size {
            if self.buffer.push(0).is_err() {
                self.active = false;
                return IngressResult::Rejected(TransportReasonCode::NoResources);
            }
        }
        self.active = true;
        self.session_id = open.session_id;
        self.total_size = open.total_size;
        self.content_crc32 = open.content_crc32;
        self.filled = 0;
        IngressResult::InProgress
    }

    /// Ingest one `Pelorus.MultiFrameData` frame.
    pub fn on_data(&mut self, data: &MultiframeData) -> IngressResult {
        if !self.active || data.session_id != self.session_id {
            return IngressResult::Rejected(TransportReasonCode::ProtocolError);
        }
        let offset = data
            .sequence_number
            .saturating_mul(MULTIFRAME_DATA_CHUNK as u32) as usize;
        let chunk = data.data.as_slice();
        if offset + chunk.len() > self.total_size as usize {
            return IngressResult::Rejected(TransportReasonCode::ProtocolError);
        }
        self.buffer.as_mut_slice()[offset..offset + chunk.len()].copy_from_slice(chunk);
        self.filled = self.filled.saturating_add(chunk.len() as u32);
        if self.filled < self.total_size {
            return IngressResult::InProgress;
        }
        let payload = &self.buffer.as_slice()[..self.total_size as usize];
        if crc32(payload) != self.content_crc32 {
            self.active = false;
            return IngressResult::CrcMismatch;
        }
        self.active = false;
        IngressResult::Complete
    }
}

// pelorus_bounded::Vec has no push_at — need to write directly into inner buffer
// Check pelorus_bounded Vec API
