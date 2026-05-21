# pelorus-core-sim

Development simulations for **[`pelorus-core`](../pelorus-core/)** on [`SimulatedBus`](../pelorus-core/src/bus/simulated_bus.rs). Lives in the **platform** workspace — not firmware, not `reference-implementations/`.

## Scenarios

| Module | Spec | What it proves |
|--------|------|----------------|
| `addressing` | 05 | Two nodes claim; lower NAME wins preferred SA |
| `power` | 04 | WUF wake, NM frame codec, repeat → ready-sleep |
| `transport` | 03 §4 | Broadcast multi-frame reassembly + CRC mismatch |

## Run

```bash
# From platform/ workspace root
cargo run -p pelorus-core-sim
cargo run -p pelorus-core-sim -- addressing
cargo run -p pelorus-core-sim -- power
cargo run -p pelorus-core-sim -- transport
```

Library API (`pelorus_core_sim::{addressing, power, transport}::run`) is available for tests or tooling that import this crate.

## Dependencies

- **`pelorus-core`** with `features = ["alloc", "sim"]`
- **`pelorus-bounded`** (`alloc`) for transport payload buffers

Production firmware must **not** depend on this package.
