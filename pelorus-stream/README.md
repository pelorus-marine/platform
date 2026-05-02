# pelorus-stream

**Pelorus Stream** plane: Ethernet, non–safety-critical bandwidth (media + auxiliary telemetry). This crate holds **transport and framing** evolution; normative prose lives under **`specifications/stream/`**.

- Depends on **`pelorus-semantics`** for optional correlation metadata (`CorrelationSlot`) shared with Core-facing code.
- **Does not** implement **Pelorus State** or CAN decode — see sibling **`pelorus-state/`** and **`pelorus-platform/`** (Core integration package).

Workspace root: `../README.md`.
