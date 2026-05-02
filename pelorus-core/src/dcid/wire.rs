//! **04-power-management** §7 wire layouts — **WUF** (**0x0FF80**) and **NM** (**0x0FF81**) **v1.0**
//! eight-byte payloads (`no_std`-friendly encode/decode).

/// Lowest six bits of **04** §6 — standard marine functional groups.
pub mod functional_groups {
    /// Bit **0** — `anchor_watch`
    pub const ANCHOR_WATCH: u8 = 1 << 0;
    /// Bit **1** — `underway`
    pub const UNDERWAY: u8 = 1 << 1;
    /// Bit **2** — `engine`
    pub const ENGINE: u8 = 1 << 2;
    /// Bit **3** — `comms`
    pub const COMMS: u8 = 1 << 3;
    /// Bit **4** — `domestic`
    pub const DOMESTIC: u8 = 1 << 4;
    /// Bit **5** — `storm`
    pub const STORM: u8 = 1 << 5;
    /// Bits **6–7** of byte **0** reserved in **v1.0** — mask when asserting groups.
    pub const V1_STD_MASK: u8 = 0x3F;
}

/// NM state byte values (**04** §9.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum NmState {
    /// Ready-sleep
    ReadySleep = 0,
    /// Repeat-message
    RepeatMessage = 1,
    /// Normal-operation
    NormalOperation = 2,
    /// Prepare-bus-sleep
    PrepareBusSleep = 3,
}

impl NmState {
    /// Parse NM state from byte **0** of an NM frame. Unknown values return [`None`].
    #[must_use]
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0 => Some(Self::ReadySleep),
            1 => Some(Self::RepeatMessage),
            2 => Some(Self::NormalOperation),
            3 => Some(Self::PrepareBusSleep),
            _ => None,
        }
    }

    /// Raw NM state octet for byte **0** of an NM frame.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        self as u8
    }
}

/// Wake-Up Frame payload — **v1.0** (**04** §7.2): byte **0** = functional groups; tail reserved (zero).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WufPayloadV1 {
    /// Functional-group bitmask — use lowest **6** bits per **04** §6 in **v1.0**.
    pub functional_groups: u8,
}

impl WufPayloadV1 {
    /// Encode **DLC = 8** — bytes **1–7** reserved, transmit **`0x00`** (**04** §7.2).
    #[must_use]
    pub fn encode(&self) -> [u8; 8] {
        let mut a = [0x00_u8; 8];
        a[0] = self.functional_groups & functional_groups::V1_STD_MASK;
        a
    }

    /// Decode from **8**-byte data field. Reserved bytes **1–7** are ignored (**04** §7.2 receive rule).
    #[must_use]
    pub fn decode(data: &[u8]) -> Option<Self> {
        if data.len() < 8 {
            return None;
        }
        Some(Self {
            functional_groups: data[0],
        })
    }
}

/// Network Management payload — **v1.0** (**04** §7.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NmPayloadV1 {
    /// NM state machine (**04** §9.2).
    pub state: NmState,
    /// Active functional groups — low byte (**04** §7.4).
    pub active_groups_low: u8,
}

impl NmPayloadV1 {
    /// Encode **DLC = 8**; bytes **2–7** zero per **04** §7.4 transmit rule.
    #[must_use]
    pub fn encode(&self) -> [u8; 8] {
        let mut a = [0x00_u8; 8];
        a[0] = self.state.to_byte();
        a[1] = self.active_groups_low;
        a
    }

    /// Decode; accepts any bytes **2–7** on receive (ignored).
    #[must_use]
    pub fn decode(data: &[u8]) -> Option<Self> {
        if data.len() < 8 {
            return None;
        }
        Some(Self {
            state: NmState::from_byte(data[0])?,
            active_groups_low: data[1],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wuf_round_trip() {
        let p = WufPayloadV1 {
            functional_groups: functional_groups::ANCHOR_WATCH | functional_groups::UNDERWAY,
        };
        let b = p.encode();
        assert_eq!(WufPayloadV1::decode(&b), Some(p));
    }

    #[test]
    fn nm_round_trip() {
        let p = NmPayloadV1 {
            state: NmState::NormalOperation,
            active_groups_low: functional_groups::ENGINE,
        };
        let b = p.encode();
        assert_eq!(NmPayloadV1::decode(&b), Some(p));
    }
}
