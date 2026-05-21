//! `MultiFrameControl{Window}` fields (`03-data-link.md` §4.2).

/// Maximum missing sequence entries per control frame (`03` §4.2).
pub const WINDOW_MISSING_CAP: usize = 12;

/// Windowed ACK with optional NAK list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowControl {
    /// Session identifier.
    pub session_id: u16,
    /// Next sequence sender should transmit.
    pub next_expected_seq: u32,
    /// Highest sequence received in order.
    pub last_received_seq: u32,
    /// Missing sequence numbers.
    pub missing: pelorus_bounded::Vec<u32, WINDOW_MISSING_CAP>,
}
