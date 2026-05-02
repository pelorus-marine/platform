# Contributing — `platform` workspace

- **Root** — `./platform` is only the workspace virtual manifest; Rust packages live in **named subdirectories** next to `Cargo.toml` (e.g. `pelorus-platform/`, `pelorus-semantics/`). Do not add a root-level `src/` or `tests/`—those belong inside a member crate.
- **Safe Rust** — Do not use `unsafe`; it is forbidden by workspace lints and crate attributes.

From **`platform/`** (workspace root):

```bash
cargo fmt --all
cargo clippy --workspace --all-features
cargo test --workspace --all-features
```

- **Stream** and **State** logic belong in **`pelorus-stream/`** / **`pelorus-state/`**, not in the **`pelorus-platform/`** crate.
- PRs that widen public **DCID** / enum surfaces are **spec-affecting** — cross-link `specifications/` changes.

Per-crate notes for the Core integration library: **`pelorus-platform/CONTRIBUTING.md`**.
