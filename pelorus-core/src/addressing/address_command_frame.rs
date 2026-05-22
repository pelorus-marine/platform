//! `Pelorus.AddressCommand` frame (`05-addressing.md` §4).

use crate::bus::CanFdFrame;
use crate::wire::{DC_ID_ADDRESS_COMMAND, PRIORITY_ADDRESSING, pack_identifier, unpack_identifier};

use super::Name;

/// Parsed `Pelorus.AddressCommand` (J1939-81 commanded-address layout).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AddressCommandFrame {
    /// Transmitter SA (commander).
    pub commander_address: u8,
    /// Device to re-address.
    pub target_name: Name,
    /// Assigned source address.
    pub new_address: u8,
}

impl AddressCommandFrame {
    /// Build a CAN FD frame (9-byte payload: NAME + new SA).
    #[must_use]
    pub fn into_can_frame(self) -> CanFdFrame {
        let id = pack_identifier(
            PRIORITY_ADDRESSING,
            DC_ID_ADDRESS_COMMAND,
            self.commander_address,
        );
        let mut payload = [0u8; 9];
        payload[..8].copy_from_slice(&self.target_name.to_le_bytes());
        payload[8] = self.new_address;
        CanFdFrame::new_fd(id, &payload)
    }

    /// Parse when `id` carries `Pelorus.AddressCommand`.
    #[must_use]
    pub fn parse(id: u32, payload: &[u8]) -> Option<Self> {
        let parts = unpack_identifier(id);
        if parts.dc_id != DC_ID_ADDRESS_COMMAND || payload.len() < 9 {
            return None;
        }
        let mut name_bytes = [0u8; 8];
        name_bytes.copy_from_slice(&payload[..8]);
        Some(Self {
            commander_address: parts.source_address,
            target_name: Name::from_le_bytes(name_bytes),
            new_address: payload[8],
        })
    }
}
