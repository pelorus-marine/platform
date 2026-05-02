# pelorus-stream

**Pelorus Stream** plane: Ethernet, non–safety-critical bandwidth (media + auxiliary telemetry). This crate holds **transport and framing** evolution; normative prose lives under **`specifications/stream/`**.

- Depends on **`pelorus-core`** (default features disabled) for `CorrelationSlot` / `SemanticPath`, shared with Core-facing code.
- **Does not** implement **Pelorus State** or CAN decode — see sibling **`pelorus-state/`** and **`pelorus-core/`** (Core integration crate).

Workspace root: `../README.md`.

**Embedded-first:** Stream framing stays **`no_std`**-compatible where specified; **[Embedded-first](../README.md#embedded-first)**.
