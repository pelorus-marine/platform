//! Broadcast multi-frame transport simulation (`03-data-link.md` §4.5).

use pelorus_core::{
    BroadcastOpenControl, IngressBroadcastSession, IngressResult, MultiframeControl, MultiframeData,
    crc32,
};

use crate::SimError;

/// Broadcast open, single-chunk delivery, CRC pass and CRC fail paths.
pub fn run() -> Result<(), SimError> {
    broadcast_complete()?;
    crc_mismatch()?;
    Ok(())
}

fn broadcast_complete() -> Result<(), SimError> {
    let content = b"pelorus-core-transport-demo";
    let open = BroadcastOpenControl {
        session_id: 7,
        content_dc_id: 0x0000C,
        total_size: content.len() as u32,
        total_frames: 1,
        content_crc32: crc32(content),
    };

    let mut ingress = IngressBroadcastSession::new();
    if ingress.open(open) != IngressResult::InProgress {
        return Err(SimError("ingress open rejected"));
    }

    let ctrl = MultiframeControl::BroadcastOpen(open);
    let frame = ctrl
        .into_can_frame(0x10)
        .map_err(|_| SimError("control encode failed"))?;
    if MultiframeControl::parse(frame.id, frame.payload()).is_none() {
        return Err(SimError("control parse failed"));
    }

    let mut chunk = pelorus_bounded::Vec::new();
    chunk
        .extend_from_slice(content)
        .map_err(|_| SimError("chunk buffer"))?;
    let data = MultiframeData {
        source_address: 0x10,
        session_id: 7,
        sequence_number: 0,
        data: chunk,
    };
    if ingress.on_data(&data) != IngressResult::Complete {
        return Err(SimError("ingress did not complete"));
    }
    if ingress.payload() != content {
        return Err(SimError("reassembled payload mismatch"));
    }
    println!("  broadcast session {} bytes, CRC OK", content.len());
    Ok(())
}

fn crc_mismatch() -> Result<(), SimError> {
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
    chunk
        .extend_from_slice(b"abcd")
        .map_err(|_| SimError("chunk buffer"))?;
    let data = MultiframeData {
        source_address: 1,
        session_id: 1,
        sequence_number: 0,
        data: chunk,
    };
    if ingress.on_data(&data) != IngressResult::CrcMismatch {
        return Err(SimError("expected CrcMismatch"));
    }
    println!("  bad content_crc32 -> CrcMismatch");
    Ok(())
}
