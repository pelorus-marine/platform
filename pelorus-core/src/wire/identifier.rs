//! Parsed 29-bit Pelorus Core identifier (`03-data-link.md` §2).

use super::DcId;

/// Parsed 29-bit Pelorus Core identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Identifier {
    /// Priority 0 (highest) … 7 (lowest).
    pub priority: u8,
    /// 18-bit DC_ID (`0x00000`–`0x3FFFF`).
    pub dc_id: DcId,
    /// Source address (`05-addressing.md` §1).
    pub source_address: u8,
}
