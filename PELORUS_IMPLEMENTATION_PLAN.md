# Pelorus Core — Implementation Plan

> **Mission**: Open-source, safety-first ECDIS/chart plotter powered by Rust, IHO S-100,
> and the Pelorus architecture — running on NXP i.MX 95 (Cortex-A55 + M7 + M33).

## Principles

- **By sailors, for sailors** — Requirements and UX trace to crew and shipboard reality, not generic demos.
- **Pelorus first** — **`specifications/`** and the Pelorus product own scope; **`platform`** (especially **`pelorus-core`**) integrates stack pieces around that mission.
- **Embedded first** — Constrained targets, **`no_std`** where it matters, and explicit trust boundaries inform design, features, and verification (including cross-target CI where appropriate).

---

## Repository Topology

**Pelorus-first:** Canonical Rust integration work happens in **`pelorus-marine/platform`**
(remote <https://github.com/pelorus-marine/platform> — clone that repo to get the Cargo
workspace). In-tree **`dbc-rs`** and **`mdf4-rs`** serve **`pelorus-core`**; standalone
Pelorus-org library repos remain **optional ecosystem** detail (§0.1–0.2), not prerequisites
for `pelorus-core`.

When this repo is checked out alongside other Pelorus assets (mega-repo):

```
pelorus-marine/
  ecdis/                 ← EXISTS — S-100/S-101 workspace, Slint UI, Yocto BSP
  specifications/        ← EXISTS — architecture records
  platform/              ← EXISTS — Cargo workspace (mirrors github.com/pelorus-marine/platform):
    Cargo.toml           # virtual `[workspace]` root
    pelorus-bounded/     ← EXISTS — bounded collections / compat with dbc-rs
    dbc-rs/              ← EXISTS — in-tree subtree; Pelorus-curated
    mdf4-rs/             ← EXISTS — in-tree subtree; Pelorus-curated
    pelorus-inspector/   ← EXISTS — desktop tooling (Tauri)
    pelorus-stream/
    pelorus-state/
    pelorus-core/
    pelorus-vdr/         ← EXISTS — Phase 3 VDR binary scaffold (A55 / MDF4)
    pelorus-m7/          ← EXISTS — Phase 2 M7 `no_std` library scaffold (no `vdr` feature)
```

---

## Phase 0 — Libraries and optional ecosystem migrations

### 0.0 — Baseline (done): `platform` in-tree workspace

This is the integration state **`pelorus-core`** already relies on (**`path`** dependencies on sibling workspace crates).

**Goal:** Acknowledge shipped layout — no separate mega-repo **`dbc-rs/`** sibling required.

The following are **baseline** requirements (implemented in **`platform/`**):

- Virtual **`[workspace]`** at **`platform/Cargo.toml`** with members **`pelorus-bounded`**, **`dbc-rs`**, **`mdf4-rs`**, **`pelorus-inspector`**, **`pelorus-stream`**, **`pelorus-state`**, **`pelorus-core`**, **`pelorus-vdr`**, **`pelorus-m7`** (see **`§1.1`** snippet — authoritative list lives in-repo)
- **`default-members = ["pelorus-core"]`**; **`[workspace.lints]`** **`unsafe_code = "forbid"`** on cooperating members
- **`pelorus-core`** depends on **`dbc-rs`** / **`mdf4-rs`** via **`path = "../dbc-rs"`** and **`path = "../mdf4-rs"`** (optional features per **`pelorus-core/Cargo.toml`**)
- Subtree **`git subtree pull`** workflow from upstream when Pelorus needs changes — see **`platform/README.md`**

### 0.1 — Optional: standalone **`pelorus-marine/dbc-rs`** (ecosystem / branding)

Non-blocking Pelorus roadmap; only pursue if crates.io/org clarity needs a dedicated repo.

**Status (deferred):** Standalone org repos are **not** created — **`platform`** subtrees remain authoritative until publishing policy requires otherwise.

**Goal:** Dedicated org repo plus crates ownership, without changing **`pelorus-core`** path-deps story.

- [ ] Create **`pelorus-marine/dbc-rs`** repo if desired (or keep **`platform`** subtree as sole home)
- [ ] Merge history: **`git merge --allow-unrelated-histories`** from **`reneherrero/dbc-rs`** where applicable
- [ ] Transfer **crates.io** ownership if org publisher should own **`dbc-rs`**
- [ ] **`README`** line: *"Part of the [Pelorus](https://github.com/pelorus-marine) ecosystem"* (and redirect from **`reneherrero/dbc-rs`** if deprecating upstream)
- [ ] Verify CI (GitHub Actions) on whichever remote is authoritative for standalone clone

