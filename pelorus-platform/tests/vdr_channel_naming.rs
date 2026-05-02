//! MDF4 naming checks (`cargo test --features vdr -p pelorus-platform` from workspace root).

#[cfg(feature = "vdr")]
#[test]
fn mdf4_gnss_latitude_name() {
    use pelorus_platform::dcid::Dcid;
    use pelorus_platform::vdr::channel_map::mdf4_channel_for_dcid;

    assert_eq!(
        mdf4_channel_for_dcid(Dcid::GnssLatitude),
        "pelorus/GnssLatitude"
    );
}
