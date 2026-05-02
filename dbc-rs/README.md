# dbc-rs

A lightweight Rust library for seamlessly parsing and editing DBC (CAN Database) files, with robust support for encoding and decoding messages and signals.

Crates.io releases are published from the **[`pelorus-marine/platform`](https://github.com/pelorus-marine/platform)** monorepo (**`dbc-rs/`** subdirectory). Report issues and contribute there for the Pelorus-aligned tree.

[![Crates.io](https://img.shields.io/crates/v/dbc-rs.svg)](https://crates.io/crates/dbc-rs)
[![Documentation](https://docs.rs/dbc-rs/badge.svg)](https://docs.rs/dbc-rs)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue.svg)](#license)
[![MSRV](https://img.shields.io/badge/MSRV-1.85.0-blue.svg)](https://www.rust-lang.org)

## Features

- **Zero dependencies** - Pure Rust, no external runtime dependencies
- **no_std compatible** - Works on embedded targets (Cortex-M, RISC-V)
- **Flexible memory** - Heap (`alloc`) or stack (`heapless`) allocation
- **Memory safe** - `forbid(unsafe_code)` enforced
- **Full read/write** - Parse, modify, and serialize DBC files

## Embedded-first

Workspace policy (normative): **[Embedded-first](../README.md#embedded-first)**.

DBC-facing specifics: **`no_std`** with **`heapless`** or **`alloc`**; compile-time **`MAX_*`** caps (**`build.rs`**); **`pelorus-bounded`** primitives re-exported from **`compat/`**. **`pelorus-core`**: **`canbus`** (**`alloc`**) or **`canbus_heapless`**.

Further detail: [`ARCHITECTURE.md`](ARCHITECTURE.md#embedded-first).

## Quick Start

```toml
[dependencies]
dbc-rs = "0.5"
```

### Decode CAN Frames

```rust
use dbc_rs::Dbc;

// Parse DBC content
let dbc = Dbc::parse(dbc_content)?;

// Decode a CAN frame (ID 0x100, 8 bytes, standard 11-bit ID)
let signals = dbc.decode(0x100, &frame_data, false)?;
for signal in signals {
    println!("{}: {:.2} {}", signal.name, signal.value, signal.unit);
}
```

### Encode Signal Values

```rust
use dbc_rs::Dbc;

let dbc = Dbc::parse(dbc_content)?;

// Encode signal values into a CAN frame payload (standard 11-bit ID)
let payload = dbc.encode(0x100, &[
    ("RPM", 2500.0),
    ("Temperature", 85.0),
], false)?;
```

### Embedded (`no_std`)

```toml
[dependencies]
dbc-rs = { version = "0.5", default-features = false, features = ["heapless"] }
```

See [`examples/`](./examples/) for complete working examples:
- `decode.rs` - Signal decoding basics
- `decode_frame.rs` - Using `embedded-can` Frame trait
- `encode.rs` - Encoding signals to CAN payloads
- `create_dbc.rs` - Building DBC files programmatically
- `parse_std.rs` / `parse_no_std.rs` - Parsing in different environments

## Feature Flags

| Feature | Description | Default |
|---------|-------------|---------|
| `std` | Standard library with builders | Yes |
| `alloc` | Heap allocation | Via `std` |
| `heapless` | Stack-only for `no_std` | No |
| `embedded-can` | `embedded-can` crate integration | No |
| `attributes` | BA_DEF_, BA_DEF_DEF_, BA_ support | Yes |

## Minimum Supported Rust Version (MSRV)

dbc-rs requires **Rust 1.85.0** or later (edition 2024). Bumping the MSRV is
considered a minor breaking change and will be noted in release notes.

## Documentation

- [API Reference](https://docs.rs/dbc-rs)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Internal design (includes [Embedded-first](./ARCHITECTURE.md#embedded-first))
- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - DBC format reference
- [SECURITY.md](./SECURITY.md) - Security audit

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or
  <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT License ([LICENSE-MIT](LICENSE-MIT) or
  <http://opensource.org/licenses/MIT>)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
