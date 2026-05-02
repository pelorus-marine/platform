# Contributing — `platform` workspace

- **Credits and mission** — **[`CONTRIBUTORS.md`](CONTRIBUTORS.md)** describes community attribution, **non-commercial** intent, **Rust-first** stack policy, and subtree (**`dbc-rs`** / **`mdf4-rs`**) curation. **`git`** history remains authoritative for per-commit credit.

- **Pelorus first** — The **Pelorus** architecture, specs in `specifications/`, and the **`pelorus-core`** crate drive changes. Supporting subtrees (**`dbc-rs`**, **`mdf4-rs`**) follow **Pelorus** integration needs (path deps, subtree pulls), not the reverse.
- **Root** — `./platform` is only the workspace virtual manifest; Rust packages live in **named subdirectories** next to `Cargo.toml` (e.g. `pelorus-core/`, `pelorus-stream/`). Do not add a root-level `src/` or `tests/`—those belong inside a member crate.
- **Safe Rust** — Do not use `unsafe`; it is forbidden by workspace lints and crate attributes.

From **`platform/`** (workspace root):

```bash
cargo fmt --all
cargo clippy --workspace --all-features
cargo test --workspace --all-features
```

## Continuous integration (GitHub Actions)

Canonical Rust workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

- **Pinned toolchain** — **Rust 1.88.0** from [`rust-toolchain.toml`](rust-toolchain.toml). Pelorus Inspector / Tauri and shared workspace crates need one reproducible toolchain (see [`README.md`](README.md)).
- **Workspace scope** — `cargo test`, `cargo clippy`, and **`cargo doc`** use **`--workspace --all-features`** with warnings denied (**`clippy`** `-D warnings`, **`RUSTDOCFLAGS="-D warnings"`** for docs).
- **Embedded-shaped checks** — extra jobs **`cargo check`** limited feature graphs (`pelorus-core` **`canbus`** / **`canbus_heapless`** without defaults; **`pelorus-bounded`** + **`dbc-rs`** **`heapless`**) mirror on-device-ish builds.
- **Inspector frontend** — ESLint, Vitest, **`tsc`**, production build using **Node.js 22**, matching **`website`** TypeScript CI (see `.github/workflows/ci.yml`).
- **`dbc-rs` / `mdf4-rs` workflows** — nested Actions under **[`dbc-rs/.github/workflows/`](dbc-rs/.github/workflows/)** and **[`mdf4-rs/.github/workflows/`](mdf4-rs/.github/workflows/)** deliberately overlap workspace CI (**MSRV**, benches, crates.io hygiene). Fixing a failure may require touching both surfaces when you change those crates.

- **Stream** and **State** logic belong in **`pelorus-stream/`** / **`pelorus-state/`**, not in the **`pelorus-core/`** crate.
- PRs that widen public **DCID** / enum surfaces are **spec-affecting** — cross-link `specifications/` changes.

Per-crate notes for the Core integration library: **`pelorus-core/CONTRIBUTING.md`**.
