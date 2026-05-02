//! CAN FD frame handling: DBC-backed decode and lightweight capture for VDR / IPC handoff.

/// `Dbc` + [`embedded_can::Frame`] decoding handle.
pub mod decoder;
#[cfg(all(feature = "std", feature = "canbus"))]
/// std-only ring-buffer capture of recent raw frames.
pub mod frame_log;
