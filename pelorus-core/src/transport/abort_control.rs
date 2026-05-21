//! `MultiFrameControl{Abort}` fields (`03-data-link.md` §4.2).

use super::TransportReasonCode;

/// Session abort.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AbortControl {
    /// Session identifier.
    pub session_id: u16,
    /// Abort reason.
    pub reason_code: TransportReasonCode,
}
