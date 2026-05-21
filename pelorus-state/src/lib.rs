//! Pelorus **State** subsystem — coordination, policy, and fusion over Core + Stream inputs.
//!
//! Lives in the **`platform`** workspace with **`pelorus-core`** and **`pelorus-stream`**.

#![cfg_attr(not(feature = "std"), no_std)]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

#[cfg(feature = "stream")]
use pelorus_stream::CorrelationSlot;

#[cfg(feature = "stream")]
pub use pelorus_stream::TelemetryEnvelope;

/// Marker until intent graphs and policy tables land.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct StateScaffold;

impl StateScaffold {
    /// Whether a [`CorrelationSlot`] is attached (demo hook for validation pipelines).
    #[cfg(feature = "stream")]
    pub fn correlation_attached(c: CorrelationSlot<'_>) -> bool {
        c.vessel.is_some()
    }
}

#[cfg(all(test, feature = "stream"))]
mod tests {
    use super::*;
    use pelorus_stream::SemanticPath;

    #[test]
    fn scaffold_sees_vessel_slot() {
        let c = CorrelationSlot::vessel_only(SemanticPath::from("Vessel.X"));
        assert!(StateScaffold::correlation_attached(c));
    }

    #[cfg(feature = "stream")]
    #[test]
    fn scaffold_sees_stream_correlation() {
        let env = TelemetryEnvelope::with_correlation(
            &[0],
            CorrelationSlot::vessel_only(SemanticPath::from("Vessel.X")),
        );
        assert!(StateScaffold::correlation_attached(env.correlation));
    }
}
