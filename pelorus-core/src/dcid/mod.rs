//! Pelorus **Data Channel ID** surface: compiler-enforced schema and DBC translation hooks.

pub mod mapping;
pub mod protocol;
pub mod registry;
pub mod wire;

pub use protocol::{
    DCID_ADDRESS_CLAIMED, DCID_REQUEST, DCID_TRANSPORT_CONNECTION, DCID_TRANSPORT_DATA,
    dcid_from_extended_id, decode_request_payload, derive_dcid, encode_request_payload,
    split_extended_id,
};
#[cfg(feature = "std")]
pub use registry::mdf4_pelorus_path_string;
pub use registry::{
    DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1, DCID_PELORUS_NETWORK_MANAGEMENT,
    DCID_PELORUS_WAKE_UP_FRAME, Dcid, WireDcidClass, classify_core_wire, core_wire_numeric_id,
    dcid_from_pelorus_extension_wire, is_protocol_control_dcid, pelorus_extension_wire_id,
    write_mdf4_pelorus_path,
};
pub use wire::{NmPayloadV1, NmState, WufPayloadV1, functional_groups};
