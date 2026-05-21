#![no_std]
//! Pelorus **Cortex-M7** firmware scaffold — Embassy / FlexCAN FD integration **TODO**.
//!
//! **Invariant:** depend on [`pelorus_core`] with **`default-features = false`** (no `sim` on target firmware).
//! Implement [`pelorus_core::CanFdBus`] for the on-chip CAN FD driver.

/// Human-readable marker for documentation and smoke tests.
pub const ROLE: &str = "pelorus-m7 scaffold — Embassy tasks not yet wired";
