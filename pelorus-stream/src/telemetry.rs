//! Stream **telemetry envelope**: payload bytes + optional semantic correlation.

use crate::correlation::CorrelationSlot;

/// Telemetry frame as seen after transport decryption (ordering TBD — placeholder).
///
/// Carries [`CorrelationSlot`] so publishers can optionally attach **`Vessel.*`** paths,
/// aligning with **`core/06-signal-catalog`** linkage rules for Stream payloads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TelemetryEnvelope<'a> {
    /// Uninterpreted payload (future: CBOR, codec-specific slice).
    pub payload: &'a [u8],
    /// Optional catalog correlation for gateways and tooling.
    pub correlation: CorrelationSlot<'a>,
}

impl<'a> TelemetryEnvelope<'a> {
    /// Raw payload without catalog correlation metadata.
    pub fn anonymous(payload: &'a [u8]) -> Self {
        Self {
            payload,
            correlation: CorrelationSlot::unattached(),
        }
    }

    /// Payload annotated with semantics correlation metadata.
    pub fn with_correlation(payload: &'a [u8], correlation: CorrelationSlot<'a>) -> Self {
        Self {
            payload,
            correlation,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::correlation::SemanticPath;

    #[test]
    fn envelope_can_carry_semantic_slot() {
        let env = TelemetryEnvelope::with_correlation(
            &[1, 2, 3],
            CorrelationSlot::vessel_only(SemanticPath::from(
                "Vessel.Navigation.GNSS.Level1.Position.Latitude",
            )),
        );
        assert_eq!(env.payload, [1, 2, 3]);
        assert!(env.correlation.vessel.is_some());
    }
}
