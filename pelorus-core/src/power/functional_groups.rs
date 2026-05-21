//! Marine functional-group bitmask (`04-power.md` §3).

/// Lowest six bits of WUF / NM byte 0 (`04` §3, §4).
pub const ANCHOR_WATCH: u8 = 1 << 0;
/// Underway cluster.
pub const UNDERWAY: u8 = 1 << 1;
/// Engine cluster.
pub const ENGINE: u8 = 1 << 2;
/// Comms cluster.
pub const COMMS: u8 = 1 << 3;
/// Domestic cluster.
pub const DOMESTIC: u8 = 1 << 4;
/// Storm mode cluster.
pub const STORM: u8 = 1 << 5;
/// v1.0 standard groups mask (bits 6–7 of byte 0 reserved — transmit zero).
pub const V1_STD_MASK: u8 = 0x3F;

/// Functional-group bitmask on the wire.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct FunctionalGroups(pub u8);

impl FunctionalGroups {
    /// Mask to v1.0-assigned bits only.
    #[must_use]
    pub const fn v1_masked(self) -> Self {
        Self(self.0 & V1_STD_MASK)
    }

    /// `true` when at least one bit is set in both `self` and `incoming`.
    #[must_use]
    pub const fn overlaps(self, incoming: Self) -> bool {
        (self.0 & incoming.0) != 0
    }

    /// Node should wake when the WUF asserts any of its configured `membership` groups.
    #[must_use]
    pub const fn should_wake_for(membership: Self, wuf: Self) -> bool {
        membership.overlaps(wuf.v1_masked())
    }
}
