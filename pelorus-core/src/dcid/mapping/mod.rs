//! DBC **message id** ↔ **DCID** mapping.
//!
//! Concrete tables are integration-specific (vessel DBC, OEM overlays). The **Pelorus reference**
//! map is generated from **[`data/dcid_reference.toml`](../../data/dcid_reference.toml)** at build time.
//!
//! For normative **Pelorus Core numeric DCIDs** on the CAN FD bus (extensions in **07**, derivation
//! in **03** §3.2), see [`super::registry::core_wire_numeric_id`], [`super::registry::classify_core_wire`]
//! (protocol vs Pelorus extension vs application carrier), and related helpers on [`Dcid`].

mod reference;

pub use reference::PelorusCoreReferenceMap;

use super::Dcid;

/// Raw arbitration / extended CAN identifier (`0x…` before Pelorus DCID decode).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DbcMessageId(pub u32);

/// Maps CAN database messages to Pelorus [`Dcid`] lanes.
///
/// Embedders implement this for their onboard DBC plus Pelorus extension range.
///
/// Lookup keys off the **Pelorus wire DCID** (**03** §3.2), i.e. [`crate::dcid::protocol::dcid_from_extended_id`]
/// strips the source address — different ECUs sharing a PGN share one wire key.
pub trait DcidFromDbc {
    /// DCIDs associated with this **wire** numeric DCID (`derive_dcid` output).
    fn dcids_for_wire_dcid(&self, wire_dcid: u32) -> &[Dcid];

    /// Full **29-bit** extended CAN arbitration ID (as stored in a `.dbc` message id).
    fn dcids_for_message(&self, id: DbcMessageId) -> &[Dcid] {
        self.dcids_for_wire_dcid(crate::dcid::protocol::dcid_from_extended_id(id.0))
    }
}

/// Empty map — always returns no signals (integration brings a real [`DcidFromDbc`] implementation).
#[derive(Debug, Default, Clone)]
pub struct EmptyDbcMap;

impl DcidFromDbc for EmptyDbcMap {
    fn dcids_for_wire_dcid(&self, _wire_dcid: u32) -> &[Dcid] {
        &[]
    }
}
