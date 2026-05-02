//! Shared Pelorus **signal identity** for correlating Core and Stream payloads.
//!
//! See [`SemanticPath`] and [`crate::correlation`]. **State** builds on these types in **`pelorus-state`**, same **`platform`** workspace.
//!
//! Transport code lives in **`pelorus-platform`** (Core) and **`pelorus-stream`** crates.

#![cfg_attr(not(feature = "std"), no_std)]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod correlation;

pub use correlation::{CorrelationSlot, SemanticPath};
