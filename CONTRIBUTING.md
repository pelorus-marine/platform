# Contributing — `platform` workspace

- **Pelorus first** — The **Pelorus** architecture, specs in `specifications/`, and the **`pelorus-core`** crate drive changes. Supporting subtrees (**`dbc-rs`**, **`mdf4-rs`**) follow **Pelorus** integration needs (path deps, subtree pulls), not the reverse.
- **Root** — `./platform` is only the workspace virtual manifest; Rust packages live in **named subdirectories** next to `Cargo.toml` (e.g. `pelorus-core/`, `pelorus-stream/`). Do not add a root-level `src/` or `tests/`—those belong inside a member crate.
- **Safe Rust** — Do not use `unsafe`; it is forbidden by workspace lints and crate attributes.

From **`platform/`** (workspace root):

```bash
cargo fmt --all
cargo clippy --workspace --all-features
cargo test --workspace --all-features
```

- **Stream** and **State** logic belong in **`pelorus-stream/`** / **`pelorus-state/`**, not in the **`pelorus-core/`** crate.
- PRs that widen public **DCID** / enum surfaces are **spec-affecting** — cross-link `specifications/` changes.

Per-crate notes for the Core integration library: **`pelorus-core/CONTRIBUTING.md`**.
