//! `MultiFrameControl{OpenAck}` fields (`03-data-link.md` §4.2).

/// Positive open response.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OpenAckControl {
    /// Session identifier.
    pub session_id: u16,
    /// Granted window size.
    pub window_size_granted: u16,
    /// Next sequence expected by receiver.
    pub next_expected_seq: u32,
}
