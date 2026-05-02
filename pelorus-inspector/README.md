# pelorus-inspector

**Pelorus Inspector** — desktop tooling for sailors and integrators to **inspect** and **record**
bus traffic (CAN / MDF4 / DBC) in line with **Pelorus** architecture.

This crate is the **named successor** to the archived **`can-viewer`** project
(https://github.com/reneherrero/can-viewer). New development happens **here** under
[`pelorus-marine/platform`](https://github.com/pelorus-marine/platform) —
`pelorus-inspector/` in this repository.

Today the package ships a **CLI scaffold**. A **Tauri** UI and live SocketCAN workflows
ported from **`can-viewer`** will land in-tree as the implementation matures.

## Principles

Aligned with **`platform`** workspace: **by sailors, for sailors**; **Pelorus first**;
**embedded-aware** stacks where it matters — without blocking a capable desktop toolchain.

## Build

```bash
cd platform
cargo build -p pelorus-inspector
cargo run -p pelorus-inspector -- --help
```

## License

MIT OR Apache-2.0, same as the rest of the `platform` workspace (see workspace `LICENSE-*`).
