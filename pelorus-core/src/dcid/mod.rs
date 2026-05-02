//! Pelorus **Data Channel ID** surface: compiler-enforced schema and DBC translation hooks.

pub mod mapping;
pub mod registry;

pub use registry::{
    core_wire_numeric_id, dcid_from_pelorus_extension_wire, pelorus_extension_wire_id, Dcid,
    DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1, DCID_PELORUS_NETWORK_MANAGEMENT,
    DCID_PELORUS_WAKE_UP_FRAME,
};
