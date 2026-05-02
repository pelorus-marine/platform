//! DCID helpers (always built when running `cargo test`).

use pelorus_core::dcid::{
    DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1, DCID_J1939_ENGINE_TEMPERATURE_1,
    DCID_J1939_VEHICLE_HEADING, DCID_PELORUS_NETWORK_MANAGEMENT, DCID_PELORUS_WAKE_UP_FRAME, Dcid,
    PelorusCoreReferenceMap, WireDcidClass, classify_core_wire, core_wire_numeric_id,
    dcid_from_pelorus_extension_wire,
    mapping::{DbcMessageId, DcidFromDbc, EmptyDbcMap},
    pelorus_extension_wire_id,
    protocol::dcid_from_extended_id,
    write_mdf4_pelorus_path,
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

#[test]
fn pelorus_extension_wire_ids_round_trip() {
    assert_eq!(
        pelorus_extension_wire_id(Dcid::PelorusWakeUpFrame),
        Some(DCID_PELORUS_WAKE_UP_FRAME)
    );
    assert_eq!(
        pelorus_extension_wire_id(Dcid::PelorusNetworkManagement),
        Some(DCID_PELORUS_NETWORK_MANAGEMENT)
    );
    assert_eq!(
        dcid_from_pelorus_extension_wire(DCID_PELORUS_WAKE_UP_FRAME),
        Some(Dcid::PelorusWakeUpFrame)
    );
    assert_eq!(
        dcid_from_pelorus_extension_wire(DCID_PELORUS_NETWORK_MANAGEMENT),
        Some(Dcid::PelorusNetworkManagement)
    );
    assert_eq!(dcid_from_pelorus_extension_wire(0x0FF82), None);
}

#[test]
fn core_wire_numeric_id_matches_registry() {
    assert_eq!(
        core_wire_numeric_id(Dcid::PelorusWakeUpFrame),
        Some(DCID_PELORUS_WAKE_UP_FRAME)
    );
    assert_eq!(
        core_wire_numeric_id(Dcid::EngineRpm(2)),
        Some(DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1)
    );
    assert_eq!(
        core_wire_numeric_id(Dcid::HeadingTrue),
        Some(DCID_J1939_VEHICLE_HEADING)
    );
    assert_eq!(
        core_wire_numeric_id(Dcid::EngineCoolantTemp(1)),
        Some(DCID_J1939_ENGINE_TEMPERATURE_1)
    );
    assert_eq!(core_wire_numeric_id(Dcid::GnssLatitude), None);
    assert_eq!(core_wire_numeric_id(Dcid::SpeedThroughWater), None);
}

#[test]
fn speed_through_water_distinct_from_sog() {
    assert_ne!(
        std::mem::discriminant(&Dcid::GnssSpeedOverGround),
        std::mem::discriminant(&Dcid::SpeedThroughWater),
    );
}

#[test]
fn classify_wire_distinguishes_protocol_and_signal_carriers() {
    use pelorus_core::dcid::protocol::{DCID_ADDRESS_CLAIMED, DCID_REQUEST};
    assert_eq!(
        classify_core_wire(DCID_ADDRESS_CLAIMED),
        WireDcidClass::ProtocolControl
    );
    assert_eq!(
        classify_core_wire(DCID_REQUEST),
        WireDcidClass::ProtocolControl
    );
    assert_eq!(
        classify_core_wire(0x0FF80),
        WireDcidClass::PelorusExtension(Dcid::PelorusWakeUpFrame)
    );
    assert_eq!(
        classify_core_wire(0xF004),
        WireDcidClass::Application { wire: 0xF004 }
    );
}

#[test]
fn reference_map_by_wire_and_extended_id() {
    let m = PelorusCoreReferenceMap;
    assert_eq!(
        m.dcids_for_wire_dcid(DCID_PELORUS_WAKE_UP_FRAME),
        &[Dcid::PelorusWakeUpFrame][..]
    );
    assert_eq!(
        m.dcids_for_wire_dcid(DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1),
        &[Dcid::EngineRpm(0)][..]
    );
    assert_eq!(
        m.dcids_for_wire_dcid(DCID_J1939_VEHICLE_HEADING),
        &[Dcid::HeadingTrue][..]
    );
    assert_eq!(
        m.dcids_for_wire_dcid(DCID_J1939_ENGINE_TEMPERATURE_1),
        &[Dcid::EngineCoolantTemp(0)][..]
    );
    let ext = 0x18FF8003_u32;
    assert_eq!(dcid_from_extended_id(ext), DCID_PELORUS_WAKE_UP_FRAME);
    assert_eq!(
        m.dcids_for_message(DbcMessageId(ext)),
        &[Dcid::PelorusWakeUpFrame][..]
    );
}

#[test]
fn mdf4_channel_paths_match_implementation_plan() {
    let mut buf = [0u8; 80];
    let n = write_mdf4_pelorus_path(&Dcid::GnssLatitude, &mut buf).unwrap();
    assert_eq!(&buf[..n], b"pelorus/GnssLatitude");
    let n = write_mdf4_pelorus_path(&Dcid::EngineRpm(0), &mut buf).unwrap();
    assert_eq!(&buf[..n], b"pelorus/EngineRpm_0");
    let n = write_mdf4_pelorus_path(&Dcid::EngineRpm(12), &mut buf).unwrap();
    assert_eq!(&buf[..n], b"pelorus/EngineRpm_12");
    let n = write_mdf4_pelorus_path(&Dcid::DepthBelowKeel, &mut buf).unwrap();
    assert_eq!(&buf[..n], b"pelorus/DepthBelowKeel");
}
