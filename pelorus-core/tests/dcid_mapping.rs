//! DCID helpers (always built when running `cargo test`).

use pelorus_core::dcid::{
    mapping::{DbcMessageId, DcidFromDbc, EmptyDbcMap},
    Dcid,
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
    let map = EmptyDbcMap;
    assert!(map.dcids_for_message(DbcMessageId(0x123)).is_empty());
}

#[test]
fn pelorus_extension_dcids_distinct() {
    assert_ne!(
        std::mem::discriminant(&Dcid::PelorusWakeUpFrame),
        std::mem::discriminant(&Dcid::PelorusNetworkManagement),
    );
}
