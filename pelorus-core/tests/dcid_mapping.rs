//! DCID helpers (always built when running `cargo test`).

use pelorus_core::dcid::{
    Dcid,
    mapping::{DbcMessageId, DcidFromDbc, EmptyDbcMap},
};

#[test]
fn dcid_orders_in_hash_map() {
    use std::collections::HashMap;
    let mut m = HashMap::new();
    m.insert(Dcid::GnssLatitude, 1u8);
    m.insert(Dcid::GnssLongitude, 2);
    assert_eq!(m.len(), 2);
}

#[test]
fn empty_map_returns_no_signals() {
    let map = EmptyDbcMap::default();
    assert!(map.dcids_for_message(DbcMessageId(0x123)).is_empty());
}
