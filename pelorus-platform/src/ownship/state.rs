//! Mutable fused state before publishing [`super::snapshot::OwnShipSnapshot`].

use super::snapshot::OwnShipSnapshot;

/// Working copy of decoded navigation / motion quantities.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ShipState {
    snapshot: OwnShipSnapshot,
}

impl ShipState {
    /// Empty state.
    pub fn new() -> Self {
        Self::default()
    }

    /// Replace from a fresh snapshot (e.g. after a telemetry tick).
    pub fn set_snapshot(&mut self, snap: OwnShipSnapshot) {
        self.snapshot = snap;
    }

    /// Borrow the latest fused snapshot for charting IPC.
    pub fn snapshot(&self) -> &OwnShipSnapshot {
        &self.snapshot
    }

    /// Clone out for FFI or cross-thread handoff.
    pub fn snapshot_owned(&self) -> OwnShipSnapshot {
        self.snapshot.clone()
    }
}
