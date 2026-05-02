#![no_std]
//! Pelorus **Cortex-M7** firmware scaffold — Embassy / FlexCAN FD integration **TODO**.
//!
//! **Invariant:** this crate must depend on [`pelorus_core`] with **`canbus_heapless`** only.
//! The **`vdr`** feature is **forbidden** here (A55 Linux only). See `PELORUS_IMPLEMENTATION_PLAN.md` §2.2.

/// Human-readable marker for documentation and smoke tests.
pub const ROLE: &str = "pelorus-m7 scaffold — Embassy tasks not yet wired";
