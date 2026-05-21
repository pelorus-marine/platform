//! Network-management timing (`04-power.md` §6.1).

/// NM message period (`04` §6.1).
pub const NM_PERIOD_MS: u32 = 200;
/// Repeat-message duration after wake (`04` §6.1).
pub const REPEAT_MESSAGE_MS: u32 = 1_000;
/// Ready-sleep → prepare-bus-sleep (`04` §6.1).
pub const READY_SLEEP_MS: u32 = 1_000;
/// Prepare-bus-sleep → bus-sleep (`04` §6.1).
pub const WAIT_BUS_SLEEP_MS: u32 = 2_000;
