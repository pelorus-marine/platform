#![cfg(feature = "std")]

use std::collections::VecDeque;

/// Fixed-depth trace of `(CAN id, up to first 8 payload bytes)` for diagnostics and VDR handoff.
///
/// Intentionally small and **non-authoritative**: authoritative recording belongs in the Linux VDR
/// service (`mdf4-rs`).
#[derive(Debug, Clone)]
pub struct FrameScratchLog {
    cap: usize,
    q: VecDeque<(u32, [u8; 8], u8)>,
}

impl FrameScratchLog {
    /// New ring with `capacity` frames remembered.
    pub fn new(capacity: usize) -> Self {
        Self {
            cap: capacity.max(1),
            q: VecDeque::new(),
        }
    }

    /// Push one frame excerpt; drops oldest entries past capacity.
    pub fn push(&mut self, can_id: u32, payload: &[u8]) {
        let mut chunk = [0u8; 8];
        let n = payload.len().min(8);
        chunk[..n].copy_from_slice(&payload[..n]);
        if self.q.len() == self.cap {
            self.q.pop_front();
        }
        self.q.push_back((can_id, chunk, n as u8));
    }

    /// Iterator from oldest to newest.
    pub fn iter(&self) -> impl ExactSizeIterator<Item = (u32, &[u8])> + '_ {
        self.q.iter().map(|&(id, ref b, len)| {
            let len = usize::from(len).min(b.len());
            (id, &b[..len])
        })
    }
}
