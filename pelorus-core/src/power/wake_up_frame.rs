//! `Pelorus.WakeUp` frame (`04-power.md` §4.1).

use crate::bus::CanFdFrame;
use crate::wire::{DC_ID_WAKE_UP, PRIORITY_WAKE_UP, pack_identifier, unpack_identifier};

use super::FunctionalGroups;

/// Parsed / built `Pelorus.WakeUp` (8-byte payload).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WakeUpFrame {
    /// Originator source address.
    pub source_address: u8,
    /// Asserted functional groups (byte 0).
    pub groups: FunctionalGroups,
}

impl WakeUpFrame {
    /// Encode **DLC = 8**; bytes 1–7 zero (`04` §4.1).
    #[must_use]
    pub fn into_can_frame(self) -> CanFdFrame {
        let id = pack_identifier(PRIORITY_WAKE_UP, DC_ID_WAKE_UP, self.source_address);
        let mut payload = [0u8; 8];
        payload[0] = self.groups.v1_masked().0;
        CanFdFrame::new_fd(id, &payload)
    }

    /// Parse when `id` is `Pelorus.WakeUp`.
    #[must_use]
    pub fn parse(id: u32, payload: &[u8]) -> Option<Self> {
        let parts = unpack_identifier(id);
        if parts.dc_id != DC_ID_WAKE_UP || payload.len() < 8 {
            return None;
        }
        Some(Self {
            source_address: parts.source_address,
            groups: FunctionalGroups(payload[0]),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::power::functional_groups::{ANCHOR_WATCH, UNDERWAY};

    #[test]
    fn round_trip() {
        let wuf = WakeUpFrame {
            source_address: 0x03,
            groups: FunctionalGroups(ANCHOR_WATCH | UNDERWAY),
        };
        let frame = wuf.into_can_frame();
        assert_eq!(WakeUpFrame::parse(frame.id, frame.payload()), Some(wuf));
    }
}
