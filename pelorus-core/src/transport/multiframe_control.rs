//! `Pelorus.MultiFrameControl` message (`03-data-link.md` §4.2).

use crate::bus::CanFdFrame;
use crate::wire::{
    pack_identifier, unpack_identifier, DC_ID_MULTIFRAME_CONTROL, PRIORITY_MULTIFRAME,
};

use super::{
    AbortControl, BroadcastOpenControl, CloseControl, ControlOpcode, OpenAckControl, OpenControl,
    OpenNakControl, TransportReasonCode, TransportStatusCode, WindowControl, WINDOW_MISSING_CAP,
};

/// Decoded multi-frame control payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MultiframeControl {
    /// Targeted open.
    Open(OpenControl),
    /// Open ACK.
    OpenAck(OpenAckControl),
    /// Open NAK.
    OpenNak(OpenNakControl),
    /// Broadcast open.
    BroadcastOpen(BroadcastOpenControl),
    /// Windowed ACK / NAK list.
    Window(WindowControl),
    /// Close.
    Close(CloseControl),
    /// Abort.
    Abort(AbortControl),
}

impl MultiframeControl {
    /// Parse from CAN identifier + payload.
    pub fn parse(id: u32, payload: &[u8]) -> Option<Self> {
        let parts = unpack_identifier(id);
        if parts.dc_id != DC_ID_MULTIFRAME_CONTROL {
            return None;
        }
        let opcode = ControlOpcode::from_byte(payload.first().copied()?)?;
        match opcode {
            ControlOpcode::Open => decode_open(payload),
            ControlOpcode::OpenAck => decode_open_ack(payload),
            ControlOpcode::OpenNak => decode_open_nak(payload),
            ControlOpcode::BroadcastOpen => decode_broadcast_open(payload),
            ControlOpcode::Window => decode_window(payload),
            ControlOpcode::Close => decode_close(payload),
            ControlOpcode::Abort => decode_abort(payload),
        }
    }

    /// Encode to CAN FD with `source_address` in the identifier.
    pub fn into_can_frame(self, source_address: u8) -> Result<CanFdFrame, pelorus_bounded::Error> {
        let id = pack_identifier(
            PRIORITY_MULTIFRAME,
            DC_ID_MULTIFRAME_CONTROL,
            source_address,
        );
        let payload = self.encode()?;
        Ok(CanFdFrame::new_fd(id, &payload))
    }

    fn encode(&self) -> Result<pelorus_bounded::Vec<u8, 64>, pelorus_bounded::Error> {
        let mut out = pelorus_bounded::Vec::new();
        match self {
            Self::Open(o) => {
                out.push(ControlOpcode::Open.to_byte())?;
                out.extend_from_slice(&o.session_id.to_le_bytes())?;
                out.push(o.dst_sa)?;
                out.extend_from_slice(&dcid_le3(o.content_dc_id))?;
                out.extend_from_slice(&o.total_size.to_le_bytes())?;
                out.extend_from_slice(&o.total_frames.to_le_bytes())?;
                out.extend_from_slice(&o.window_size_requested.to_le_bytes())?;
                out.extend_from_slice(&o.content_crc32.to_le_bytes())?;
            }
            Self::OpenAck(a) => {
                out.push(ControlOpcode::OpenAck.to_byte())?;
                out.extend_from_slice(&a.session_id.to_le_bytes())?;
                out.extend_from_slice(&a.window_size_granted.to_le_bytes())?;
                out.extend_from_slice(&a.next_expected_seq.to_le_bytes())?;
            }
            Self::OpenNak(n) => {
                out.push(ControlOpcode::OpenNak.to_byte())?;
                out.extend_from_slice(&n.session_id.to_le_bytes())?;
                out.push(n.reason_code.to_byte())?;
            }
            Self::BroadcastOpen(b) => {
                out.push(ControlOpcode::BroadcastOpen.to_byte())?;
                out.extend_from_slice(&b.session_id.to_le_bytes())?;
                out.extend_from_slice(&dcid_le3(b.content_dc_id))?;
                out.extend_from_slice(&b.total_size.to_le_bytes())?;
                out.extend_from_slice(&b.total_frames.to_le_bytes())?;
                out.extend_from_slice(&b.content_crc32.to_le_bytes())?;
            }
            Self::Window(w) => {
                out.push(ControlOpcode::Window.to_byte())?;
                out.extend_from_slice(&w.session_id.to_le_bytes())?;
                out.extend_from_slice(&w.next_expected_seq.to_le_bytes())?;
                out.extend_from_slice(&w.last_received_seq.to_le_bytes())?;
                let count = w.missing.len().min(WINDOW_MISSING_CAP) as u8;
                out.push(count)?;
                for seq in w.missing.as_slice().iter().take(usize::from(count)) {
                    out.extend_from_slice(&seq.to_le_bytes())?;
                }
            }
            Self::Close(c) => {
                out.push(ControlOpcode::Close.to_byte())?;
                out.extend_from_slice(&c.session_id.to_le_bytes())?;
                out.push(c.status.to_byte())?;
            }
            Self::Abort(a) => {
                out.push(ControlOpcode::Abort.to_byte())?;
                out.extend_from_slice(&a.session_id.to_le_bytes())?;
                out.push(a.reason_code.to_byte())?;
            }
        }
        Ok(out)
    }
}

