//! Canonical [`Dcid`] enum — Pelorus data channel identifiers.
//!
//! Numeric **wire DCIDs** for Pelorus-specific frames are normative in
//! `specifications/core/07-dcid-registry.md`. Derivation from 29-bit identifiers follows
//! `specifications/core/03-data-link-layer.md` §3.2. Assignments for standard marine lanes are
//! filled in as the catalog (`06-signal-catalog.md`) and registry converge — use
//! [`core_wire_numeric_id`] where a single canonical value exists today.
//!
//! **Wire vs semantic `Dcid`:** A single broadcast frame (e.g. J1939 EEC1, wire **`0xF004`**)
//! carries **multiple** signals — decode requires **DBC** field slices + binding table; use
//! [`WireDcidClass`] / [`classify_core_wire`] before assuming one [`Dcid`] per frame.

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

use super::protocol::{
    DCID_ADDRESS_CLAIMED, DCID_REQUEST, DCID_TRANSPORT_CONNECTION, DCID_TRANSPORT_DATA,
};

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

/// Classifies a Pelorus Core **numeric DCID** (derived per **03** §3.2, **without** source address).
///
/// Use this at the boundary between the data-link DCID value and higher layers: protocol/control
/// frames (**03** §4), Pelorus extension messages (**07** §1), vs application broadcast carriers
/// that need **DBC** decoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WireDcidClass {
    /// **03** §4 — address claim, request, transport (**not** catalog signal lanes).
    ProtocolControl,
    /// **07** §1 — wake-up / network management map to dedicated [`Dcid`] variants.
    PelorusExtension(Dcid),
    /// Application PDU — `wire` is the numeric DCID; signals are resolved via DBC / binding (**06**).
    Application {
        /// Numeric DCID (**03** §3.2), e.g. **`0xF004`** EEC1.
        wire: u32,
    },
}

/// Returns **`true`** when `wire` is an **03** §4 protocol/control DCID (address claim, request, TP).
#[must_use]
pub fn is_protocol_control_dcid(wire: u32) -> bool {
    matches!(
        wire,
        DCID_ADDRESS_CLAIMED | DCID_REQUEST | DCID_TRANSPORT_CONNECTION | DCID_TRANSPORT_DATA
    )
}

/// Classify a core numeric DCID (`derive_dcid` / [`super::protocol::dcid_from_extended_id`] output).
#[must_use]
pub fn classify_core_wire(wire: u32) -> WireDcidClass {
    if is_protocol_control_dcid(wire) {
        WireDcidClass::ProtocolControl
    } else if let Some(d) = dcid_from_pelorus_extension_wire(wire) {
        WireDcidClass::PelorusExtension(d)
    } else {
        WireDcidClass::Application { wire }
    }
}

/// Writes `pelorus/<Stem>` (**implementation plan** §3.2 MDF4 channel naming).
///
/// Returns the number of UTF-8 bytes written, or [`None`] if `out` is too small.
/// Indexed variants use underscores: `pelorus/EngineRpm_0`, …
#[must_use]
pub fn write_mdf4_pelorus_path(dcid: &Dcid, out: &mut [u8]) -> Option<usize> {
    const PREFIX: &[u8] = b"pelorus/";
    if out.len() < PREFIX.len() {
        return None;
    }
    out[..PREFIX.len()].copy_from_slice(PREFIX);
    let mut n = PREFIX.len();
    let stem = match dcid {
        Dcid::GnssLatitude => copy_lit(out, &mut n, b"GnssLatitude")?,
        Dcid::GnssLongitude => copy_lit(out, &mut n, b"GnssLongitude")?,
        Dcid::GnssSpeedOverGround => copy_lit(out, &mut n, b"GnssSpeedOverGround")?,
        Dcid::SpeedThroughWater => copy_lit(out, &mut n, b"SpeedThroughWater")?,
        Dcid::GnssCourseOverGround => copy_lit(out, &mut n, b"GnssCourseOverGround")?,
        Dcid::HeadingTrue => copy_lit(out, &mut n, b"HeadingTrue")?,
        Dcid::HeadingMagnetic => copy_lit(out, &mut n, b"HeadingMagnetic")?,
        Dcid::RateOfTurn => copy_lit(out, &mut n, b"RateOfTurn")?,
        Dcid::Heel => copy_lit(out, &mut n, b"Heel")?,
        Dcid::Trim => copy_lit(out, &mut n, b"Trim")?,
        Dcid::Pitch => copy_lit(out, &mut n, b"Pitch")?,
        Dcid::Roll => copy_lit(out, &mut n, b"Roll")?,
        Dcid::EngineRpm(i) => {
            copy_lit(out, &mut n, b"EngineRpm_")?;
            write_u8_decimal(out, &mut n, *i)?;
            n
        }
        Dcid::FuelFlowRate(i) => {
            copy_lit(out, &mut n, b"FuelFlowRate_")?;
            write_u8_decimal(out, &mut n, *i)?;
            n
        }
        Dcid::EngineCoolantTemp(i) => {
            copy_lit(out, &mut n, b"EngineCoolantTemp_")?;
            write_u8_decimal(out, &mut n, *i)?;
            n
        }
        Dcid::DepthBelowKeel => copy_lit(out, &mut n, b"DepthBelowKeel")?,
        Dcid::WaterTemperature => copy_lit(out, &mut n, b"WaterTemperature")?,
        Dcid::WindSpeedApparent => copy_lit(out, &mut n, b"WindSpeedApparent")?,
        Dcid::WindAngleApparent => copy_lit(out, &mut n, b"WindAngleApparent")?,
        Dcid::PelorusWakeUpFrame => copy_lit(out, &mut n, b"PelorusWakeUpFrame")?,
        Dcid::PelorusNetworkManagement => copy_lit(out, &mut n, b"PelorusNetworkManagement")?,
    };
    Some(stem)
}

fn copy_lit(out: &mut [u8], off: &mut usize, lit: &[u8]) -> Option<usize> {
    if *off + lit.len() > out.len() {
        return None;
    }
    out[*off..*off + lit.len()].copy_from_slice(lit);
    *off += lit.len();
    Some(*off)
}

fn write_u8_decimal(out: &mut [u8], off: &mut usize, mut v: u8) -> Option<usize> {
    if v == 0 {
        return copy_lit(out, off, b"0");
    }
    let start = *off;
    let mut tmp = [0u8; 3];
    let mut i = 0;
    while v > 0 {
        tmp[i] = b'0' + (v % 10);
        v /= 10;
        i += 1;
    }
    for j in (0..i).rev() {
        copy_lit(out, off, &tmp[j..j + 1])?;
    }
    Some(start + (*off - start))
}

/// [`write_mdf4_pelorus_path`] as an owned UTF-8 string (**`std`** only).
#[cfg(feature = "std")]
#[must_use]
pub fn mdf4_pelorus_path_string(dcid: &Dcid) -> std::string::String {
    let mut buf = [0u8; 72];
    let Some(n) = write_mdf4_pelorus_path(dcid, &mut buf) else {
        return std::string::String::new();
    };
    std::string::String::from_utf8_lossy(&buf[..n]).into_owned()
}
