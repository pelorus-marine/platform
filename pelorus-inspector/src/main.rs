//! Pelorus Inspector — CLI entry (scaffold). UI and recording paths will evolve here.

#![forbid(unsafe_code)]

fn main() {
    print_banner();
    let args = std::env::args_os().skip(1).collect::<Vec<_>>();
    if args.iter().any(|a| a == "--help" || a == "-h") {
        print_usage();
        return;
    }
    if !args.is_empty() {
        eprintln!("pelorus-inspector: unknown arguments (scaffold accepts only --help)");
        std::process::exit(2);
    }
    println!(
        "\n(No bus or files yet — integrate MDF4 / CAN / Pelorus Core next.)\n\
         See README.md in this directory.\n"
    );
}

fn print_banner() {
    println!(
        "pelorus-inspector {} — Pelorus Inspector (scaffold)",
        env!("CARGO_PKG_VERSION")
    );
}

fn print_usage() {
    println!(
        "\
USAGE:
    pelorus-inspector [OPTIONS]

OPTIONS:
    -h, --help    Print this message

Pelorus maritime signal & wire inspection — scaffold build.
"
    );
}
