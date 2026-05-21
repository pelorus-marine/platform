//! Errors from the simulated bus medium.

/// Simulation back-pressure (bounded queue full).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimBusError {
    /// Frame queue capacity reached for this exchange step.
    FrameQueueFull,
}
