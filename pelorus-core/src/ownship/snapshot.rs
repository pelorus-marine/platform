//! Canonical own-ship snapshot shared with charting crates.

/// ECDIS-facing snapshot: map directly from decoded **Pelorus DCIDs**.
///
/// Integrators convert into `pelorus_ecdis::OwnShip` via `From`/`Into` in
/// **`ecdis/pelorus-ecdis/src/own_ship.rs`** (combined Pelorus checkout: `../../ecdis/pelorus-ecdis/src/own_ship.rs`
/// relative to this crate).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct OwnShipSnapshot {
    /// Latitude in degrees (north positive).
    pub lat_deg: Option<f64>,
    /// Longitude in degrees (east positive).
    pub lon_deg: Option<f64>,
    /// Course over ground — degrees true, \\([0, 360)\\).
    pub cog_true_deg: Option<f64>,
    /// Speed over ground — knots.
    pub sog_kn: Option<f64>,
    /// Heading — degrees true.
    pub heading_true_deg: Option<f64>,
    /// Depth below keel or transducer (metres) — product-specific semantics upstream.
    pub depth_m: Option<f64>,
    /// Heel (degrees), port negative.
    pub heel_deg: Option<f64>,
    /// Trim (degrees), bow-down negative.
    pub trim_deg: Option<f64>,
}

impl OwnShipSnapshot {
    /// Helper for chart smoke tests off a single GNSS fix.
    pub fn with_position(lat_deg: f64, lon_deg: f64) -> Self {
        Self {
            lat_deg: Some(lat_deg),
            lon_deg: Some(lon_deg),
            ..Self::default()
        }
    }

    /// Convenience builder for demos and CLI-driven shells: latitude/longitude/COG/SOG/heading together.
    ///
    /// Intended mapping from decoded Pelorus Core [`Dcid`](crate::dcid::Dcid) lanes (when populated from the bus):
    /// - `lat_deg` / `lon_deg` — [`GnssLatitude`](crate::dcid::Dcid::GnssLatitude) /
    ///   [`GnssLongitude`](crate::dcid::Dcid::GnssLongitude)
    /// - `cog_true_deg` — [`GnssCourseOverGround`](crate::dcid::Dcid::GnssCourseOverGround)
    /// - `sog_kn` — [`GnssSpeedOverGround`](crate::dcid::Dcid::GnssSpeedOverGround)
    /// - `heading_true_deg` — [`HeadingTrue`](crate::dcid::Dcid::HeadingTrue)
    #[must_use]
    pub fn with_navigation(
        lat_deg: f64,
        lon_deg: f64,
        cog_true_deg: f64,
        sog_kn: f64,
        heading_true_deg: f64,
    ) -> Self {
        Self {
            lat_deg: Some(lat_deg),
            lon_deg: Some(lon_deg),
            cog_true_deg: Some(cog_true_deg),
            sog_kn: Some(sog_kn),
            heading_true_deg: Some(heading_true_deg),
            ..Self::default()
        }
    }
}
