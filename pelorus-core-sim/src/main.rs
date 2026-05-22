//! Run Pelorus Core in-memory simulations (`pelorus_core::SimulatedBus`).
//!
//! ```bash
//! cargo run -p pelorus-core-sim              # all scenarios
//! cargo run -p pelorus-core-sim -- addressing
//! cargo run -p pelorus-core-sim -- power
//! cargo run -p pelorus-core-sim -- transport
//! ```

use pelorus_core_sim::{SimError, addressing, power, transport};

fn main() {
    let mode = std::env::args()
        .nth(1)
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_else(|| "all".into());

    if !matches!(mode.as_str(), "all" | "addressing" | "power" | "transport") {
        eprintln!("unknown mode {mode:?}; use: all | addressing | power | transport");
        std::process::exit(2);
    }

    let mut failed = false;

    if run_mode(&mode, "addressing", "05 address claiming", addressing::run) {
        failed = true;
    }
    if run_mode(&mode, "power", "04 wake / network management", power::run) {
        failed = true;
    }
    if run_mode(
        &mode,
        "transport",
        "03 §4 broadcast transport",
        transport::run,
    ) {
        failed = true;
    }

    if failed {
        std::process::exit(1);
    }
    println!("pelorus-core-sim: all requested scenarios OK");
}

fn run_mode(mode: &str, key: &str, title: &str, f: fn() -> Result<(), SimError>) -> bool {
    if mode != "all" && mode != key {
        return false;
    }
    println!("--- {title} ---");
    match f() {
        Ok(()) => {
            println!("OK\n");
            false
        }
        Err(e) => {
            eprintln!("FAIL: {e}\n");
            true
        }
    }
}
