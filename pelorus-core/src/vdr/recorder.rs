//! Placeholder surface for **`mdf4_rs::can::CanDbcLogger`**.
//!
//! A full recorder binary (`pelorus-vdr`) belongs in application code; keep this crate as an
//! integration library boundary.

#[cfg(feature = "vdr")]
use mdf4_rs::can::CanDbcLogger;

#[cfg(feature = "vdr")]
use dbc_rs::Dbc;

/// Static description for documentation / tooling without forcing a heavyweight constructor.
///
/// Enables type-checking that `mdf4-rs` stays wired when building with `--features vdr`.
pub struct VdrPipelineMarker;

#[cfg(feature = "vdr")]
impl VdrPipelineMarker {
    /// Builder entrypoint matching MDF4 ergonomics (`CanDbcLogger::builder`).
    ///
    /// Returns `mdf4_rs::Error` if the MDF4 internals reject configuration.
    pub fn build_example_logger(
        dbc: Dbc,
    ) -> mdf4_rs::Result<CanDbcLogger<mdf4_rs::writer::VecWriter>> {
        CanDbcLogger::builder(dbc).build()
    }
}
