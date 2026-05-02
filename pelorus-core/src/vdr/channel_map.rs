//! MDF4 channel naming: `pelorus/<dcid>` convention from the Pelorus implementation plan.
//!
//! When **`semantics`** is enabled, [`correlation_for_dcid`](crate::semantics::correlation_for_dcid)
//! supplies matching [`crate::CorrelationSlot`] values for gateways and Stream.

use crate::dcid::Dcid;

/// Channel group prefix for MDF4 hierarchies (`pelorus/...`).
pub const MDF4_GROUP_PREFIX: &str = "pelorus";

/// Render the suggested MDF4 channel path for documentation and tooling parity.
///
/// Examples: `pelorus/GnssLatitude`, `pelorus/EngineRpm_0`.
pub fn mdf4_channel_for_dcid(d: Dcid) -> String {
    match d {
        Dcid::GnssLatitude => format!("{MDF4_GROUP_PREFIX}/GnssLatitude"),
        Dcid::GnssLongitude => format!("{MDF4_GROUP_PREFIX}/GnssLongitude"),
        Dcid::GnssSpeedOverGround => format!("{MDF4_GROUP_PREFIX}/GnssSpeedOverGround"),
        Dcid::SpeedThroughWater => format!("{MDF4_GROUP_PREFIX}/SpeedThroughWater"),
        Dcid::GnssCourseOverGround => format!("{MDF4_GROUP_PREFIX}/GnssCourseOverGround"),
        Dcid::HeadingTrue => format!("{MDF4_GROUP_PREFIX}/HeadingTrue"),
        Dcid::HeadingMagnetic => format!("{MDF4_GROUP_PREFIX}/HeadingMagnetic"),
        Dcid::RateOfTurn => format!("{MDF4_GROUP_PREFIX}/RateOfTurn"),
        Dcid::Heel => format!("{MDF4_GROUP_PREFIX}/Heel"),
        Dcid::Trim => format!("{MDF4_GROUP_PREFIX}/Trim"),
        Dcid::Pitch => format!("{MDF4_GROUP_PREFIX}/Pitch"),
        Dcid::Roll => format!("{MDF4_GROUP_PREFIX}/Roll"),
        Dcid::EngineRpm(i) => format!("{MDF4_GROUP_PREFIX}/EngineRpm_{i}"),
        Dcid::FuelFlowRate(i) => format!("{MDF4_GROUP_PREFIX}/FuelFlowRate_{i}"),
        Dcid::EngineCoolantTemp(i) => format!("{MDF4_GROUP_PREFIX}/EngineCoolantTemp_{i}"),
        Dcid::DepthBelowKeel => format!("{MDF4_GROUP_PREFIX}/DepthBelowKeel"),
        Dcid::WaterTemperature => format!("{MDF4_GROUP_PREFIX}/WaterTemperature"),
        Dcid::WindSpeedApparent => format!("{MDF4_GROUP_PREFIX}/WindSpeedApparent"),
        Dcid::WindAngleApparent => format!("{MDF4_GROUP_PREFIX}/WindAngleApparent"),
        Dcid::PelorusWakeUpFrame => format!("{MDF4_GROUP_PREFIX}/PelorusWakeUpFrame"),
        Dcid::PelorusNetworkManagement => format!("{MDF4_GROUP_PREFIX}/PelorusNetworkManagement"),
    }
}
