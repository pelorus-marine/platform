//! `MultiFrameControl{OpenNak}` fields (`03-data-link.md` §4.2).

use super::TransportReasonCode;

/// Negative open response.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OpenNakControl {
    /// Session identifier.
    pub session_id: u16,
    /// Rejection reason.
    pub reason_code: TransportReasonCode,
}
