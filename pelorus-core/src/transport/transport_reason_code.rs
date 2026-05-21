//! Multi-frame reason codes (`03-data-link.md` §4.6).

/// General transport reason code (`03` §4.6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum TransportReasonCode {
    /// Complete / no error.
    Complete = 0x00,
    /// Reassembled CRC32 mismatch.
    CrcMismatch = 0x01,
    /// `session_id` already in use.
    SessionExists = 0x02,
    /// Receiver lacks buffer space.
    NoResources = 0x03,
    /// Implementation-defined timeout.
    Timeout = 0x04,
    /// Unknown `content_DC_ID`.
    UnknownContent = 0x05,
    /// Initiator cancelled.
    Cancelled = 0x06,
    /// Malformed control frame.
    ProtocolError = 0x07,
}

impl TransportReasonCode {
    /// Parse raw code.
    #[must_use]
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0x00 => Some(Self::Complete),
            0x01 => Some(Self::CrcMismatch),
            0x02 => Some(Self::SessionExists),
            0x03 => Some(Self::NoResources),
            0x04 => Some(Self::Timeout),
            0x05 => Some(Self::UnknownContent),
            0x06 => Some(Self::Cancelled),
            0x07 => Some(Self::ProtocolError),
            _ => None,
        }
    }

    /// Raw octet.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        self as u8
    }
}
