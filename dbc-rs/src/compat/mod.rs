//! Bounded [`Vec`], [`String`], and [`BTreeMap`] from [`pelorus_bounded`], wired to DBC compile-time limits.
//!
//! With **`heapless`**, [`BTreeMap`] wraps `heapless::LinearMap` (iteration follows insertion order, not sorted keys).

#[cfg(feature = "alloc")]
extern crate alloc;

pub use pelorus_bounded::{BTreeMap, String, Vec};

use crate::{Error, MAX_NAME_SIZE, MAX_VALUE_DESCRIPTIONS, Result};

/// Maximum size for comment text (CM_ entries).
/// Not defined in DBC spec, using 256 as reasonable default.
pub const MAX_COMMENT_SIZE: usize = 256;

// ============================================================================
// Common Type Aliases
// ============================================================================

/// A name string with `MAX_NAME_SIZE` limit.
///
/// Used for identifiers like signal names, message names, node names, etc.
pub type Name = String<{ MAX_NAME_SIZE }>;

/// A comment string with `MAX_COMMENT_SIZE` limit.
///
/// Used for CM_ comment text (messages, signals, nodes, database).
pub type Comment = String<MAX_COMMENT_SIZE>;

/// A value description entry: `(numeric_value, description_string)`.
///
/// Used in VAL_ statements to map signal values to human-readable text.
pub type ValueDescEntry = (u64, Name);

/// A collection of value description entries.
pub type ValueDescEntries = Vec<ValueDescEntry, { MAX_VALUE_DESCRIPTIONS }>;

/// Validates and converts a string to a [`Name`] with `MAX_NAME_SIZE` limit.
#[inline]
pub fn validate_name<S: AsRef<str>>(name: S) -> Result<Name> {
    let name_str: &str = name.as_ref();

    if name_str.len() > MAX_NAME_SIZE {
        return Err(Error::expected(Error::MAX_NAME_SIZE_EXCEEDED));
    }

    String::try_from(name_str).map_err(|_| Error::expected(Error::MAX_NAME_SIZE_EXCEEDED))
}
