//! Wake-up and network-management simulation (`04-power.md`).

use pelorus_core::{
    ClusterNmState, FunctionalGroups, NetworkManagementConfig, NetworkManagementEngine,
    NetworkManagementFrame, NmWireState, WakeUpFrame, ENGINE, REPEAT_MESSAGE_MS, UNDERWAY,
};

use crate::SimError;

/// WUF wake, NM round-trip, and repeat → ready-sleep without application work.
pub fn run() -> Result<(), SimError> {
    wake_on_matching_group()?;
    nm_frame_round_trip()?;
    repeat_expires_to_ready_sleep()?;
    Ok(())
}

fn wake_on_matching_group() -> Result<(), SimError> {
    let mut nm = NetworkManagementEngine::new(NetworkManagementConfig::new(
        0x20,
        FunctionalGroups(UNDERWAY),
    ));
    let wuf = WakeUpFrame {
        source_address: 0x01,
        groups: FunctionalGroups(UNDERWAY | ENGINE),
    };
    let _ = nm.on_frame(0, &wuf.into_can_frame());
    if nm.cluster_state() != ClusterNmState::RepeatMessage {
        return Err(SimError("WUF did not enter RepeatMessage"));
    }
    println!("  WUF matching membership -> RepeatMessage");
    Ok(())
}

fn nm_frame_round_trip() -> Result<(), SimError> {
    let nm = NetworkManagementFrame {
        source_address: 0x11,
        wire_state: NmWireState::NormalOperation,
        active_groups: FunctionalGroups(ENGINE),
    };
    let frame = nm.into_can_frame();
    if NetworkManagementFrame::parse(frame.id, frame.payload()) != Some(nm) {
        return Err(SimError("NM frame round-trip failed"));
    }
    println!("  NetworkManagementFrame encode/decode OK");
    Ok(())
}

fn repeat_expires_to_ready_sleep() -> Result<(), SimError> {
    let mut nm = NetworkManagementEngine::new(NetworkManagementConfig::new(
        0x20,
        FunctionalGroups(UNDERWAY),
    ));
    let _ = nm.on_frame(
        0,
        &WakeUpFrame {
            source_address: 0x01,
            groups: FunctionalGroups(UNDERWAY),
        }
        .into_can_frame(),
    );
    let _ = nm.tick(REPEAT_MESSAGE_MS);
    if nm.cluster_state() != ClusterNmState::ReadySleep {
        return Err(SimError("expected ReadySleep after repeat window"));
    }
    println!("  RepeatMessage -> ReadySleep (no application work)");
    Ok(())
}
