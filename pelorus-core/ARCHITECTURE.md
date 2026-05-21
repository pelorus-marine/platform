# pelorus-core — architecture

**Pelorus Core building blocks** — embedded-first Rust primitives. Normative prose: `specifications/core/`. **Development validation:** [`../pelorus-core-sim/`](../pelorus-core-sim/) (in-memory bus, same workspace).

## Layout rule

**One Rust type per file** (struct, enum, or type alias). `mod.rs` files only declare modules and re-export public types.

```
src/
  wire/           # 03 §2 identifiers
  bus/            # CanFdFrame + CanFdBus (+ sim/)
  addressing/     # 05 address claiming
  power/          # 04 WUF + NM
  transport/      # 03 §4 multi-frame
```

## Building blocks

| Block | Spec | Key types (files) |
|-------|------|-------------------|
| Wire | 03 §2 | `Identifier`, `DcId`, `pack_identifier` |
| Bus | 03 §1 | `CanFdFrame`, `CanFdBus`, `SimulatedBus` (`sim`) |
| Addressing | 05 | `Name`, `AddressClaimEngine`, `ClaimState`, … |
| Power | 04 | `WakeUpFrame`, `NetworkManagementFrame`, `NetworkManagementEngine`, `ClusterNmState`, … |
| Transport | 03 §4 | `MultiframeControl`, `MultiframeData`, `IngressBroadcastSession`, … |

## Embedded-first

- Mandatory **`pelorus-bounded`** via `alloc` or `heapless`.
- Default feature: **`alloc`** only (no `sim`).
- Firmware: `default-features = false`, `features = ["heapless"]`.
- **`sim`:** reference-implementations / CI only.

## Dependency direction

```
specifications → pelorus-core → pelorus-core-sim (dev only)
                    ↑
              pelorus-bounded
```

Product scaffolds (gateway, VDR, …) remain in `reference-implementations/`.

See [`README.md`](README.md) and workspace [`README.md` § Embedded-first](../README.md#embedded-first).
