# Contributing — `pelorus-platform` crate

From the **workspace root** (monorepo **`platform/`** directory):

```bash
cargo fmt --all
cargo clippy -p pelorus-platform --all-features
cargo test -p pelorus-platform --all-features
```

- **Safe Rust only** — no `unsafe` (workspace `[lints]` + `#![forbid(unsafe_code)]` on this crate)
- Prefer **feature flags** over target `cfg` leaks: `canbus` vs `vdr` vs `std` vs **`semantics`**
- **Stream**/**State** code belongs in **`../pelorus-stream`** / **`../pelorus-state`**, not here
- Widening public `Dcid` is **spec-affecting** — link `specifications/` PRs
