//! Address-claim engine configuration (`05-addressing.md` §3).

use super::{listen_timing::MAX_CLAIMED_ADDRESS, listen_timing::DEFAULT_LISTEN_MS, Name};

/// Engine configuration.
#[derive(Debug, Clone, Copy)]
pub struct AddressClaimConfig {
    /// This node's NAME.
    pub name: Name,
    /// Preferred source address (`0x00`–`0xFD`).
    pub preferred_address: u8,
    /// Listen time before claiming (milliseconds).
    pub listen_ms: u32,
    /// Attempts before [`super::ClaimState::CannotClaim`].
    pub max_attempts: u8,
}

impl AddressClaimConfig {
    /// Sensible defaults for listen window and retry budget.
    #[must_use]
    pub const fn new(name: Name, preferred_address: u8) -> Self {
        Self {
            name,
            preferred_address: if preferred_address > MAX_CLAIMED_ADDRESS {
                MAX_CLAIMED_ADDRESS
            } else {
                preferred_address
            },
            listen_ms: DEFAULT_LISTEN_MS,
            max_attempts: 32,
        }
    }
}
