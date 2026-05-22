//! `Pelorus.NetworkManagement` frame (`04-power.md` §4.2).

use crate::bus::CanFdFrame;
use crate::wire::{
    DC_ID_NETWORK_MANAGEMENT, PRIORITY_NETWORK_MANAGEMENT, pack_identifier, unpack_identifier,
};

use super::{FunctionalGroups, NmWireState};

/// Parsed / built `Pelorus.NetworkManagement` (8-byte payload).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NetworkManagementFrame {
    /// Transmitter source address.
    pub source_address: u8,
    /// NM state octet (byte 0).
    pub wire_state: NmWireState,
    /// Active functional groups — low byte (byte 1).
    pub active_groups: FunctionalGroups,
}

impl NetworkManagementFrame {
    /// Encode **DLC = 8**; bytes 2–7 zero (`04` §4.2).
    #[must_use]
    pub fn into_can_frame(self) -> CanFdFrame {
        let id = pack_identifier(
            PRIORITY_NETWORK_MANAGEMENT,
            DC_ID_NETWORK_MANAGEMENT,
            self.source_address,
        );
        let mut payload = [0u8; 8];
        payload[0] = self.wire_state.to_byte();
        payload[1] = self.active_groups.v1_masked().0;
        CanFdFrame::new_fd(id, &payload)
    }

    /// Parse when `id` is `Pelorus.NetworkManagement`.
    #[must_use]
    pub fn parse(id: u32, payload: &[u8]) -> Option<Self> {
        let parts = unpack_identifier(id);
        if parts.dc_id != DC_ID_NETWORK_MANAGEMENT || payload.len() < 8 {
            return None;
        }
        Some(Self {
            source_address: parts.source_address,
            wire_state: NmWireState::from_byte(payload[0])?,
            active_groups: FunctionalGroups(payload[1]),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let nm = NetworkManagementFrame {
            source_address: 0x10,
            wire_state: NmWireState::NormalOperation,
            active_groups: FunctionalGroups(super::super::functional_groups::ENGINE),
        };
        let frame = nm.into_can_frame();
        assert_eq!(
            NetworkManagementFrame::parse(frame.id, frame.payload()),
            Some(nm)
        );
    }
}
