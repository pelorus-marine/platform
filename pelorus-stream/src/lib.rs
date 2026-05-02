//! Pelorus **Stream** subsystem — Ethernet, non–safety-critical transport plane.
//!
//! Decoders and network stacks accumulate here behind feature flags.
//! Semantic correlation surfaces through [`pelorus_semantics`].
//!
//! **Pelorus State** lives in **`pelorus-state`** in the same workspace.

#![cfg_attr(not(feature = "std"), no_std)]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod telemetry;

pub use telemetry::TelemetryEnvelope;
