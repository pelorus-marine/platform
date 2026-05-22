//! `Pelorus.AddressClaim` frame (`05-addressing.md`, `07` §1.4).

use crate::bus::CanFdFrame;
use crate::wire::{DC_ID_ADDRESS_CLAIM, PRIORITY_ADDRESSING, pack_identifier, unpack_identifier};

use super::Name;

/// Parsed `Pelorus.AddressClaim` (8-byte NAME payload).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AddressClaimFrame {
    /// SA field in the identifier — the address being claimed (`05` §3).
    pub claimed_address: u8,
    /// 64-bit J1939 NAME in the data field.
    pub name: Name,
}

impl AddressClaimFrame {
    /// Build a CAN FD frame for transmission.
    #[must_use]
    pub fn into_can_frame(self) -> CanFdFrame {
        let id = pack_identifier(
            PRIORITY_ADDRESSING,
            DC_ID_ADDRESS_CLAIM,
            self.claimed_address,
        );
        CanFdFrame::new_fd(id, &self.name.to_le_bytes())
    }

    /// Parse when `id` carries `Pelorus.AddressClaim`.
    #[must_use]
    pub fn parse(id: u32, payload: &[u8]) -> Option<Self> {
        let parts = unpack_identifier(id);
        if parts.dc_id != DC_ID_ADDRESS_CLAIM || payload.len() < 8 {
            return None;
        }
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&payload[..8]);
        Some(Self {
            claimed_address: parts.source_address,
            name: Name::from_le_bytes(bytes),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::wire::DC_ID_ADDRESS_CLAIM;
    use crate::wire::dc_id_from_identifier;

    #[test]
    fn claim_round_trip() {
        let claim = AddressClaimFrame {
            claimed_address: 0x22,
            name: Name(0x1234_5678_9ABC_DEF0),
        };
        let frame = claim.into_can_frame();
        assert_eq!(dc_id_from_identifier(frame.id), DC_ID_ADDRESS_CLAIM);
        let back = AddressClaimFrame::parse(frame.id, frame.payload()).unwrap();
        assert_eq!(back, claim);
    }
}
