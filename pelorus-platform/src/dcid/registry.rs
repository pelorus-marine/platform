//! Canonical [`Dcid`] enum — Pelorus data channel identifiers.

/// Pelorus Data Channel Identifiers.
///
/// Each variant maps to a canonical signal with defined unit and semantics in the normative
/// catalog (see `specifications`).
/// `#[non_exhaustive]` forces consumers to allow future variants — intentional.
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Dcid {
    // Navigation
    /// Degrees north positive (WGS-84).
    GnssLatitude,
    /// Degrees east positive (WGS-84).
    GnssLongitude,
    /// Speed over ground (knots).
    GnssSpeedOverGround,
    /// Course over ground (degrees true).
    GnssCourseOverGround,
    /// Heading (degrees true).
    HeadingTrue,
    /// Heading (degrees magnetic).
    HeadingMagnetic,
    /// Rate of turn (degrees per minute).
    RateOfTurn,

    // Motion
    /// Heel angle; port heel negative (degrees).
    Heel,
    /// Trim angle; bow-down negative (degrees).
    Trim,
    /// Pitch (degrees).
    Pitch,
    /// Roll (degrees).
    Roll,

    // Propulsion
    /// Engine RPM; index selects engine instance.
    EngineRpm(u8),
    /// Fuel flow (L/h); index selects engine instance.
    FuelFlowRate(u8),
    /// Coolant temperature (°C); index selects engine instance.
    EngineCoolantTemp(u8),

    // Environment / safety-ish navigation aids
    /// Depth below keel (metres).
    DepthBelowKeel,
    /// Apparent wind speed (knots).
    WindSpeedApparent,
    /// Apparent wind angle (degrees).
    WindAngleApparent,
}
