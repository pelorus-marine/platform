//! Catalog semantic path handles (transport-agnostic).

/// Borrowed `Vessel.*`-style semantic path (UTF-8).
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

    /// Attach only a catalog path.
    pub const fn vessel_only(path: SemanticPath<'a>) -> Self {
        Self { vessel: Some(path) }
    }
}
