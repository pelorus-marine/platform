//! Address-claim timing (`05-addressing.md` §3).

/// Initial listen window before first claim (`05` §3 step 1).
pub const DEFAULT_LISTEN_MS: u32 = 250;

/// Maximum claimable source address (`05` §1).
pub const MAX_CLAIMED_ADDRESS: u8 = 0xFD;