### 0.2 — Optional: standalone **`pelorus-marine/mdf4-rs`** (ecosystem / branding)

Same as §0.1 — downstream of **`platform`** Pelorus-first integration.

**Status (deferred):** Same as §0.1 — in-tree **`mdf4-rs`** remains the integration substrate.

**Goal:** Dedicated org repo optional; crates.io semver preserved if publishing from org.

- [ ] Create **`pelorus-marine/mdf4-rs`** if desired (otherwise **`platform/mdf4-rs`** remains in-tree substrate)
- [ ] Merge history from **`reneherrero/mdf4-rs`** if spinning a standalone repo
- [ ] Transfer **crates.io** ownership where needed
- [ ] **`mdf4-rs`** dependency **`dbc-rs`**: crates.io semver or **`path`** in standalone tree aligned with subtree policy in **`platform`**
- [ ] **`README`** ecosystem line + optional deprecation on **`reneherrero/mdf4-rs`**
- [ ] Verify CI on authoritative remote

### 0.3 — Invariants (baseline + optional publishes)

Apply to in-tree crates and any standalone **`pelorus-marine/*`** library repos:

- Both crates retain **`#![forbid(unsafe_code)]`**
- Both crates retain **`MIT OR Apache-2.0`** dual license
- **`dbc-rs`** stays **`no_std`** + **`heapless`**-capable (M7 deployment target)
- **`mdf4-rs`** retains **`no_std`** + **`alloc`** feature gate
- **crates.io** semver is not broken on publish — patch forward from authoritative tree

---

## Phase 1 — `platform` workspace (package `pelorus-core`)

**Goal**: Integration crate that owns Pelorus-specific glue between `dbc-rs`, `mdf4-rs`,
and the ECDIS stack. Enforces the M7 / A55 trust boundary in the dependency graph.

### 1.1 — Workspace setup

As implemented today, **`platform/Cargo.toml`** defines the workspace below; **`§1.1`** is
normative reference for contributors (**no extra scaffold required**).

The repo uses a **virtual workspace** at `platform/Cargo.toml` with member directories **next to** that manifest (no `crates/` folder). **`dbc-rs`** and **`mdf4-rs`** live in-tree as subtrees; the Core integration crate is **`pelorus-core`**.

- `pelorus-bounded/` — Bounded strings/collections; **`dbc-rs`** compat surface
- `dbc-rs/` — DBC parser (subtree)
- `mdf4-rs/` — MDF4 library (subtree)
- `pelorus-inspector/` — Desktop inspector (Tauri; Linux CI builds `dist/`)
- `pelorus-core/` — Cargo package **`pelorus-core`** (`pelorus_core`) — CAN / DCID / VDR / own-ship; catalog correlation (`SemanticPath`, `CorrelationSlot`)
- `pelorus-stream/` — Stream transport scaffolding
- `pelorus-state/` — State fusion scaffold
- `pelorus-vdr/` — VDR service scaffold (Phase 3; **`vdr`** feature on **`pelorus-core`**)
- `pelorus-m7/` — M7 firmware library scaffold (Phase 2; **`canbus_heapless`** only — **no `vdr`**)

```toml
# platform/Cargo.toml (workspace root) — abbreviated; verify in-repo for exact order
[workspace]
resolver = "2"
members = [
  "pelorus-bounded",
  "dbc-rs",
  "mdf4-rs",
  "pelorus-inspector",
  "pelorus-stream",
  "pelorus-state",
  "pelorus-core",
  "pelorus-vdr",
  "pelorus-m7",
]
default-members = ["pelorus-core"]
```

Per-crate manifests and features live in each member’s `Cargo.toml`.

### 1.2 — Crate structure

Integration sources live under **`platform/pelorus-core/`** (package **`pelorus-core`**, Rust **`pelorus_core`**).
The tree below reflects the **`dcid`** module layout (**`registry.rs`**, **`mapping.rs`**) on disk:

```
platform/
  dbc-rs/
  mdf4-rs/
  pelorus-stream/
  pelorus-state/
  pelorus-core/
    src/
      lib.rs
      correlation.rs
      semantics.rs
      dcid/
        mod.rs
        registry.rs
        mapping.rs
      canbus/
      vdr/
      ownship/
    tests/
  Cargo.toml           # workspace root (virtual manifest)
  README.md
  ARCHITECTURE.md
  CONTRIBUTING.md
```

