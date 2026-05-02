# platform (Rust workspace)

Rust workspace: Pelorus Core integration, semantics, Stream, and State.

## Repository

- **Origin:** `git@github.com:pelorus-marine/platform.git`
- **Clone:** `git clone git@github.com:pelorus-marine/platform.git && cd platform`

## Layout (invariants)

1. **Workspace root** — This directory (`./platform`) is the Cargo workspace root only: a virtual manifest (`Cargo.toml` with `[workspace]`), shared `README` / `LICENSE-*`, and tooling config. There is **no** `[package]` crate at the root path and **no** `src/` or `tests/` here—only workspace members as subdirectories.
2. **Member subfolders only** — Every Rust package lives in its **own subdirectory** alongside this `Cargo.toml` and is listed under `[workspace].members`. The Core integration library (Cargo package **`pelorus-platform`**) lives under **`pelorus-platform/`**.
3. **Safe Rust only** — Workspace-wide `unsafe_code = "forbid"` (`[workspace.lints]`), plus `#![forbid(unsafe_code)]` on each crate root.

Further context: normative specs stay in `specifications/`, the ECDIS app in `ecdis/`.

| Member | Role |
|--------|------|
| `pelorus-platform/` | **Package `pelorus-platform`** — CAN FD / DCID / VDR / own-ship |
| `pelorus-semantics/` | `SemanticPath`, `CorrelationSlot` for Core + Stream |
| `pelorus-stream/` | Telemetry envelope + future wire decoders |
| `pelorus-state/` | Policy / fusion hooks over semantics (+ optional `stream`) |

```bash
cd platform
cargo build --workspace
cargo test --workspace --all-features
cargo check -p pelorus-platform --no-default-features --features canbus,alloc
```

Licensed **MIT OR Apache-2.0** (see `LICENSE-*` in this directory).
