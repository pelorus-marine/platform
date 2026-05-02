# pelorus-core (Rust crate)

Core **CAN FD** / **DCID** integration, optional **VDR** (MDF4), and **own-ship** snapshots for charting — plus **`SemanticPath`** / **`CorrelationSlot`** under **`pelorus_core::correlation`**. Cargo package **`pelorus-core`** (Rust **`pelorus_core`**); sibling Stream/State crates: **`pelorus-stream/`**, **`pelorus-state/`** (workspace root: **`../`**).

This crate is **Rust integration** aligned with normative **Pelorus Core** in `specifications/`—it does not replace the spec text.

**Spec coverage in code (non-exhaustive):** `pelorus_core::dcid::protocol` — reserved DCIDs and **03** §3.2 DCID derivation / **0x0EA00** request payload; `pelorus_core::dcid::wire` — **04** §7 **WUF** / **NM** v1.0 eight-byte payloads. J1939 **transport protocol** reassembly (**03** §5) and **05** address-claim state machines are **not** implemented here yet (decode remains **DBC**-driven when **`canbus`** is enabled).

- **M7 / bare-metal:** `default-features = false`, then enable **`canbus`** (uses **`dbc-rs`** + **`alloc`**) or **`canbus_heapless`** (same CAN stack without a global allocator via **`dbc-rs/heapless`**). Do not enable both **`canbus`** and **`canbus_heapless`** on the same build.
- **`semantics`** (optional): enables `correlation_for_dcid` → `CorrelationSlot`.
- **Linux / A55:** default features include `vdr` for `mdf4-rs`.

Licensed **MIT OR Apache-2.0**. **MSRV:** Rust **1.88** (workspace **`rust-toolchain.toml`**). Workspace overview: **`../README.md`**.

**Embedded-first:** see **[`ARCHITECTURE.md` § Embedded-first](ARCHITECTURE.md#embedded-first)** and workspace **[`README.md` § Embedded-first](../README.md#embedded-first)**.
