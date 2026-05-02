//! Errors from bounded collection operations.

/// Failure modes for [`super::Vec`], [`super::String`], and [`super::BTreeMap`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum Error {
    /// Capacity or element bound (`N`) would be exceeded.
    CapacityExceeded,
    /// UTF-8 validation failed.
    InvalidUtf8,
}

pub type Result<T> = core::result::Result<T, Error>;
