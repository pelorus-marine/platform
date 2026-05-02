//! MDF4 naming checks (`cargo test --features vdr -p pelorus-core` from workspace root).

#[cfg(feature = "vdr")]
#[test]
fn mdf4_gnss_latitude_name() {
    use pelorus_core::dcid::Dcid;
    use pelorus_core::vdr::channel_map::mdf4_channel_for_dcid;

    assert_eq!(
        mdf4_channel_for_dcid(Dcid::GnssLatitude),
        "pelorus/GnssLatitude"
    );
}
