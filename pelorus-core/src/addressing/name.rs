//! 64-bit J1939 NAME (`05-addressing.md` §2).

/// Device NAME — compared as one **little-endian** 64-bit integer for conflict resolution (`05` §3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Name(pub u64);

impl Name {
    /// Raw NAME value used for arbitration.
    #[must_use]
    pub const fn raw(self) -> u64 {
        self.0
    }

    /// NAME from eight data bytes (J1939 address-claim payload order).
    #[must_use]
    pub fn from_le_bytes(bytes: [u8; 8]) -> Self {
        Self(u64::from_le_bytes(bytes))
    }

    /// Eight-byte little-endian payload.
    #[must_use]
    pub const fn to_le_bytes(self) -> [u8; 8] {
        self.0.to_le_bytes()
    }

    /// `true` when `self` wins over `other` on the same source address.
    #[must_use]
    pub fn wins_over(self, other: Name) -> bool {
        self.0 < other.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lower_raw_name_wins() {
        assert!(Name(1).wins_over(Name(2)));
    }
}
