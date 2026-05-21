# Contributing — pelorus-core

Building blocks for Pelorus Core. **Validate behavior** in [`reference-implementations`](../../reference-implementations/) when adding protocol surfaces — not only unit tests in this crate.

From the workspace root:

```bash
cargo fmt --all
cargo clippy -p pelorus-core --all-features -- -D warnings
cargo test -p pelorus-core --all-features
cargo run -p pelorus-core-sim
```

- **Safe Rust only** — `#![forbid(unsafe_code)]`
- Use **`pelorus-bounded`** collections — do not add direct `alloc::vec` in library code
- **Embedded-first defaults:** `default = ["alloc"]` only; gate host-only code behind `sim`
- Wire / DC_ID changes need matching `specifications/` updates
- Stream/State logic stays in sibling crates
