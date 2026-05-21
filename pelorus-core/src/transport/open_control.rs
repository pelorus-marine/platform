//! `MultiFrameControl{Open}` fields (`03-data-link.md` §4.2).

use crate::wire::DcId;

/// Targeted session open.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OpenControl {
    /// Session identifier (sender-scoped).
    pub session_id: u16,
    /// Destination source address.
    pub dst_sa: u8,
    /// Content DC_ID (3 bytes LE on wire).
    pub content_dc_id: DcId,
    /// Total reassembled size.
    pub total_size: u32,
    /// Expected data frame count.
    pub total_frames: u32,
    /// Requested window size.
    pub window_size_requested: u16,
    /// Expected content CRC32.
    pub content_crc32: u32,
}
