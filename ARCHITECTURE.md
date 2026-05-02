# platform workspace — architecture

**Pelorus first:** the **`pelorus-*`** members and spec-facing APIs are the center of gravity. **`dbc-rs`** and **`mdf4-rs`** are in-tree **support** for **`pelorus-core`** (CAN decode, VDR/MDF4).

This directory (`./platform`) is the **Cargo workspace root** with a **virtual manifest** only (`Cargo.toml` containing `[workspace]` and no `[package]`). All Rust packages are **immediate child directories** of this folder (no `crates/` aggregate). **Safe Rust only:** `unsafe_code = "forbid"` at workspace level and `#![forbid(unsafe_code)]` on each crate root.

- **Core integration (Cargo package `pelorus-core`):** [`pelorus-core/ARCHITECTURE.md`](pelorus-core/ARCHITECTURE.md)
- **Catalog correlation (`SemanticPath`, `CorrelationSlot`):** **`pelorus_core::correlation`** (same package as Core integration — no standalone semantics crate).
- **Stream plane:** `pelorus-stream/` — depends on **`pelorus-core`** with default features off (types only by default).
- **State plane:** `pelorus-state/` — optional dependency on `pelorus-stream` via feature `stream`
- **DBC / MDF in-tree:** `dbc-rs/`, `mdf4-rs/` — subtree-backed; **`path`** deps from **`pelorus-core`**

Dependency direction: **`pelorus-core`** (lightweight, `default-features = false`) ← **stream**; **core** (+ optional **stream**) ← **state**. The **`semantics`** feature on **`pelorus-core`** only gates `correlation_for_dcid`; it does not pull a separate crate.

See `PELORUS_IMPLEMENTATION_PLAN.md` at the monorepo root.
