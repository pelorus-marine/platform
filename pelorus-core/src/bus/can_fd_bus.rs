//! Hardware-agnostic CAN FD port trait.

use super::CanFdFrame;

/// Hardware-agnostic CAN FD port (driver, socketcan adapter, or [`super::SimPort`]).
pub trait CanFdBus {
    /// Port-specific failure (driver NACK, bus-off hook, etc.).
    type Error: core::fmt::Debug;

    /// Enqueue one frame for transmission (non-blocking).
    fn try_transmit(&mut self, frame: &CanFdFrame) -> Result<(), Self::Error>;

    /// Dequeue one received frame, if any (non-blocking).
    fn try_receive(&mut self) -> Result<Option<CanFdFrame>, Self::Error>;
}
