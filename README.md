# platform (Rust workspace)

**Pelorus first. Period.**  
This workspace ships the **Pelorus** stack: **`pelorus-core`** (includes catalog correlation types), Stream, State, aligned with **`specifications/`**. In-tree **`dbc-rs`** and **`mdf4-rs`** exist to **serve Pelorus** (CAN/DBC, MDF4/VDR)—not as ends in themselves.

## Repository

- **Origin:** `git@github.com:pelorus-marine/platform.git`
- **Clone:** `git clone git@github.com:pelorus-marine/platform.git && cd platform`

## Layout (invariants)

0. **Pelorus first** — Decisions favor **Pelorus product and spec alignment** over generic library polish. Upstream subtree sync is for **Pelorus needs**; crates.io releases of `dbc-rs` / `mdf4-rs` are downstream of that.
1. **Workspace root** — This directory (`./platform`) is the Cargo workspace root only: a virtual manifest (`Cargo.toml` with `[workspace]`), shared `README` / `LICENSE-*`, and tooling config. There is **no** `[package]` crate at the root path and **no** `src/` or `tests/` here—only workspace members as subdirectories.
2. **Member subfolders only** — Every Rust package lives in its **own subdirectory** alongside this `Cargo.toml` and is listed under `[workspace].members`. The Core integration library (Cargo package **`pelorus-core`**) lives under **`pelorus-core/`**.
3. **Safe Rust only** — Workspace-wide `unsafe_code = "forbid"` (`[workspace.lints]`), plus `#![forbid(unsafe_code)]` on each crate root.

Rust **1.87.x** is pinned in **`rust-toolchain.toml`** (required by the in-tree **`mdf4-rs`** toolchain policy).

### Supporting libraries (git subtree, Pelorus-curated)

**`dbc-rs/`** and **`mdf4-rs/`** are squashed **`git subtree`** copies, kept in-repo so **`pelorus-core`** uses **`path`** deps and **Pelorus** can move in lockstep with DBC/VDR work. Source of truth for those projects remains on GitHub ([dbc-rs](https://github.com/reneherrero/dbc-rs), [mdf4-rs](https://github.com/reneherrero/mdf4-rs)); pull when the **Pelorus** stack needs upstream fixes:

```bash
git subtree pull --prefix dbc-rs https://github.com/reneherrero/dbc-rs.git main --squash
git subtree pull --prefix mdf4-rs https://github.com/reneherrero/mdf4-rs.git main --squash
```

Publishing **`dbc-rs`** / **`mdf4-rs`** to crates.io from this tree is supported for the wider ecosystem; **Pelorus** priorities still come first here.

Further context: normative specs stay in `specifications/`, the ECDIS app in `ecdis/`.

| Member | Role |
|--------|------|
| **`pelorus-core/`** | **Package `pelorus-core`** — Pelorus CAN FD / DCID / VDR / own-ship; `SemanticPath` / `CorrelationSlot` |
| **`pelorus-stream/`** | Stream telemetry envelope + future wire decoders |
| **`pelorus-state/`** | State / fusion hooks over Core correlation (+ optional `stream`) |
| **`dbc-rs/`** | DBC/CAN substrate (subtree → [upstream](https://github.com/reneherrero/dbc-rs)) |
| **`mdf4-rs/`** | MDF4 substrate (subtree → [upstream](https://github.com/reneherrero/mdf4-rs)) |

```bash
cd platform
cargo build --workspace
cargo test --workspace --all-features
cargo check -p pelorus-core --no-default-features --features canbus,alloc
```

Licensed **MIT OR Apache-2.0** (see `LICENSE-*` in this directory).
