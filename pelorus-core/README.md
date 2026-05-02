# pelorus-core (Rust crate)

Core **CAN FD** / **DCID** integration, optional **VDR** (MDF4), and **own-ship** snapshots for charting — plus **`SemanticPath`** / **`CorrelationSlot`** under **`pelorus_core::correlation`**. Cargo package **`pelorus-core`** (Rust **`pelorus_core`**); sibling Stream/State crates: **`pelorus-stream/`**, **`pelorus-state/`** (workspace root: **`../`**).

This crate is **Rust integration** aligned with normative **Pelorus Core** in `specifications/`—it does not replace the spec text.

- **M7 / bare-metal:** `default-features = false`, then enable `canbus` without `vdr` or `std`.
- **`semantics`** (optional): enables `correlation_for_dcid` → `CorrelationSlot`.
- **Linux / A55:** default features include `vdr` for `mdf4-rs`.

Licensed **MIT OR Apache-2.0**. Workspace overview: **`../README.md`**.
