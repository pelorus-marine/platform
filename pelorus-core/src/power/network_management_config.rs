//! Network-management engine configuration (`04-power.md` §6).

use super::FunctionalGroups;

/// Per-node NM / power coordination settings.
#[derive(Debug, Clone, Copy)]
pub struct NetworkManagementConfig {
    /// Claimed source address on the bus.
    pub source_address: u8,
    /// Functional groups this node belongs to (`04` §3).
    pub membership: FunctionalGroups,
    /// Application has work that requires keeping the cluster awake.
    pub has_application_work: bool,
}

impl NetworkManagementConfig {
    /// New configuration for an active node.
    #[must_use]
    pub const fn new(source_address: u8, membership: FunctionalGroups) -> Self {
        Self {
            source_address,
            membership,
            has_application_work: false,
        }
    }
}
