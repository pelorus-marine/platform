//! Pelorus-native 29-bit CAN identifier layout (`specifications/core/03-data-link.md` §2).

mod dc_id;
mod dc_ids;
mod identifier;
mod pack_identifier;

pub use dc_id::DcId;
pub use dc_ids::{
    DC_ID_ADDRESS_CLAIM, DC_ID_ADDRESS_COMMAND, DC_ID_MULTIFRAME_CONTROL, DC_ID_MULTIFRAME_DATA,
    DC_ID_NETWORK_MANAGEMENT, DC_ID_WAKE_UP, PRIORITY_ADDRESSING, PRIORITY_MULTIFRAME,
    PRIORITY_NETWORK_MANAGEMENT, PRIORITY_WAKE_UP,
};
pub use identifier::Identifier;
pub use pack_identifier::{
    dc_id_from_identifier, identifier_from_parts, pack_identifier, unpack_identifier,
};
