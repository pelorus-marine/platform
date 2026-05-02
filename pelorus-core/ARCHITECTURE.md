# `pelorus-core` — architecture (Cargo package)

This is the **`pelorus-core`** Rust library (**`platform/pelorus-core/`** in the repo) — Core CAN/VDR/chart-facing integration. **Stream** and **State** live in **`../pelorus-stream/`** and **`../pelorus-state/`**, not modules here.

The **normative Pelorus Core** architecture lives under **`specifications/`**; this crate implements **Rust integration** aligned with it, not the prose spec itself.

See workspace **`README.md`** at **`../README.md`** (`platform/` root).

## Scope (this crate)

- **`dcid/`** — Core-canonical [`Dcid`](src/dcid/registry.rs); map DBC lanes in `dcid::mapping`.
- **`canbus/`** — `PelorusCanDecoder` + (std-only) frame scratch log; M7 builds drop `vdr`/`std`.
- **`semantics`** (Cargo feature `semantics`) — [`correlation_for_dcid`](src/semantics.rs) → [`CorrelationSlot`](src/correlation.rs).
- **`vdr/`** — MDF4 naming + `CanDbcLogger` glue (Linux / A55).
- **`ownship/`** — `OwnShipSnapshot` for `pelorus-ecdis` via `From`.

## Stream and State (workspace siblings)

| Plane | Crate in this workspace |
|--------|--------------------------|
| **Stream** | **`pelorus-stream`** |
| **State** | **`pelorus-state`** |

**Rule:** do not add Stream codecs or State fusion engines *into this crate*; keep bounded dependencies and M7-safe feature sets.

## Embedded-first (this crate)

**MCU-class builds are a primary audience**, not a fork:

- Start from **`default-features = false`**, then enable **`canbus`**, **`semantics`**, and **`alloc`** only where needed; omit **`vdr`** and **`std`** on bare metal when chart/VDR glue is elsewhere.
- **`vdr`** pulls MDF4-oriented naming and helpers suitable for Linux-grade hosts; **CAN FD decode and DCID semantics do not depend on `vdr`** for existence proofs on an M-class core.
- **`dbc-rs`** enters via **`canbus`** (**`alloc`**) or **`canbus_heapless`** (**`dbc-rs/heapless`**); bounded collections live in **`pelorus-bounded`** (used by **`dbc-rs`**).
- Keep **Stream** and **State** out of this package (workspace siblings); preserves a thin cone for settlers.

Workspace narrative: **[`README.md` § Embedded-first](../README.md#embedded-first)**.

## Dependency direction

```mermaid
flowchart TB
  subgraph mcu[M7]
    PC_min[pelorus_core minimal features]
  end
  subgraph linux[Linux A55]
    PC_full[pelorus_core + vdr etc]
    PS[pelorus-stream]
    PSt[pelorus-state]
    UI[pelorus-ecdis / UI]
  end
  PC_min -->|"IPC / snapshots"| PSt
  PS --> PSt
  PC_full --> PSt
  PSt -->|"fused views e.g. OwnShipSnapshot"| UI
```

See **`../PELORUS_IMPLEMENTATION_PLAN.md`** in the **platform** repository root.
