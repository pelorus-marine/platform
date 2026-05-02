//! Pelorus **Data Channel ID** surface: compiler-enforced schema and DBC translation hooks.

pub mod mapping;
pub mod protocol;
pub mod registry;
pub mod wire;

pub use protocol::{
    decode_request_payload, derive_dcid, dcid_from_extended_id, encode_request_payload,
    split_extended_id, DCID_ADDRESS_CLAIMED, DCID_REQUEST, DCID_TRANSPORT_CONNECTION,
    DCID_TRANSPORT_DATA,
};
pub use registry::{
    core_wire_numeric_id, dcid_from_pelorus_extension_wire, pelorus_extension_wire_id, Dcid,
    DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1, DCID_PELORUS_NETWORK_MANAGEMENT,
    DCID_PELORUS_WAKE_UP_FRAME,
};
pub use wire::{functional_groups, NmPayloadV1, NmState, WufPayloadV1};
