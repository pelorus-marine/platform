//! Device power states (`04-power.md` §5).

/// Local MCU / transceiver power state (application view).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum PowerState {
    /// Full operation (`04` §5).
    #[default]
    Active,
    /// Low-power running, bus monitored (`04` §5).
    Standby,
    /// Selective wake mode (`04` §5).
    Sleep,
    /// No bus wake (`04` §5).
    DeepSleep,
}
