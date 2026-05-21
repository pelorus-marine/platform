# platform (Rust workspace)

**Pelorus first. Period.**  
This workspace ships the **Pelorus** stack: **`pelorus-core`** (Core **building blocks**, embedded-first via **`pelorus-bounded`**), Stream, State, aligned with **`specifications/`**. Reference binaries that **prove** Core blocks live in **`reference-implementations/`**. In-tree **`dbc-rs`** and **`mdf4-rs`** support future VDR/decode paths—not Core MVP blockers.

## Principles

- **By sailors, for sailors** — Bridge workflows, regulation, and life at sea set the bar; generic lab or automotive defaults do not.
- **Pelorus first** — Product direction and **`specifications/`** define what ships first. Subtrees and crates.io are downstream of that.
- **Open, transparent, community** — Full stack, inspectable source, public collaboration; credits and policy in **[`CONTRIBUTORS.md`](CONTRIBUTORS.md)**.
- **Non-commercial** — This open-source initiative is **not** aimed at commercialization; it exists for **public, safety-aware** maritime software.
- **Rust** — The **supported** implementation language for Pelorus crates here is **Rust**, with **maximum practical safety** (`#![forbid(unsafe_code)]` where workspace lint policy applies).
- **Embedded-first** — On-device code paths define trust and capacity budgets; see [Embedded-first](#embedded-first) below.

## Embedded-first

**This section is canonical for the workspace.** Crate READMEs link here instead of repeating the full policy.

**Devices on the vessel—MCUs, bus gateways, sensors—are first-class citizens.** They are the **reference runtime** for what Pelorus must guarantee (semantics, timing, memory, failure modes). Host tools (**Inspector**, **`pelorus-agent`**, ECDIS consumers) **ingest and visualize** what those devices produce; they do not retroactively redefine “minimum viable” behavior in ways that break targets with fixed RAM and no desktop affordances.

Concretely:

- **`no_std` and bounded memory** shape APIs and reviews from the start. Prefer **explicit limits**, **deterministic errors** (no silent growth), and **optional features** so `std`, heavy serde trees, or unbounded heaps are not on the critical path for settlers.
- **CI must exercise minimal feature sets**—e.g. `cargo check -p pelorus-core --no-default-features --features heapless` and `features alloc`—so regressions show up before a product board does.
- **`dbc-rs`** **`compat`** re-exports **`pelorus-bounded`** (`alloc` vs **`heapless`**) so DBC-shaped strings and collections match **_firmware_** policies, not only desktop parsers.
- **`mdf4-rs`** today is **`no_std` + `alloc`** for writers and bus loggers where a **global allocator** is acceptable; targets that **cannot** use `alloc` need a **named, tiered story** (capped writer subset, ring-buffer + finalize, or host-side MDF packaging)—that gap is acknowledged and closed deliberately, not by pretending MDF equals laptop RAM.
- **Bounded primitives** live in **`pelorus-bounded`**; **`pelorus-core`** always consumes them via **`alloc`** or **`heapless`** features (no ad-hoc `alloc::vec` in library code).

**Pelorus first** still resolves conflicts—but **embedded-first** means those conflicts are judged against **what ships on silicon**, not host convenience alone.

## Repository

- **Origin:** `git@github.com:pelorus-marine/platform.git`
- **Clone:** `git clone git@github.com:pelorus-marine/platform.git && cd platform`

## Layout (invariants)

0. **Pelorus first** — Decisions favor **Pelorus product and spec alignment** over generic library polish. **`dbc-rs`** / **`mdf4-rs`** evolve in this repo; crates.io releases remain downstream of Pelorus needs (the original standalone GitHub repos are **archived**, not pull sources for new work).
1. **Workspace root** — This directory (`./platform`) is the Cargo workspace root only: a virtual manifest (`Cargo.toml` with `[workspace]`), shared `README` / `LICENSE-*`, and tooling config. There is **no** `[package]` crate at the root path and **no** `src/` or `tests/` here—only workspace members as subdirectories.
2. **Member subfolders only** — Every Rust package lives in its **own subdirectory** alongside this `Cargo.toml` and is listed under `[workspace].members`. The Core integration library (Cargo package **`pelorus-core`**) lives under **`pelorus-core/`**.
3. **Safe Rust only** — Workspace-wide `unsafe_code = "forbid"` (`[workspace.lints]`), plus `#![forbid(unsafe_code)]` on each crate root.

Rust **1.90.x** is pinned in **`rust-toolchain.toml`** (required for **Pelorus Inspector** / Tauri transitive crates; the in-tree **`mdf4-rs`** policy remains edition **2024** with MSRV documented in that crate).

### Supporting libraries (`dbc-rs`, `mdf4-rs`)

These directories are **squashed subtree** snapshots for Pelorus (**`pelorus-core`** uses **`path`** deps). **`main` development happens only in this repository.**

Optional standalone GitHub org repos (**`pelorus-marine/dbc-rs`**, **`pelorus-marine/mdf4-rs`**) remain **deferred** unless crates.io or branding policy requires them — subtrees in **this** workspace stay authoritative (see **`PELORUS_IMPLEMENTATION_PLAN.md`** Phase 0.1–0.2 where that file is available in your checkout).

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
| **`pelorus-core/`** | **Package `pelorus-core`** — Core building blocks (wire, `CanFdBus`, addressing, power, transport); **0.1.0** pre-MVP |
| **`pelorus-core-sim/`** | **Package `pelorus-core-sim`** — in-memory bus simulations for development (`cargo run -p pelorus-core-sim`) |
| **`pelorus-stream/`** | Stream telemetry envelope + future wire decoders |
| **`pelorus-state/`** | State / fusion hooks over Core correlation (+ optional `stream`) |
| **`pelorus-inspector/`** | **Pelorus Inspector** — Tauri desktop MDF4 / DBC / SocketCAN tool (TypeScript + Rust); successor to archived [`reneherrero/can-viewer`](https://github.com/reneherrero/can-viewer) |
| **`pelorus-bounded/`** | Bounded **`Vec` / `String` / `BTreeMap`** (`alloc` vs **`heapless`**) — shared with **`dbc-rs`** |
| **`dbc-rs/`** | DBC/CAN substrate (was subtree from archived [`reneherrero/dbc-rs`](https://github.com/reneherrero/dbc-rs)) |
| **`mdf4-rs/`** | MDF4 substrate (was subtree from archived [`reneherrero/mdf4-rs`](https://github.com/reneherrero/mdf4-rs)) |

```bash
cd platform
cargo build --workspace
cargo test --workspace --all-features
cargo check -p pelorus-core --no-default-features --features heapless
cargo test -p pelorus-core --features sim
# Reference validation (sibling repo):
cargo run -p pelorus-core-sim
```

Licensed **MIT OR Apache-2.0** (see `LICENSE-*` in this directory).
