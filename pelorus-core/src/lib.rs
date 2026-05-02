//! Pelorus **`pelorus-core`** Rust crate: **DCID** schema, optional **CAN bus** decode, optional **VDR**
//! hooks, and **own-ship** snapshots for charting.
//!
//! **`pelorus-stream`** and **`pelorus-state`** are sibling crates under the **`platform/`** workspace root (`../`).
//! Shared catalog correlation types live in **`correlation`** (no separate semantics crate).
//!
//! See the workspace **`README.md`** and [`ARCHITECTURE.md`] in this directory.
//!
//! Disable default features on MCUs: omit `std` and `vdr`, keep `canbus` for CAN FD + DBC decode.
//!
//! ## Safety
//!
//! `#![forbid(unsafe_code)]` is a project invariant (see `PELORUS_IMPLEMENTATION_PLAN.md`).

#![cfg_attr(not(feature = "std"), no_std)]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod correlation;
#[cfg(feature = "canbus")]
pub mod canbus;
pub mod dcid;
pub mod ownship;
#[cfg(feature = "semantics")]
pub mod semantics;
#[cfg(feature = "vdr")]
pub mod vdr;

pub use correlation::{CorrelationSlot, SemanticPath};
pub use ownship::snapshot::OwnShipSnapshot;
pub use ownship::state::ShipState;
#[cfg(feature = "semantics")]
pub use semantics::correlation_for_dcid;
