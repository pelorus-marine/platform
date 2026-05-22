//! Pelorus **Core** building blocks — reusable protocol primitives aligned with
//! `specifications/core/`, composed by firmware and by reference binaries under
//! `pelorus-marine/reference-implementations/`.
//!
//! **Embedded-first:** enable `alloc` or `heapless` (both pull in [`pelorus_bounded`]);
//! use `default-features = false` on MCUs. Host validation uses the `sim` feature from
//! reference-implementations, not from production firmware.
//!
//! ## Building blocks
//!
//! | Module | Spec | Notes |
//! |--------|------|-------|
//! | [`wire`] | 03 §2 | Identifier pack/unpack |
//! | [`bus`] | 03 §1 | [`CanFdBus`] trait |
//! | [`addressing`] | 05 | Address claiming (step 1) |
//! | [`power`] | 04 | WUF + network management |
//! | [`transport`] | 03 §4 | Multi-frame transport |

#![cfg_attr(not(feature = "alloc"), no_std)]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

#[cfg(all(not(feature = "alloc"), not(feature = "heapless")))]
compile_error!("pelorus-core requires feature `alloc` or `heapless` (pelorus-bounded)");

#[cfg(feature = "alloc")]
extern crate alloc;

pub mod addressing;
pub mod bus;
pub mod power;
pub mod transport;
pub mod wire;

pub use addressing::{
    AddressClaimConfig, AddressClaimEngine, AddressClaimFrame, AddressCommandFrame, ClaimAction,
    ClaimState, DEFAULT_LISTEN_MS, MAX_CLAIMED_ADDRESS, Name, NameBuilder,
};
pub use bus::{CAN_FD_MAX_DATA, CanFdBus, CanFdFrame};
#[cfg(feature = "sim")]
pub use bus::{SIM_BUS_FRAME_CAP, SimBusError, SimPort, SimulatedBus};
pub use power::{
    ANCHOR_WATCH, COMMS, ClusterNmState, DOMESTIC, ENGINE, FunctionalGroups, NM_PERIOD_MS,
    NetworkManagementConfig, NetworkManagementEngine, NetworkManagementFrame, NmAction,
    NmWireState, PowerState, READY_SLEEP_MS, REPEAT_MESSAGE_MS, STORM, UNDERWAY, V1_STD_MASK,
    WAIT_BUS_SLEEP_MS, WakeUpFrame,
};
pub use transport::{
    AbortControl, BroadcastOpenControl, CloseControl, ControlOpcode, DEFAULT_REASSEMBLY_CAP,
    IngressBroadcastSession, IngressResult, MAX_CONCURRENT_EGRESS, MAX_CONCURRENT_INGRESS,
    MULTIFRAME_DATA_CHUNK, MultiframeControl, MultiframeData, OpenAckControl, OpenControl,
    OpenNakControl, TransportAction, TransportReasonCode, TransportStatusCode, WINDOW_MISSING_CAP,
    WindowControl, crc32,
};
pub use wire::{
    DC_ID_ADDRESS_CLAIM, DC_ID_ADDRESS_COMMAND, DC_ID_MULTIFRAME_CONTROL, DC_ID_MULTIFRAME_DATA,
    DC_ID_NETWORK_MANAGEMENT, DC_ID_WAKE_UP, DcId, Identifier, PRIORITY_ADDRESSING,
    PRIORITY_MULTIFRAME, PRIORITY_NETWORK_MANAGEMENT, PRIORITY_WAKE_UP, dc_id_from_identifier,
    identifier_from_parts, pack_identifier, unpack_identifier,
};
