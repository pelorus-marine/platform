//! NM state octet in `Pelorus.NetworkManagement` (`04-power.md` §4.2).

/// NM state byte in the network-management frame (not the full cluster FSM).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum NmWireState {
    /// Ready-sleep (`0x00`).
    ReadySleep = 0,
    /// Repeat-message (`0x01`).
    RepeatMessage = 1,
    /// Normal-operation (`0x02`).
    NormalOperation = 2,
    /// Prepare-bus-sleep (`0x03`).
    PrepareBusSleep = 3,
}

impl NmWireState {
    /// Parse from frame byte 0. Unknown values return [`None`].
    #[must_use]
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0 => Some(Self::ReadySleep),
            1 => Some(Self::RepeatMessage),
            2 => Some(Self::NormalOperation),
            3 => Some(Self::PrepareBusSleep),
            _ => None,
        }
    }

    /// Raw octet for transmission.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        self as u8
    }
}
