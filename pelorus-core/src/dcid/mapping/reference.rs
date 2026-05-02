//! Reference **wire DCID → [`Dcid`]** slice — generated from **`data/dcid_reference.toml`**.

use crate::dcid::Dcid;

include!(concat!(env!("OUT_DIR"), "/pelorus_dcid_reference.rs"));

/// Pelorus-maintained reference map (regenerate with `cargo build -p pelorus-core`).
///
/// Keys are **wire** numeric DCIDs — use [`crate::dcid::protocol::dcid_from_extended_id`] on raw
/// CAN IDs before lookup. See [`super::DcidFromDbc`].
#[derive(Debug, Clone, Copy, Default)]
pub struct PelorusCoreReferenceMap;

impl super::DcidFromDbc for PelorusCoreReferenceMap {
    fn dcids_for_wire_dcid(&self, wire_dcid: u32) -> &[Dcid] {
        lookup_pelorus_reference_dcids(wire_dcid)
    }
}
