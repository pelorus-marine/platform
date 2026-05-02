//! Canonical [`Dcid`] enum — Pelorus data channel identifiers.
//!
//! Numeric **wire DCIDs** for Pelorus-specific frames are normative in
//! `specifications/core/07-dcid-registry.md`. Derivation from 29-bit identifiers follows
//! `specifications/core/03-data-link-layer.md` §3.2. Assignments for standard marine lanes are
//! filled in as the catalog (`06-signal-catalog.md`) and registry converge — use
//! [`core_wire_numeric_id`] where a single canonical value exists today.

/// Pelorus-specific extension DCIDs (`specifications/core/07-dcid-registry.md` §1).
pub const DCID_PELORUS_WAKE_UP_FRAME: u32 = 0x0FF80;
/// Pelorus-specific extension DCIDs (`specifications/core/07-dcid-registry.md` §1).
pub const DCID_PELORUS_NETWORK_MANAGEMENT: u32 = 0x0FF81;

/// J1939 **Electronic Engine Controller 1** (EEC1) — engine speed among other fields.
///
/// Pelorus DCID derivation for PDU2 with `PF = 0xF0`, `PS = 0x04`, `R = 0`, `DP = 0` yields
/// **`0xF004`** (`specifications/core/03-data-link-layer.md` §3.2). The signal catalog example
/// (`specifications/core/06-signal-catalog.md` §7) cites `dcid: 0xF004` as the PGN shorthand for
/// the same broadcast family; instance selection uses the binding table, not distinct DCID values.
pub const DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1: u32 = 0xF004;

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
    /// Speed through water (knots).
    SpeedThroughWater,
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
    /// Sea surface / ambient water temperature (°C) — product-specific sensor placement upstream.
    WaterTemperature,
    /// Apparent wind speed (knots).
    WindSpeedApparent,
    /// Apparent wind angle (degrees).
    WindAngleApparent,

    // Pelorus extension wire frames (numeric IDs in `specifications/core/07-dcid-registry.md` §1)
    /// DCID **0x0FF80** — wake-up frame (PNC mask).
    PelorusWakeUpFrame,
    /// DCID **0x0FF81** — network management / power state.
    PelorusNetworkManagement,
}

/// Numeric DCID for Pelorus extension wire frames only (`0x0FF80`–`0x0FFFF` assignments in **07**).
#[must_use]
pub fn pelorus_extension_wire_id(d: Dcid) -> Option<u32> {
    match d {
        Dcid::PelorusWakeUpFrame => Some(DCID_PELORUS_WAKE_UP_FRAME),
        Dcid::PelorusNetworkManagement => Some(DCID_PELORUS_NETWORK_MANAGEMENT),
        _ => None,
    }
}

/// Decode a Pelorus extension DCID from **07** §1 into [`Dcid`].
///
/// Returns [`None`] for values outside the defined Pelorus extension messages or for reserved
/// gaps (`0x0FF82`–`0x0FF8F`, etc.).
#[must_use]
pub fn dcid_from_pelorus_extension_wire(wire: u32) -> Option<Dcid> {
    match wire {
        DCID_PELORUS_WAKE_UP_FRAME => Some(Dcid::PelorusWakeUpFrame),
        DCID_PELORUS_NETWORK_MANAGEMENT => Some(Dcid::PelorusNetworkManagement),
        _ => None,
    }
}

/// Canonical Pelorus Core wire numeric DCID when the specifications assign exactly one value.
///
/// Returns [`None`] for lanes that are catalog-defined but not yet allocated in **07** (or that
/// share a multi-signal J1939 frame — decode requires DBC / field slices, not DCID alone).
#[must_use]
pub fn core_wire_numeric_id(d: Dcid) -> Option<u32> {
    match d {
        Dcid::PelorusWakeUpFrame => Some(DCID_PELORUS_WAKE_UP_FRAME),
        Dcid::PelorusNetworkManagement => Some(DCID_PELORUS_NETWORK_MANAGEMENT),
        Dcid::EngineRpm(_) => Some(DCID_J1939_ELECTRONIC_ENGINE_CONTROLLER_1),
        _ => None,
    }
}
