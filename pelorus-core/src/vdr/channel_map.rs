//! MDF4 channel naming: `pelorus/<dcid>` convention from the Pelorus implementation plan.
//!
//! When **`semantics`** is enabled, [`correlation_for_dcid`](crate::semantics::correlation_for_dcid)
//! supplies matching [`crate::CorrelationSlot`] values for gateways and Stream.

use crate::dcid::{Dcid, mdf4_pelorus_path_string};

/// Channel group prefix for MDF4 hierarchies (`pelorus/...`).
pub const MDF4_GROUP_PREFIX: &str = "pelorus";

/// Render the suggested MDF4 channel path for documentation and tooling parity.
///
/// Examples: `pelorus/GnssLatitude`, `pelorus/EngineRpm_0`.
///
/// Delegates to [`mdf4_pelorus_path_string`](crate::dcid::mdf4_pelorus_path_string) so naming stays
/// aligned with [`crate::dcid::write_mdf4_pelorus_path`] (`no_std`-friendly paths use that API).
pub fn mdf4_channel_for_dcid(d: Dcid) -> std::string::String {
    mdf4_pelorus_path_string(&d)
}
