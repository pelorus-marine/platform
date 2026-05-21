//! Pack `PRIO | DC_ID | SA` (`03-data-link.md` §2).

use super::{DcId, Identifier};

/// Pack PRIO \| DC_ID \| SA into a 29-bit extended arbitration field.
#[must_use]
pub fn pack_identifier(priority: u8, dc_id: DcId, source_address: u8) -> u32 {
    let priority = u32::from(priority & 0x7);
    let dc_id = dc_id & 0x3_FFFF;
    let sa = u32::from(source_address);
    (priority << 26) | (dc_id << 8) | sa
}

/// Build an identifier from parts.
#[must_use]
pub fn identifier_from_parts(priority: u8, dc_id: DcId, source_address: u8) -> u32 {
    pack_identifier(priority, dc_id, source_address)
}

/// Split a 29-bit extended identifier (mask `0x1FFF_FFFF`).
#[must_use]
pub fn unpack_identifier(id: u32) -> Identifier {
    let id = id & 0x1FFF_FFFF;
    Identifier {
        priority: ((id >> 26) & 0x7) as u8,
        dc_id: (id >> 8) & 0x3_FFFF,
        source_address: (id & 0xFF) as u8,
    }
}

/// DC_ID from a packed identifier.
#[must_use]
pub fn dc_id_from_identifier(id: u32) -> DcId {
    unpack_identifier(id).dc_id
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::wire::{DC_ID_ADDRESS_CLAIM, DC_ID_WAKE_UP};

    #[test]
    fn address_claim_example_from_03() {
        let id = pack_identifier(6, DC_ID_ADDRESS_CLAIM, 0x02);
        assert_eq!(id, 0x1800_0502);
        let parsed = unpack_identifier(id);
        assert_eq!(parsed.priority, 6);
        assert_eq!(parsed.dc_id, DC_ID_ADDRESS_CLAIM);
        assert_eq!(parsed.source_address, 0x02);
    }

    #[test]
    fn wake_up_example_from_03() {
        let id = pack_identifier(0, DC_ID_WAKE_UP, 0x03);
        assert_eq!(id, 0x0000_0103);
    }
}