### 1.3 — DCID Schema (Core Design Decision)

Define the Pelorus Data Channel ID registry as a Rust `enum` — not strings,
not raw CAN IDs. This makes the schema compiler-enforced and audit-friendly.

```rust
/// Pelorus Data Channel Identifiers.
/// Each variant maps to a canonical signal with defined unit and scaling.
/// `#[non_exhaustive]` forces match arms on all consumers — intentional.
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Dcid {
    // Navigation
    GnssLatitude,       // degrees WGS-84
    GnssLongitude,      // degrees WGS-84
    GnssSpeedOverGround,// knots
    GnssCourseOverGround,// degrees true
    HeadingTrue,        // degrees
    HeadingMagnetic,    // degrees
    RateOfTurn,         // deg/min

    // Motion
    Heel,               // degrees (port negative)
    Trim,               // degrees (bow-down negative)
    Pitch,              // degrees
    Roll,               // degrees

    // Propulsion
    EngineRpm(u8),      // engine index 0..n
    FuelFlowRate(u8),   // L/h, engine index
    EngineCoolantTemp(u8),

    // Safety
    DepthBelowKeel,     // metres
    WindSpeedApparent,  // knots
    WindAngleApparent,  // degrees
}
```

---

## Phase 2 — M7 Firmware Crate (`pelorus-m7`)

**Goal**: Embassy-rs bare-metal firmware for the Cortex-M7 that owns the CAN FD bus,
decodes frames via `dbc-rs`, and exposes a safe IPC channel to the A55 Linux side.

### 2.1 — Crate Setup

```
pelorus-m7/            # separate repo or workspace member of platform
  src/
    main.rs            # Embassy executor, task definitions
    can/
      driver.rs        # i.MX 95 FlexCAN FD HAL binding
      bus.rs           # multi-instance CAN FD bus manager (up to 5 controllers)
      filter.rs        # hardware acceptance filter configuration
    decode/
      mod.rs
      dbc_bridge.rs    # dbc-rs Dbc::decode() → Dcid signals
    ipc/
      mod.rs
      shared_mem.rs    # virtio or shared DDR ring buffer → A55
    safety/
      watchdog.rs      # feeds M33 Safety Manager heartbeat
      safe_state.rs    # CAN bus silent mode on fault
```

### 2.2 — Feature Gate Discipline

```toml
[dependencies]
pelorus-core = { version = "0.1", default-features = false, features = ["canbus"] }
# note: "vdr" feature MUST NOT appear here — that is A55 territory
```

This constraint is enforced by the dependency graph. Any PR that adds `"vdr"`
to the M7 firmware `Cargo.toml` is immediately visible and reviewable.

### 2.3 — CAN FD Bus Allocation (i.MX 95 — 5 controllers)

| Controller | Assignment | Notes |
|---|---|---|
| FLEXCAN1 | Pelorus Core primary bus | Safety-critical, M7 owned |
| FLEXCAN2 | Pelorus Core monitor/tap | Passive listener, diagnostics |
| FLEXCAN3 | Engine gateway | NMEA 2000 bridge |
| FLEXCAN4 | Autopilot / steering | Isolated segment |
| FLEXCAN5 | Reserved / future | Spare for expansion |

---

## Phase 3 — VDR Integration (A55 / Linux)

**Goal**: Voyage Data Recorder pipeline on the A55 Linux side, recording all
Pelorus Core signals as ASAM MDF4 for regulatory compliance and post-voyage analysis.

### 3.1 — `pelorus-vdr` Binary (inside `ecdis` workspace or `platform`)

```
pelorus-vdr/
  src/
    main.rs         # tokio service, reads IPC from M7 shared memory
    pipeline.rs     # IPC frames → dbc-rs decode → mdf4-rs CanDbcLogger
    rotation.rs     # hourly/daily .mf4 file rotation
    retention.rs    # storage quota management (NVMe)
    api.rs          # local Unix socket for ECDIS to query recent data
```

### 3.2 — MDF4 Channel Naming Convention

```
pelorus/<dcid_name>   e.g.  pelorus/GnssLatitude
                             pelorus/EngineRpm_0
                             pelorus/DepthBelowKeel
