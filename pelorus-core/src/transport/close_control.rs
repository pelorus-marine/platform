//! `MultiFrameControl{Close}` fields (`03-data-link.md` §4.2).

use super::TransportStatusCode;

/// Session close.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CloseControl {
    /// Session identifier.
    pub session_id: u16,
    /// Close status.
    pub status: TransportStatusCode,
}
