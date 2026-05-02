# pelorus-platform — architecture (Cargo package)

This is the **`pelorus-platform`** Rust library (**`platform/pelorus-platform/`** in the monorepo) — Core CAN/VDR/chart glue. **Stream** and **State** live in **`../pelorus-stream/`** and **`../pelorus-state/`**, not modules here.

See workspace **`README.md`** at **`../README.md`** (`platform/` root).

## Scope (this crate)

`pelorus-platform` (the package) is **Rust integration** — **not** the normative **Pelorus Core** subsystem from `specifications/`.

- **`dcid/`** — Core-canonical [`Dcid`](src/dcid/registry.rs); map DBC lanes in `dcid::mapping`.
- **`canbus/`** — `PelorusCanDecoder` + (std-only) frame scratch log; M7 builds drop `vdr`/`std`.
- **`semantics`** (Cargo feature `semantics`) — [`correlation_for_dcid`](src/semantics.rs) → [`pelorus_semantics::CorrelationSlot`](../pelorus-semantics/README.md).
- **`vdr/`** — MDF4 naming + `CanDbcLogger` glue (Linux / A55).
- **`ownship/`** — `OwnShipSnapshot` for `pelorus-ecdis` via `From`.

## Stream and State (workspace siblings)

| Plane | Crate in this workspace |
|--------|--------------------------|
| **Stream** | **`pelorus-stream`** |
| **State** | **`pelorus-state`** |

**Rule:** do not add Stream codecs or State fusion engines *into this crate*; keep bounded dependencies and M7-safe feature sets.

## Dependency direction

```mermaid
flowchart TB
  subgraph mcu[M7]
    PC_min[pelorus-platform minimal features]
  end
  subgraph linux[Linux A55]
    PC_full[pelorus-platform vdr etc]
    PS[pelorus-stream]
    PSt[pelorus-state]
    UI[pelorus-ecdis / UI]
  end
  PC_min -->|"IPC / snapshots"| PSt
  PS --> PSt
  PC_full --> PSt
  PSt -->|"fused views e.g. OwnShipSnapshot"| UI
```

See `PELORUS_IMPLEMENTATION_PLAN.md` at the monorepo root.
