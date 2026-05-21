//! Normative DC_ID and priority constants (`07-dcid-registry.md`, `03-data-link.md` §2.2).

use super::DcId;

/// `Pelorus.WakeUp` (`04-power.md` §4.1, `07` §1.1).
pub const DC_ID_WAKE_UP: DcId = 0x00001;
/// `Pelorus.NetworkManagement` (`04-power.md` §4.2).
pub const DC_ID_NETWORK_MANAGEMENT: DcId = 0x00002;
/// `Pelorus.AddressClaim` (`07` §1.4).
pub const DC_ID_ADDRESS_CLAIM: DcId = 0x00005;
/// `Pelorus.AddressCommand` (`07` §1.4).
pub const DC_ID_ADDRESS_COMMAND: DcId = 0x00006;
/// `Pelorus.MultiFrameControl` (`03-data-link.md` §4).
pub const DC_ID_MULTIFRAME_CONTROL: DcId = 0x00008;
/// `Pelorus.MultiFrameData` (`03-data-link.md` §4).
pub const DC_ID_MULTIFRAME_DATA: DcId = 0x00009;

/// Priority for `Pelorus.WakeUp` (`04` §4.1).
pub const PRIORITY_WAKE_UP: u8 = 0;
/// Priority for `Pelorus.NetworkManagement` (`04` §4.2, `03` §2.2).
pub const PRIORITY_NETWORK_MANAGEMENT: u8 = 6;
/// Priority for address-management DCs (`03` §2.2).
pub const PRIORITY_ADDRESSING: u8 = 6;
/// Priority for multi-frame transport (`03` §4).
pub const PRIORITY_MULTIFRAME: u8 = 7;
