//! CAN FD data frame (`03-data-link.md` §1).

use super::can_fd_max_data::CAN_FD_MAX_DATA;

/// One CAN FD data frame (extended 29-bit identifier).
///
/// Remote frames and Classical CAN are out of scope for Pelorus Core application traffic
/// (see `04-power.md` for selective wake-up exceptions).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CanFdFrame {
    /// 29-bit extended arbitration field (`wire::pack_identifier`).
    pub id: u32,
    /// Payload length in bytes (`0`–`64`).
    pub len: u8,
    /// Payload bytes; only `data[..len]` is meaningful.
    pub data: [u8; CAN_FD_MAX_DATA],
    /// Bit Rate Switch set on transmit (CAN FD data phase).
    pub bit_rate_switch: bool,
    /// FDF / CAN FD format flag.
    pub fd_format: bool,
}

impl CanFdFrame {
    /// Build a CAN FD frame with `fd_format` and BRS set (typical Pelorus Core data traffic).
    #[must_use]
    pub fn new_fd(id: u32, payload: &[u8]) -> Self {
        let len = payload.len().min(CAN_FD_MAX_DATA) as u8;
        let mut data = [0u8; CAN_FD_MAX_DATA];
        data[..payload.len().min(CAN_FD_MAX_DATA)].copy_from_slice(payload);
        Self {
            id: id & 0x1FFF_FFFF,
            len,
            data,
            bit_rate_switch: true,
            fd_format: true,
        }
    }

    /// Active payload slice.
    #[must_use]
    pub fn payload(&self) -> &[u8] {
        &self.data[..self.len as usize]
    }
}

impl Default for CanFdFrame {
    fn default() -> Self {
        Self {
            id: 0,
            len: 0,
            data: [0u8; CAN_FD_MAX_DATA],
            bit_rate_switch: true,
            fd_format: true,
        }
    }
}
