//! Address-claim high-level state (`05-addressing.md` §3).

/// High-level claim progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaimState {
    /// Not started — call [`super::AddressClaimEngine::start`].
    Idle,
    /// Listening for competing claims (`05` §3 step 1).
    Listening,
    /// Successfully claiming `sa` (may still lose to a lower NAME).
    Claimed {
        /// Currently held source address.
        sa: u8,
    },
    /// No address available after retry budget exhausted.
    CannotClaim,
}
