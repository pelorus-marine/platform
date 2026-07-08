# Contributors and credits

Pelorus Marine is a **complete, transparent, community-driven** maritime software stack. **Credits belong to everyone who lands code, docs, tests, and reviews** — not to a single vendor narrative.

## Mission (non-commercial, Rust, safety)

- **Non-commercial** — This initiative does **not** aim to ship a commercial product or proprietary offering. The stack is **open source** first: inspectable, forkable, and meant for public collaboration. **It is not on a path to commercialization** under the Pelorus Marine open-source umbrella.
- **Rust** — The **supported implementation language** for Pelorus runtime crates and integration tooling is **Rust**. Prefer **`#![forbid(unsafe_code)]`** where workspace policy applies; justify any deviation in review.
- **Safety** — **Maximum practical safety** is a design requirement: memory safety by default, explicit bounds, deterministic failure modes on constrained targets, and CI that exercises minimal feature sets — see the workspace **`README.md`** and **`CONTRIBUTING.md`**.

Individual attribution lives primarily in **Git history**. For release archaeology or credits lines in manifests, see **`authors`** in each crate’s **`Cargo.toml`** (Pelorus Marine contributors).

## External libraries (`dbc-rs`, `mdf4-rs`)

Crates **`dbc-rs`** and **`mdf4-rs`** keep their **published names on crates.io** for continuity. They are maintained by **Sigma Tactical Group** at **[`sigmatactical-org/dbc-rs`](https://github.com/sigmatactical-org/dbc-rs)** and **[`sigmatactical-org/mdf4-rs`](https://github.com/sigmatactical-org/mdf4-rs)**. This workspace consumes them via crates.io; prior Pelorus in-tree copies and upstream lineage are acknowledged with gratitude.

## Thank you

If you contributed a merge commit, doc fix, test, or review: **thank you**. To be listed by name in this file, open a PR adding yourself under the section below (optional — **git history remains authoritative**).

### Maintainers and named contributors

_Add names here via PR as desired; otherwise rely on `git shortlog -sn`._
