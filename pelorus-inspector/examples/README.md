# Pelorus Inspector Examples

This directory contains sample files for testing Pelorus Inspector.

## Files

- `sample.mf4` - Sample MDF4 file with CAN frames (Engine RPM, Vehicle Speed, Throttle Position)
- `sample.dbc` - Sample DBC file with message and signal definitions

## Usage

### Load MDF4 file on startup

```bash
pelorus-inspector --mdf4 examples/sample.mf4
```

### Load DBC file on startup

```bash
pelorus-inspector --dbc examples/sample.dbc
```

### Load both files on startup

```bash
pelorus-inspector --dbc examples/sample.dbc --mdf4 examples/sample.mf4
```

### Short options

```bash
pelorus-inspector -d examples/sample.dbc -m examples/sample.mf4
```

## Running from source

From `platform/pelorus-inspector` after `npm run build`:

```bash
cargo run -- --dbc examples/sample.dbc --mdf4 examples/sample.mf4
```

From the **`platform`** workspace root:

```bash
cargo run -p pelorus-inspector -- \
  --dbc pelorus-inspector/examples/sample.dbc \
  --mdf4 pelorus-inspector/examples/sample.mf4
```
