# Pelorus Inspector

Desktop tooling for sailors and integrators **by sailors, for sailors**: inspect CAN traffic from **MDF4**, decode with **DBC**, and capture live **SocketCAN** (Linux) — built with **Tauri 2**.

This package is the **successor** to the archived [`reneherrero/can-viewer`](https://github.com/reneherrero/can-viewer). Source of truth lives in **`pelorus-marine/platform`** ([`pelorus-inspector/` tree](https://github.com/pelorus-marine/platform/tree/main/pelorus-inspector)). In-tree **`dbc-rs`** / **`mdf4-rs`** satisfy `path` deps for the Pelorus stack.

**Embedded-first:** host tooling visualizes and edits what vessel-side stacks produce; policy lives in **[Embedded-first](../README.md#embedded-first)**.

[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-informational)](LICENSING.md)

## Features

- **MDF4** — Load and analyse ASAM MDF4 CAN bus-logging channels  
- **DBC** — Parse and decode with **FastDbc** acceleration  
- **Live capture** — SocketCAN interfaces (Linux)  
- **Export** — Capture to MDF4  
- **Desktop UI** — Web Components frontend + Rust commands over Tauri IPC  

Crates.io **cargo install** is not wired for this relocated package yet (Tauri bundles are built from source here).

## From this workspace (`platform`)

```bash
git clone git@github.com:pelorus-marine/platform.git
cd platform/pelorus-inspector

npm install
npm run build          # frontend → ../dist relative to vite config (writes ./dist/)

# Dev (vite + Rust; devtools feature)
cargo tauri dev --features devtools

# Production binary bundle
cargo tauri build
```

Or from `platform/`:

```bash
cd platform/pelorus-inspector && npm ci && npm run build
cd ..
cargo build -p pelorus-inspector
```

## Command-line (binary)

```
pelorus-inspector [OPTIONS]

Options:
    -d, --dbc <PATH>    DBC file to load on startup
    -m, --mdf4 <PATH>   MDF4 file to load on startup
    -h, --help          Print help
```

## Build requirements

### All targets

- **Node.js 20+** (frontend toolchain)  
- **Rust** matching `../rust-toolchain.toml` (currently **1.90.x** for Tauri / dependency resolution)  

### Linux (Debian-style)

Tauri build deps (names may vary slightly by distro):

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libxdo-dev

# Optional: SocketCAN tools for live capture
sudo apt install -y can-utils
```

### macOS / Windows

See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). SocketCAN capture remains **Linux-only**; MDF4 + DBC work cross-platform.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md).

## License

**MIT OR Apache-2.0**, with optional commercial terms — see [LICENSING.md](LICENSING.md).
