//! Catalog **semantic path** handles and **`Vessel.*`** correlation metadata shared with Stream payloads.
//!
//! Normative prose lives under **`specifications/`** — these types are transport-agnostic wrappers only.

/// Borrowed **`Vessel.*`**-style semantic path (UTF-8).
///
/// This type does **not** parse paths; callers must uphold catalog spelling from **`specifications/`**.
///
/// Example: `"Vessel.Navigation.GNSS.Level1.Position.Latitude"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(transparent)]
pub struct SemanticPath<'a>(pub &'a str);

impl<'a> SemanticPath<'a> {
    /// Borrow the inner UTF-8 segment.
    pub fn as_str(self) -> &'a str {
        self.0
    }
}

impl<'a> From<&'a str> for SemanticPath<'a> {
    fn from(value: &'a str) -> Self {
        SemanticPath(value)
    }
}

/// Optional linkage from a telemetry sample to catalog semantics.
///
/// Stream payloads may attach this; gateways map DCID-bearing frames into the same shape.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CorrelationSlot<'a> {
    /// Catalog path when known.
    pub vessel: Option<SemanticPath<'a>>,
}

impl<'a> CorrelationSlot<'a> {
    /// No semantic correlation supplied.
    pub const fn unattached() -> Self {
        Self { vessel: None }
    }

    /// Attach only a catalog path (most common Pelorus correlation).
    pub const fn vessel_only(path: SemanticPath<'a>) -> Self {
        Self { vessel: Some(path) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semantic_path_round_trips_str() {
        let p = SemanticPath::from("Vessel.Navigation.GNSS.Level1.Position.Latitude");
        assert_eq!(
            p.as_str(),
            "Vessel.Navigation.GNSS.Level1.Position.Latitude"
        );
    }

    #[test]
    fn correlation_slot_vessel() {
        let c = CorrelationSlot::vessel_only(SemanticPath::from(
            "Vessel.Propulsion.Engines.Essential.Engine.SpeedRPM",
        ));
        assert!(c.vessel.is_some());
    }
}
