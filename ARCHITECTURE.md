# platform workspace — architecture

This directory (`./platform`) is the **Cargo workspace root** with a **virtual manifest** only (`Cargo.toml` containing `[workspace]` and no `[package]`). All Rust packages are **immediate child directories** of this folder (no `crates/` aggregate). **Safe Rust only:** `unsafe_code = "forbid"` at workspace level and `#![forbid(unsafe_code)]` on each crate root.

- **Core integration (Cargo package `pelorus-platform`):** [`pelorus-platform/ARCHITECTURE.md`](pelorus-platform/ARCHITECTURE.md)
- **Shared types:** `pelorus-semantics/` — no transport logic
- **Stream plane:** `pelorus-stream/` — depends on semantics only
- **State plane:** `pelorus-state/` — optional dependency on `pelorus-stream` via feature `stream`

Dependency direction: **semantics** ← **stream**; **semantics** (+ optional **stream**) ← **state**; the **`pelorus-platform`** package may use **semantics** behind the `semantics` feature and stays separate from Stream/State engines.

See `PELORUS_IMPLEMENTATION_PLAN.md` at the monorepo root.
