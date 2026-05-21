//! `Pelorus.MultiFrameControl` opcodes (implementation assignment for `03` §4.2).

/// Control-frame opcode (byte 0). Numeric values are Pelorus reference-assigned for v1.0.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum ControlOpcode {
    /// Targeted session open.
    Open = 0,
    /// Positive open response.
    OpenAck = 1,
    /// Negative open response.
    OpenNak = 2,
    /// Broadcast session open.
    BroadcastOpen = 3,
    /// Windowed acknowledgement.
    Window = 4,
    /// Session complete.
    Close = 5,
    /// Session abort.
    Abort = 6,
}

impl ControlOpcode {
    /// Parse opcode byte.
    #[must_use]
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0 => Some(Self::Open),
            1 => Some(Self::OpenAck),
            2 => Some(Self::OpenNak),
            3 => Some(Self::BroadcastOpen),
            4 => Some(Self::Window),
            5 => Some(Self::Close),
            6 => Some(Self::Abort),
            _ => None,
        }
    }

    /// Raw opcode.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        self as u8
    }
}
