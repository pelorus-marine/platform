//! Address-claim side effects (`05-addressing.md` §3).

use crate::bus::CanFdFrame;

/// Side effect for the integrator (transmit on the bus).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaimAction {
    /// Transmit this frame now.
    Transmit(CanFdFrame),
}
