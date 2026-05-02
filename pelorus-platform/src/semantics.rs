//! Optional bridge from Core [`crate::dcid::Dcid`] to [`pelorus_semantics`] types.
//!
//! Paths are **illustrative** defaults for tooling and Stream correlation until a generated catalog
//! is wired in (`specifications` / `Vessel.*`).

use crate::dcid::Dcid;
use pelorus_semantics::{CorrelationSlot, SemanticPath};

/// Recommended constant-time correlation for MDF4 exporters, gateways, and Stream metadata.
///
/// Indexed DCIDs (`EngineRpm`, etc.) share one **representative** path; binding-table **instance**
/// selection stays orthogonal (see `core/06-signal-catalog.md`).
pub fn correlation_for_dcid(d: Dcid) -> CorrelationSlot<'static> {
    match d {
        Dcid::GnssLatitude => slot("Vessel.Navigation.GNSS.Level1.Position.Latitude"),
        Dcid::GnssLongitude => slot("Vessel.Navigation.GNSS.Level1.Position.Longitude"),
        Dcid::GnssSpeedOverGround => slot("Vessel.Navigation.GNSS.Level1.Navigation.SpeedOverGround"),
        Dcid::GnssCourseOverGround => slot("Vessel.Navigation.GNSS.Level1.Navigation.CourseOverGround"),
        Dcid::HeadingTrue => slot("Vessel.Navigation.HeadingTrue"),
        Dcid::HeadingMagnetic => slot("Vessel.Navigation.HeadingMagnetic"),
        Dcid::RateOfTurn => slot("Vessel.Navigation.RateOfTurn"),
        Dcid::Heel => slot("Vessel.Motion.Attitude.Heel"),
        Dcid::Trim => slot("Vessel.Motion.Attitude.Trim"),
        Dcid::Pitch => slot("Vessel.Motion.Attitude.Pitch"),
        Dcid::Roll => slot("Vessel.Motion.Attitude.Roll"),
        Dcid::EngineRpm(_) => slot("Vessel.Propulsion.Engines[].SpeedRPM"),
        Dcid::FuelFlowRate(_) => slot("Vessel.Propulsion.Engines[].FuelRate"),
        Dcid::EngineCoolantTemp(_) => slot("Vessel.Propulsion.Engines[].Coolant.Temperature"),
        Dcid::DepthBelowKeel => slot("Vessel.Navigation.Depth.Soundings.UnderKeel"),
        Dcid::WindSpeedApparent => slot("Vessel.Environment.Wind.Apparent.Speed"),
        Dcid::WindAngleApparent => slot("Vessel.Environment.Wind.Apparent.Angle"),
    }
}

#[inline]
fn slot(path: &'static str) -> CorrelationSlot<'static> {
    CorrelationSlot::vessel_only(SemanticPath::from(path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use pelorus_semantics::SemanticPath;

    #[test]
    fn gnss_lat_matches_semantics_path() {
        let c = correlation_for_dcid(Dcid::GnssLatitude);
        assert_eq!(
            c.vessel,
            Some(SemanticPath::from(
                "Vessel.Navigation.GNSS.Level1.Position.Latitude"
            ))
        );
    }

    #[test]
    fn engine_rpm_placeholder_path() {
        let c = correlation_for_dcid(Dcid::EngineRpm(3));
        assert!(c.vessel.is_some());
    }
}
