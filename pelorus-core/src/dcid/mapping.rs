//! DBC **message id** ↔ **DCID** mapping.
//!
//! Concrete tables are integration-specific (vessel DBC, OEM overlays). This module holds
//! shared types only until generated bindings land.
//!
//! For normative **Pelorus Core numeric DCIDs** on the CAN FD bus (extensions in **07**, derivation
//! in **03** §3.2), see [`super::registry::core_wire_numeric_id`], [`super::registry::classify_core_wire`]
//! (protocol vs Pelorus extension vs application carrier), and related helpers on [`Dcid`].

use super::Dcid;

/// Raw arbitration / extended CAN identifier (`0x…` before Pelorus DCID decode).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DbcMessageId(pub u32);

/// Maps CAN database messages to Pelorus [`Dcid`] lanes.
///
/// Embedders implement this for their onboard DBC plus Pelorus extension range.
pub trait DcidFromDbc {
    /// Return DCIDs carried by a given DBC message identifier, if known.
    fn dcids_for_message(&self, id: DbcMessageId) -> &[Dcid];
}

/// Placeholder until a generated map is checked in.
#[derive(Debug, Default, Clone)]
pub struct EmptyDbcMap;

impl DcidFromDbc for EmptyDbcMap {
    fn dcids_for_message(&self, _id: DbcMessageId) -> &[Dcid] {
        &[]
    }
}
