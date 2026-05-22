//! In-memory CAN FD bus medium (`reference-implementations` / CI only).

use pelorus_bounded::{Error as BoundedError, Vec};

use super::CanFdFrame;

/// Maximum frames buffered on the simulated medium per exchange step.
pub const SIM_BUS_FRAME_CAP: usize = 64;

/// Shared medium: every [`super::SimPort`] on the same bus sees frames posted by any port.
#[derive(Debug)]
pub struct SimulatedBus {
    frames: Vec<CanFdFrame, SIM_BUS_FRAME_CAP>,
}

impl Default for SimulatedBus {
    fn default() -> Self {
        Self::new()
    }
}

impl SimulatedBus {
    /// Empty bus.
    #[must_use]
    pub fn new() -> Self {
        Self { frames: Vec::new() }
    }

    /// Pending frame count.
    #[must_use]
    pub fn len(&self) -> usize {
        self.frames.len()
    }

    /// `true` when [`Self::len`] is zero.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.frames.is_empty()
    }

    /// Clear the medium without delivering frames.
    pub fn clear(&mut self) {
        self.frames.clear();
    }

    /// Open a port on this bus.
    #[must_use]
    pub fn port(&mut self) -> super::SimPort<'_> {
        super::SimPort {
            bus: self,
            read_cursor: 0,
        }
    }

    /// End a simulation step: drop all frames so the next step starts clean.
    ///
    /// Drop every [`super::SimPort`] before calling this (each port holds a borrow of the bus).
    pub fn finish_round(&mut self) {
        self.frames.clear();
    }

    pub(crate) fn push_frame(&mut self, frame: CanFdFrame) -> Result<(), BoundedError> {
        self.frames.push(frame)
    }

    pub(crate) fn frame_at(&self, index: usize) -> Option<CanFdFrame> {
        self.frames.as_slice().get(index).copied()
    }
}

impl From<BoundedError> for super::SimBusError {
    fn from(_: BoundedError) -> Self {
        super::SimBusError::FrameQueueFull
    }
}
