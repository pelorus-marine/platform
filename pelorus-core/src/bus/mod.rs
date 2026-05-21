//! CAN FD frame model and bus traits — decouple protocol logic from hardware.

mod can_fd_bus;
mod can_fd_frame;
mod can_fd_max_data;

#[cfg(feature = "sim")]
mod sim_bus_error;
#[cfg(feature = "sim")]
mod sim_port;
#[cfg(feature = "sim")]
mod simulated_bus;

pub use can_fd_bus::CanFdBus;
pub use can_fd_frame::CanFdFrame;
pub use can_fd_max_data::CAN_FD_MAX_DATA;
#[cfg(feature = "sim")]
pub use sim_bus_error::SimBusError;
#[cfg(feature = "sim")]
pub use sim_port::SimPort;
#[cfg(feature = "sim")]
pub use simulated_bus::{SIM_BUS_FRAME_CAP, SimulatedBus};
