//! Canonical own-ship snapshot shared with charting crates.

/// ECDIS-facing snapshot: map directly from decoded **Pelorus DCIDs**.
///
/// Integrators convert into [`pelorus_ecdis::OwnShip`](https://docs.rs/pelorus-ecdis) via
/// `From`/`Into` implemented in **pelorus-ecdis** when wired to this crate.
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
}