```

Consistent naming means `.mf4` voyage logs are self-describing and importable
into any ASAM-compliant analysis tool (CANalyzer, Python `asammdf`, etc.).

### 3.3 — Retention Policy

| Storage tier | Retention | Format |
|---|---|---|
| Hot (RAM ring buffer) | Last 5 min | In-memory |
| Warm (NVMe SSD) | Last 30 days | `.mf4` per hour |
| Cold (removable media) | Voyage archive | `.mf4` merged per voyage |

---

## Phase 4 — `ecdis` Integration

**Goal**: Wire `pelorus-core` own-ship state into the existing `pelorus-ecdis` crate
and surface it in `ecdis-ui` (Slint).

### 4.1 — Own-Ship State Bridge

```rust
// pelorus-ecdis/src/lib.rs — existing type, extend it
use pelorus_core::OwnShipSnapshot;

pub struct S101Dataset {
    pub enc: ...,
    pub own_ship: OwnShipSnapshot,  // ← ADD
    pub ais_targets: Vec<AisTarget>,
}
```

### 4.2 — Slint UI Updates

- [ ] Own-ship symbol moves with live `GnssLatitude` / `GnssLongitude`
- [ ] Heading line driven by `HeadingTrue`
- [ ] Depth overlay from `DepthBelowKeel`
- [ ] Engine/propulsion panel (optional overlay) from `EngineRpm`, `FuelFlowRate`
- [ ] VDR status indicator (recording / fault)

---

## Phase 5 — Hardware Bring-Up (IMX95LPD5EVK-19)

**Goal**: Validate the full software stack on physical i.MX 95 silicon.

### 5.1 — Milestones

- [ ] Yocto `meta-pelorus-ecdis` builds and boots on EVK A55
- [ ] `ecdis-ui` Slint HUD renders S-101 ENC on LVDS output
- [ ] Embassy-rs `pelorus-m7` firmware loads and runs on M7 core (JTAG)
- [ ] CAN FD loopback test: M7 → TJA1463 transceiver breakout → M7
- [ ] `dbc-rs` decodes a real frame on M7
- [ ] IPC ring buffer: M7 signal values appear in A55 Linux process
- [ ] `pelorus-vdr` writes first `.mf4` voyage log to NVMe
- [ ] Own-ship position moves on chart from live GNSS (u-blox ZED-F9P via UART)

### 5.2 — Test Infrastructure

```
platform/
  pelorus-core/
    tests/
      dcid_mapping.rs
      vdr_channel_naming.rs
    # future optional:
    #   can_loopback.rs   # gated with #[cfg(feature = "hw_test")]
    #   vdr_roundtrip.rs
```

---

## Invariants (Non-Negotiable Across All Phases)

| Invariant | Enforcement |
|---|---|
| No `unsafe` code in any pelorus-marine crate | `#![forbid(unsafe_code)]` in each `lib.rs` |
| M7 firmware never depends on `vdr` feature | CI `cargo check` with explicit feature set |
| All public APIs documented | `#![deny(missing_docs)]` + `RUSTDOCFLAGS='-D warnings'` in CI |
| No panics in no_std paths | `#![no_std]` + `panic = "abort"` in M7 firmware profile |
| Dual MIT/Apache-2.0 license on all crates | `cargo deny` license check in CI |
| MSRV pinned | `rust-toolchain.toml` in each repo |

---

## Immediate Next Actions

1. Evolve **`Dcid`** and channel mapping under **`platform/pelorus-core/src/dcid/`** (**`registry.rs`**, **`mapping.rs`**) toward §1.3 and production coverage (compiler-enforced channel IDs stay non-negotiable).
2. Phase 4: advance **`ecdis`** own-ship bridge and **`ecdis-ui`** items in §4.2 (**`pelorus-ecdis`** already carries a **`pelorus-core`** path dependency — extend snapshots and portrayal as specs land).
3. Phase 2 / 3 priorities: scaffold **`pelorus-m7`** (§2) or **`pelorus-vdr`** (§3), matching hardware availability and compliance milestones.
4. When upstream DBC/VDR fixes are needed for Pelorus, run **`git subtree pull`** documented in **`platform/README.md`** and re-run **`cargo test --workspace --all-features`** before merge.
5. Optional §0.1–§0.2: standalone **`pelorus-marine/dbc-rs`** / **`mdf4-rs`** repos and crates.io handoff — only if ecosystem or publishing policy requires (**non-blocking** for **`pelorus-core`**).
6. If Phase 5 is on the critical path: order **`IMX95LPD5EVK-19`** hardware and unblock Yocto + board bring-up in parallel.

---

*Document version: 2026-05-04 | License: MIT OR Apache-2.0*
