//! Power / NM frames and cluster FSM (`04-power.md`).

use pelorus_core::{
    ClusterNmState, FunctionalGroups, NetworkManagementConfig, NetworkManagementEngine,
    NetworkManagementFrame, NmWireState, WakeUpFrame, ENGINE, REPEAT_MESSAGE_MS, UNDERWAY,
};

#[test]
fn wake_on_matching_group_enters_repeat() {
    let mut nm = NetworkManagementEngine::new(NetworkManagementConfig::new(
        0x20,
        FunctionalGroups(UNDERWAY),
    ));
    let wuf = WakeUpFrame {
        source_address: 0x01,
        groups: FunctionalGroups(UNDERWAY | ENGINE),
    };
    let _ = nm.on_frame(0, &wuf.into_can_frame());
    assert_eq!(nm.cluster_state(), ClusterNmState::RepeatMessage);
}

#[test]
fn nm_frame_round_trip() {
    let nm = NetworkManagementFrame {
        source_address: 0x11,
        wire_state: NmWireState::NormalOperation,
        active_groups: FunctionalGroups(ENGINE),
    };
    let frame = nm.into_can_frame();
    assert_eq!(
        NetworkManagementFrame::parse(frame.id, frame.payload()),
        Some(nm)
    );
}

#[test]
fn repeat_expires_to_ready_sleep_without_work() {
    let mut nm = NetworkManagementEngine::new(NetworkManagementConfig::new(
        0x20,
        FunctionalGroups(UNDERWAY),
    ));
    let _ = nm.on_frame(0, &WakeUpFrame {
        source_address: 0x01,
        groups: FunctionalGroups(UNDERWAY),
    }
    .into_can_frame());
    let _ = nm.tick(REPEAT_MESSAGE_MS);
    assert_eq!(nm.cluster_state(), ClusterNmState::ReadySleep);
}
