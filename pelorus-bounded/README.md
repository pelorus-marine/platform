# pelorus-bounded

Bounded **`Vec`**, **`String`**, and **`BTreeMap`** (`alloc` vs **`heapless`**) shared by **`dbc-rs`** (via **`compat/`** re-exports).

Workspace **[Embedded-first](../README.md#embedded-first)** — enable **`heapless`** when firmware has no global allocator; **`alloc`** otherwise. Usage context: **`dbc-rs`** **[`ARCHITECTURE.md`](../dbc-rs/ARCHITECTURE.md#embedded-first)**.
