//! Cluster network-management FSM (`04-power.md` §6.2).

/// CanNm-style cluster state for this node.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum ClusterNmState {
    /// Transceiver in selective wake; no NM TX (`04` §6.2).
    #[default]
    BusSleep,
    /// Wait 2.0 s for traffic before sleeping (`04` §6.2).
    PrepareBusSleep,
    /// Listening; peers' NM keeps cluster alive (`04` §6.2).
    ReadySleep,
    /// Application active; NM every 200 ms (`04` §6.2).
    NormalOperation,
    /// Post-wake announcement window 1.0 s (`04` §6.2).
    RepeatMessage,
}
