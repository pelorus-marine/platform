# pelorus-core

**Pelorus Core building blocks** — one type per source file for navigation. Spec: [`specifications/core/`](../../specifications/core/).

| Module | Spec | Status |
|--------|------|--------|
| [`wire/`](src/wire/) | 03 §2 | Identifiers |
| [`bus/`](src/bus/) | 03 §1 | `CanFdBus` |
| [`addressing/`](src/addressing/) | 05 | Address claiming |
| [`power/`](src/power/) | 04 | Wake-up + network management |
| [`transport/`](src/transport/) | 03 §4 | Multi-frame transport |

## Dependencies

```toml
pelorus-core = { path = "../pelorus-core", default-features = false, features = ["heapless"] }
```

Host / dev validation uses sibling [`pelorus-core-sim`](../pelorus-core-sim/) (`alloc` + `sim` on `pelorus-core` only there).

## Tests

```bash
cargo test -p pelorus-core --features sim,alloc
```

Development simulations (no hardware): [`../pelorus-core-sim/`](../pelorus-core-sim/) — `cargo run -p pelorus-core-sim`.

**Version:** `0.1.0` (pre-MVP).