fn dcid_le3(dc_id: u32) -> [u8; 3] {
    let dc_id = dc_id & 0x3_FFFF;
    [
        (dc_id & 0xFF) as u8,
        ((dc_id >> 8) & 0xFF) as u8,
        ((dc_id >> 16) & 0xFF) as u8,
    ]
}

fn read_dc_id_le3(b: &[u8]) -> Option<u32> {
    if b.len() < 3 {
        return None;
    }
    Some(u32::from(b[0]) | (u32::from(b[1]) << 8) | (u32::from(b[2]) << 16))
}

fn decode_open(p: &[u8]) -> Option<MultiframeControl> {
    if p.len() < 21 {
        return None;
    }
    Some(MultiframeControl::Open(OpenControl {
        session_id: u16::from_le_bytes([p[1], p[2]]),
        dst_sa: p[3],
        content_dc_id: read_dc_id_le3(&p[4..7])?,
        total_size: u32::from_le_bytes([p[7], p[8], p[9], p[10]]),
        total_frames: u32::from_le_bytes([p[11], p[12], p[13], p[14]]),
        window_size_requested: u16::from_le_bytes([p[15], p[16]]),
        content_crc32: u32::from_le_bytes([p[17], p[18], p[19], p[20]]),
    }))
}

fn decode_open_ack(p: &[u8]) -> Option<MultiframeControl> {
    if p.len() < 9 {
        return None;
    }
    Some(MultiframeControl::OpenAck(OpenAckControl {
        session_id: u16::from_le_bytes([p[1], p[2]]),
        window_size_granted: u16::from_le_bytes([p[3], p[4]]),
        next_expected_seq: u32::from_le_bytes([p[5], p[6], p[7], p[8]]),
    }))
}

fn decode_open_nak(p: &[u8]) -> Option<MultiframeControl> {
    if p.len() < 4 {
        return None;
    }
    Some(MultiframeControl::OpenNak(OpenNakControl {
        session_id: u16::from_le_bytes([p[1], p[2]]),
        reason_code: TransportReasonCode::from_byte(p[3])?,
    }))
}

fn decode_broadcast_open(p: &[u8]) -> Option<MultiframeControl> {
    if p.len() < 18 {
        return None;
    }
    Some(MultiframeControl::BroadcastOpen(BroadcastOpenControl {
        session_id: u16::from_le_bytes([p[1], p[2]]),
        content_dc_id: read_dc_id_le3(&p[3..6])?,
        total_size: u32::from_le_bytes([p[6], p[7], p[8], p[9]]),
        total_frames: u32::from_le_bytes([p[10], p[11], p[12], p[13]]),
        content_crc32: u32::from_le_bytes([p[14], p[15], p[16], p[17]]),
    }))
}

fn decode_window(p: &[u8]) -> Option<MultiframeControl> {
    if p.len() < 11 {
        return None;
    }
    let count = usize::from(p[10]);
    let mut missing = pelorus_bounded::Vec::new();
    let base = 11usize;
    for i in 0..count {
        let off = base + i * 4;
        if off + 4 > p.len() {
            break;
        }
        missing
            .push(u32::from_le_bytes([
                p[off], p[off + 1], p[off + 2], p[off + 3],
            ]))
            .ok()?;
    }
    Some(MultiframeControl::Window(WindowControl {
        session_id: u16::from_le_bytes([p[1], p[2]]),
        next_expected_seq: u32::from_le_bytes([p[3], p[4], p[5], p[6]]),
        last_received_seq: u32::from_le_bytes([p[7], p[8], p[9], p[10]]),
        missing,
    }))
}

fn decode_close(p: &[u8]) -> Option<MultiframeControl> {
    if p.len() < 4 {
        return None;
    }
    Some(MultiframeControl::Close(CloseControl {
        session_id: u16::from_le_bytes([p[1], p[2]]),
        status: TransportStatusCode::from_byte(p[3])?,
    }))
}

fn decode_abort(p: &[u8]) -> Option<MultiframeControl> {
    if p.len() < 4 {
        return None;
    }
    Some(MultiframeControl::Abort(AbortControl {
        session_id: u16::from_le_bytes([p[1], p[2]]),
        reason_code: TransportReasonCode::from_byte(p[3])?,
    }))
}
