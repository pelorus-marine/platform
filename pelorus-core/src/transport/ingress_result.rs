//! Broadcast ingress session outcomes.

use super::TransportReasonCode;

/// Result of feeding a data frame into [`super::IngressBroadcastSession`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IngressResult {
    /// More data frames required.
    InProgress,
    /// Reassembly finished and CRC32 matched.
    Complete,
    /// Reassembled CRC32 did not match `content_crc32`.
    CrcMismatch,
    /// Session rejected at open (size over cap, duplicate session, etc.).
    Rejected(TransportReasonCode),
}
