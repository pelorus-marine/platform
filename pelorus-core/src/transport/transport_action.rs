//! Transport engine transmit side effects.

use crate::bus::CanFdFrame;

/// Actions to apply on [`crate::bus::CanFdBus`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportAction {
    /// Transmit one CAN FD frame.
    Transmit(CanFdFrame),
}
