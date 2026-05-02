# platform (Rust workspace)

**Pelorus first. Period.**  
This workspace ships the **Pelorus** stack: **`pelorus-core`** (includes catalog correlation types), Stream, State, aligned with **`specifications/`**. In-tree **`dbc-rs`** and **`mdf4-rs`** exist to **serve Pelorus** (CAN/DBC, MDF4/VDR)—not as ends in themselves.

## Principles

- **By sailors, for sailors** — Bridge workflows, regulation, and life at sea set the bar; generic lab or automotive defaults do not.
- **Pelorus first** — Product direction and **`specifications/`** define what ships first. Subtrees and crates.io are downstream of that.
- **Embedded first** — **`no_std`**, bounded memory, and core trust boundaries (e.g. M-class vs Linux) shape APIs and CI from the start—not as a later retrofit.

## Repository

- **Origin:** `git@github.com:pelorus-marine/platform.git`
- **Clone:** `git clone git@github.com:pelorus-marine/platform.git && cd platform`

## Layout (invariants)

0. **Pelorus first** — Decisions favor **Pelorus product and spec alignment** over generic library polish. **`dbc-rs`** / **`mdf4-rs`** evolve in this repo; crates.io releases remain downstream of Pelorus needs (the original standalone GitHub repos are **archived**, not pull sources for new work).
1. **Workspace root** — This directory (`./platform`) is the Cargo workspace root only: a virtual manifest (`Cargo.toml` with `[workspace]`), shared `README` / `LICENSE-*`, and tooling config. There is **no** `[package]` crate at the root path and **no** `src/` or `tests/` here—only workspace members as subdirectories.
2. **Member subfolders only** — Every Rust package lives in its **own subdirectory** alongside this `Cargo.toml` and is listed under `[workspace].members`. The Core integration library (Cargo package **`pelorus-core`**) lives under **`pelorus-core/`**.
3. **Safe Rust only** — Workspace-wide `unsafe_code = "forbid"` (`[workspace.lints]`), plus `#![forbid(unsafe_code)]` on each crate root.

Rust **1.87.x** is pinned in **`rust-toolchain.toml`** (required by the in-tree **`mdf4-rs`** toolchain policy).

### Supporting libraries (`dbc-rs`, `mdf4-rs`)

These directories are **squashed subtree** snapshots for Pelorus (**`pelorus-core`** uses **`path`** deps). **`main` development happens only in this repository.**

The original standalone repos **[`reneherrero/dbc-rs`](https://github.com/reneherrero/dbc-rs)** and **[`reneherrero/mdf4-rs`](https://github.com/reneherrero/mdf4-rs)** are **archived (read-only)**; do not subtree-pull from them for new work—they no longer receive changes. Historical context only.

Published **`repository`** URLs on crates.io point at **`pelorus-marine/platform`** ([`dbc-rs` tree](https://github.com/pelorus-marine/platform/tree/main/dbc-rs), [`mdf4-rs` tree](https://github.com/pelorus-marine/platform/tree/main/mdf4-rs)).

```bash
git subtree pull --prefix dbc-rs https://github.com/reneherrero/dbc-rs.git main --squash   # archived — historic only
git subtree pull --prefix mdf4-rs https://github.com/reneherrero/mdf4-rs.git main --squash   # archived — historic only
```

Publishing **`dbc-rs`** / **`mdf4-rs`** to crates.io from this tree is supported for the wider ecosystem; **Pelorus** priorities still come first here.

Separate **`pelorus-marine/dbc-rs`** / **`pelorus-marine/mdf4-rs`** GitHub repositories are **optional** (ecosystem and branding); **`pelorus-core`** integration assumes **only** this workspace—in-tree crates and subtree policy—without requiring standalone org-only library repos.

Further context: normative specs stay in `specifications/`, the ECDIS app in `ecdis/`.

| Member | Role |
|--------|------|
| **`pelorus-core/`** | **Package `pelorus-core`** — Pelorus CAN FD / DCID / VDR / own-ship; `SemanticPath` / `CorrelationSlot` |
| **`pelorus-stream/`** | Stream telemetry envelope + future wire decoders |
| **`pelorus-state/`** | State / fusion hooks over Core correlation (+ optional `stream`) |
| **`dbc-rs/`** | DBC/CAN substrate (was subtree from archived [`reneherrero/dbc-rs`](https://github.com/reneherrero/dbc-rs)) |
| **`mdf4-rs/`** | MDF4 substrate (was subtree from archived [`reneherrero/mdf4-rs`](https://github.com/reneherrero/mdf4-rs)) |

```bash
cd platform
cargo build --workspace
cargo test --workspace --all-features
cargo check -p pelorus-core --no-default-features --features canbus,alloc
```

Licensed **MIT OR Apache-2.0** (see `LICENSE-*` in this directory).
