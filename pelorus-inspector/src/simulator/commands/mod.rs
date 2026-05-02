//! Simulator Tauri commands — Linux uses SocketCAN; other targets return clear errors for bus I/O.

#[cfg(target_os = "linux")]
include!("commands_linux.inc.rs");
#[cfg(not(target_os = "linux"))]
include!("commands_stub.inc.rs");
