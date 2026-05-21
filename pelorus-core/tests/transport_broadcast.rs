//! Broadcast multi-frame path (`03-data-link.md` §4.5).

use pelorus_core::{
    BroadcastOpenControl, IngressBroadcastSession, IngressResult, MultiframeControl, MultiframeData,
    crc32,
};

#[test]
fn broadcast_open_and_data_complete() {
    let content = b"pelorus-core-transport-demo";
    let open = BroadcastOpenControl {
        session_id: 7,
        content_dc_id: 0x0000C,
        total_size: content.len() as u32,
        total_frames: 1,
        content_crc32: crc32(content),
    };

    let mut ingress = IngressBroadcastSession::new();
    assert_eq!(ingress.open(open), IngressResult::InProgress);

    let ctrl = MultiframeControl::BroadcastOpen(open);
    let frame = ctrl.into_can_frame(0x10).unwrap();
    assert!(MultiframeControl::parse(frame.id, frame.payload()).is_some());

    let mut chunk = pelorus_bounded::Vec::new();
    chunk.extend_from_slice(content).unwrap();
    let data = MultiframeData {
        source_address: 0x10,
        session_id: 7,
        sequence_number: 0,
        data: chunk,
    };
    assert_eq!(ingress.on_data(&data), IngressResult::Complete);
    assert_eq!(ingress.payload(), content);
}

#[test]
fn crc_mismatch_aborts() {
    let open = BroadcastOpenControl {
        session_id: 1,
        content_dc_id: 0x00100,
        total_size: 4,
        total_frames: 1,
        content_crc32: 0xDEAD_BEEF,
    };
    let mut ingress = IngressBroadcastSession::new();
    ingress.open(open);
    let mut chunk = pelorus_bounded::Vec::new();
    chunk.extend_from_slice(b"abcd").unwrap();
    let data = MultiframeData {
        source_address: 1,
        session_id: 1,
        sequence_number: 0,
        data: chunk,
    };
    assert_eq!(ingress.on_data(&data), IngressResult::CrcMismatch);
}
