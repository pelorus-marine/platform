//! `MultiFrameControl{BroadcastOpen}` fields (`03-data-link.md` §4.2).

use crate::wire::DcId;

/// Broadcast session open.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BroadcastOpenControl {
    /// Session identifier.
    pub session_id: u16,
    /// Content DC_ID.
    pub content_dc_id: DcId,
    /// Total reassembled size.
    pub total_size: u32,
    /// Expected data frame count.
    pub total_frames: u32,
    /// Content CRC32.
    pub content_crc32: u32,
}
