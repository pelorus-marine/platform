//! Multi-frame close status (`03-data-link.md` §4.6).

/// Status in `Close` control (`03` §4.6 — general codes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum TransportStatusCode {
    /// Session completed successfully.
    Complete = 0x00,
}

impl TransportStatusCode {
    /// Parse raw status.
    #[must_use]
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0x00 => Some(Self::Complete),
            _ => None,
        }
    }

    /// Raw octet.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        self as u8
    }
}
