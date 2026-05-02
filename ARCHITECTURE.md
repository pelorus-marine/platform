# platform — architecture record

**Last Updated:** May 5, 2026  
**Status:** Living (non-normative)

This file is the **project-facing** record for the **[`pelorus-marine/platform`](https://github.com/pelorus-marine/platform)** Git repository: a **Rust workspace** that implements and tools the Pelorus stack. It does **not** replace the normative **specifications** corpus; it explains how this repo is organized and how it relates to that work.

---

## 1. Project

### Mission (in this repository)

Ship a **coherent Rust workspace** for Pelorus: **Core integration** (`pelorus-core`), **Stream** and **State** scaffolds, **host tooling** (Inspector), and **in-tree** libraries that exist to serve Pelorus first—**`dbc-rs`** (DBC) and **`mdf4-rs`** (MDF4 / VDR-oriented logging)—not as independent product ends.

**Pelorus first** — product direction and **[`specifications/`](https://github.com/pelorus-marine/specifications)** define what lands; crates.io and upstream subtrees are downstream of that.

**Embedded first** — on-device code paths, `no_std` / heapless options, and explicit feature flags are first-class. The canonical narrative for this policy is **[`README.md` — Embedded-first](README.md#embedded-first)**.

### Normative source of truth

- **[Specifications repository](https://github.com/pelorus-marine/specifications)** — what the protocols *are* (Core, Stream, State, DCIDs, catalogs).
- **This repository** — reference-style Rust, CI, and integration glue aligned with those documents.

For the wider **Legacy Marine Data Ecosystem (LMDE)** context, problem statement, and trademark editorial rules, see **[`specifications/ARCHITECTURE.md`](https://github.com/pelorus-marine/specifications/blob/main/ARCHITECTURE.md)**. This file does not repeat that material except where it helps orient **platform** contributors.

### Presence

- [platform on GitHub](https://github.com/pelorus-marine/platform) — this workspace.
- [Pelorus project site](https://sevenseas.io/pelorus) — public landing.
- [Specifications](https://github.com/pelorus-marine/specifications) — spec source and change process.

---

## 2. What the workspace is

**`./platform`** is a **virtual workspace root**: a single [`Cargo.toml`](Cargo.toml) with `[workspace]` and **no** root `[package]`. Every crate is an **immediate subdirectory** of this folder (there is no `crates/` umbrella layer).

**Safe Rust only** — [`[workspace.lints]`](Cargo.toml) sets `unsafe_code = "forbid"`; each crate root uses `#![forbid(unsafe_code)]` where applicable.

**Implementation roadmap** for ECDIS / M7 / VDR scaffolds lives in **[`PELORUS_IMPLEMENTATION_PLAN.md`](PELORUS_IMPLEMENTATION_PLAN.md)** in this repository (vendored from the multi-repo workspace layout; same content as the Pelorus implementation plan you may keep beside other checkouts).

---

## 3. Workspace members (summary)

| Path | Role |
|------|------|
| [`pelorus-bounded/`](pelorus-bounded/) | Bounded strings and collections; **`dbc-rs`** `compat` re-exports for firmware-friendly types. |
| [`dbc-rs/`](dbc-rs/) | DBC parser — **in-tree subtree**; consumed by **`pelorus-core`** via `path` dependencies. |
| [`mdf4-rs/`](mdf4-rs/) | MDF4 library — **in-tree subtree**; VDR / logging paths on capable hosts. |
| [`pelorus-core/`](pelorus-core/) | **Core integration** — DCID schema, optional CAN decode, VDR hooks, own-ship snapshots for charting. See [`pelorus-core/ARCHITECTURE.md`](pelorus-core/ARCHITECTURE.md). |
| [`pelorus-stream/`](pelorus-stream/) | Stream transport scaffolding; depends on **`pelorus-core`** with tight feature control. |
| [`pelorus-state/`](pelorus-state/) | State fusion scaffolding; optional **`pelorus-stream`** via features. |
| [`pelorus-inspector/`](pelorus-inspector/) | Desktop tooling (Tauri); not on embedded targets. |
| [`pelorus-vdr/`](pelorus-vdr/) | **Phase 3** VDR **binary scaffold** (Linux / A55 orientation); MDF4 naming aligns with **`pelorus_core::vdr`**. |
| [`pelorus-m7/`](pelorus-m7/) | **Phase 2** **no_std** firmware **library scaffold** — **`pelorus-core`** with **`canbus_heapless`** only; **must not** enable **`vdr`** (host-side). |

**Default workspace member for local iteration:** **`pelorus-core`** (`default-members` in [`Cargo.toml`](Cargo.toml)).

---

## 4. Dependency direction (high level)

Conceptually:

- **`pelorus-core`** sits at the center for **DCIDs**, CAN/DBC integration, and ECDIS-facing snapshots.
- **`pelorus-stream`** and **`pelorus-state`** build **on** Core types with bounded coupling (see crate READMEs).
- **`dbc-rs`** / **`mdf4-rs`** are **support libraries** pulled in through **`pelorus-core`** features—not parallel “products” competing with Core.

Detailed graphs and M7 vs Linux split live in **[`pelorus-core/ARCHITECTURE.md`](pelorus-core/ARCHITECTURE.md)**.

---

## 5. Supporting libraries (`dbc-rs`, `mdf4-rs`)

These directories are **squashed subtree** snapshots maintained **here** for Pelorus. **`pelorus-core`** uses **`path`** dependencies. Optional standalone org repos (**`pelorus-marine/dbc-rs`**, **`pelorus-marine/mdf4-rs`**) remain **deferred** unless publishing policy requires them; subtrees in this workspace stay authoritative for day-to-day work.

Subtree pulls from upstream, when needed, follow **`README.md`** and contributor docs.

---

## 6. Catalog correlation

**`SemanticPath`** and **`CorrelationSlot`** live in **`pelorus_core::correlation`**. The **`semantics`** Cargo feature gates **`correlation_for_dcid`** mapping from **`Dcid`** to catalog-style paths; it does **not** introduce a separate semantics crate.

---

## 7. Trademarks and third-party names

When this codebase or its docs mention marine industry buses and brands **by example**, follow the same **nominative** and **non-endorsement** posture as **[`specifications/ARCHITECTURE.md` §4](https://github.com/pelorus-marine/specifications/blob/main/ARCHITECTURE.md#4-trademarks-and-third-party-names)**. **This is not legal advice.**

---

## 8. Further reading

| Document | Purpose |
|----------|---------|
| [`README.md`](README.md) | Principles, clone instructions, embedded-first canon. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution and CI expectations. |
| [`pelorus-core/ARCHITECTURE.md`](pelorus-core/ARCHITECTURE.md) | Package-level Core integration layout. |
| [`PELORUS_IMPLEMENTATION_PLAN.md`](PELORUS_IMPLEMENTATION_PLAN.md) | Phased ECDIS / M7 / VDR / hardware plan. |
