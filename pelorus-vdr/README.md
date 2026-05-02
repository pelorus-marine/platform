# pelorus-vdr

Binary scaffold for **Phase 3** in `PELORUS_IMPLEMENTATION_PLAN.md`: Tokio-side voyage recorder writing ASAM MDF4 with channel names `pelorus/<dcid>` (see `pelorus_core::vdr::channel_map`).

Run after `cargo build -p pelorus-vdr`:

```bash
cargo run -p pelorus-vdr
```

Rotation, IPC from M7, and NVMe policies are intentionally **not** implemented yet.
