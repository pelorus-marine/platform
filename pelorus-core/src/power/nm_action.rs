//! Network-management engine side effects.

use crate::bus::CanFdFrame;

/// Transmit actions from [`super::NetworkManagementEngine`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NmAction {
    /// Send `Pelorus.WakeUp`.
    TransmitWakeUp(CanFdFrame),
    /// Send `Pelorus.NetworkManagement`.
    TransmitNetworkManagement(CanFdFrame),
}
