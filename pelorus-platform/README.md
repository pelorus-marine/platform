# pelorus-platform (Rust crate)

Core **CAN FD** / **DCID** integration, optional **VDR** (MDF4), and **own-ship** snapshots for charting. Cargo package **`pelorus-platform`**; sibling members: **`pelorus-semantics/`**, **`pelorus-stream/`**, **`pelorus-state/`** (workspace root: **`../`**).

- **M7 / bare-metal:** `default-features = false`, then enable `canbus` without `vdr` or `std`.
- **`semantics`** (optional): `correlation_for_dcid` → `pelorus-semantics::CorrelationSlot`.
- **Linux / A55:** default features include `vdr` for `mdf4-rs`.

Licensed **MIT OR Apache-2.0**. Workspace overview: **`../README.md`**.
