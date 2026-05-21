//! Host-side simulations for [`pelorus_core`] building blocks on [`pelorus_core::SimulatedBus`].
//!
//! Used during platform development — not shipped on embedded targets.

#![forbid(unsafe_code)]

pub mod addressing;
pub mod power;
pub mod transport;

/// Simulation failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimError(pub &'static str);

impl core::fmt::Display for SimError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(self.0)
    }
}

impl std::error::Error for SimError {}
