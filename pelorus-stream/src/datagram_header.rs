//! Pelorus Stream **datagram header** — fixed 16-byte binary header prefixing
//! every QUIC datagram on a Stream service (`specifications/stream/04-transport.md §5`).
//!
//! Layout per **04-transport** §5 (offsets in bytes):
//!
//! | Off | Size | Field |
//! |-----|------|-------|
//! | 0   | 2    | Service type |
//! | 2   | 2    | Instance |
//! | 4   | 2    | Sequence number (16-bit rolling, per `(source, service, instance)`) |
//! | 6   | 1    | Fabric ID (`0x00` = A, `0x01` = B) |
//! | 7   | 1    | Flags (bit 0 = time sync valid; bits 1–7 reserved) |
//! | 8   | 8    | Timestamp (ns since gPTP epoch, IEEE 802.1AS) |
//!
//! Multi-byte fields are encoded **big-endian** (network byte order). The spec
//! table omits endianness; this matches IETF convention for binary protocols
//! and is the working assumption for this module.

/// Datagram header size in bytes (**04-transport** §5).
pub const HEADER_SIZE: usize = 16;

/// Flag bit 0 — sender has valid gPTP time sync (**04-transport** §5).
pub const FLAG_TIME_SYNC_VALID: u8 = 1 << 0;

/// Fabric identifier per **07-redundancy** dual-fabric model.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum FabricId {
    /// Fabric A — wire value `0x00`.
    A = 0x00,
    /// Fabric B — wire value `0x01`.
    B = 0x01,
}

impl FabricId {
    /// Parse the fabric octet. Unknown values return [`None`] — receivers shall reject.
    #[must_use]
    pub const fn from_byte(b: u8) -> Option<Self> {
        match b {
            0x00 => Some(Self::A),
            0x01 => Some(Self::B),
            _ => None,
        }
    }

    /// Raw octet.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        self as u8
    }
}

/// Decoded datagram header. Fields mirror **04-transport** §5 one-for-one.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DatagramHeader {
    /// Service type code (**08-discovery-and-registry**).
    pub service_type: u16,
    /// Service instance (e.g. radar antenna index).
    pub instance: u16,
    /// 16-bit rolling sequence, per `(source, service, instance)`.
    pub sequence: u16,
    /// Fabric this datagram was emitted on.
    pub fabric: FabricId,
    /// Flags byte. Bit 0 = time sync valid; bits 1–7 reserved (transmit `0`, ignore on receive).
    pub flags: u8,
    /// Nanoseconds since gPTP epoch (IEEE 802.1AS) — see **09-time-sync**.
    pub timestamp_ns: u64,
}

impl DatagramHeader {
    /// Encode to the 16-byte wire form. Reserved flag bits are written as-is;
    /// **04-transport** §5 requires senders to transmit them as `0`.
    #[must_use]
    pub fn encode(&self) -> [u8; HEADER_SIZE] {
        let mut buf = [0u8; HEADER_SIZE];
        buf[0..2].copy_from_slice(&self.service_type.to_be_bytes());
        buf[2..4].copy_from_slice(&self.instance.to_be_bytes());
        buf[4..6].copy_from_slice(&self.sequence.to_be_bytes());
        buf[6] = self.fabric.to_byte();
        buf[7] = self.flags;
        buf[8..16].copy_from_slice(&self.timestamp_ns.to_be_bytes());
        buf
    }

    /// Decode from the leading 16 bytes of `data`. Returns [`None`] if the slice
    /// is shorter than [`HEADER_SIZE`] or the fabric octet is not `0x00`/`0x01`.
    /// Reserved flag bits are retained verbatim (**04-transport** §5 receive rule:
    /// "ignore on receive").
    #[must_use]
    pub fn decode(data: &[u8]) -> Option<Self> {
        if data.len() < HEADER_SIZE {
            return None;
        }
        let service_type = u16::from_be_bytes([data[0], data[1]]);
        let instance = u16::from_be_bytes([data[2], data[3]]);
        let sequence = u16::from_be_bytes([data[4], data[5]]);
        let fabric = FabricId::from_byte(data[6])?;
        let flags = data[7];
        let timestamp_ns = u64::from_be_bytes([
            data[8], data[9], data[10], data[11], data[12], data[13], data[14], data[15],
        ]);
        Some(Self {
            service_type,
            instance,
            sequence,
            fabric,
            flags,
            timestamp_ns,
        })
    }

    /// Whether the sender claims valid gPTP time sync (flag bit 0).
    #[must_use]
    pub const fn time_sync_valid(&self) -> bool {
        (self.flags & FLAG_TIME_SYNC_VALID) != 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> DatagramHeader {
        DatagramHeader {
            service_type: 0x0102,
            instance: 0x0304,
            sequence: 0x0506,
            fabric: FabricId::B,
            flags: FLAG_TIME_SYNC_VALID,
            timestamp_ns: 0x0102_0304_0506_0708,
        }
    }

    #[test]
    fn round_trip_preserves_all_fields() {
        let h = sample();
        let back = DatagramHeader::decode(&h.encode()).expect("decode");
        assert_eq!(h, back);
    }

    #[test]
    fn encoded_layout_is_big_endian_at_each_offset() {
        let bytes = sample().encode();
        assert_eq!(&bytes[0..2], &[0x01, 0x02], "service_type");
        assert_eq!(&bytes[2..4], &[0x03, 0x04], "instance");
        assert_eq!(&bytes[4..6], &[0x05, 0x06], "sequence");
        assert_eq!(bytes[6], 0x01, "fabric B");
        assert_eq!(bytes[7], 0x01, "flags");
        assert_eq!(
            &bytes[8..16],
            &[0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
            "timestamp_ns"
        );
    }

    #[test]
    fn header_is_sixteen_bytes() {
        assert_eq!(HEADER_SIZE, 16);
        assert_eq!(sample().encode().len(), HEADER_SIZE);
    }

    #[test]
    fn decode_rejects_short_buffer() {
        let bytes = [0u8; HEADER_SIZE - 1];
        assert!(DatagramHeader::decode(&bytes).is_none());
    }

    #[test]
    fn decode_ignores_trailing_payload() {
        let h = sample();
        let mut buf = [0u8; HEADER_SIZE + 8];
        buf[..HEADER_SIZE].copy_from_slice(&h.encode());
        let back = DatagramHeader::decode(&buf).expect("decode");
        assert_eq!(h, back);
    }

    #[test]
    fn decode_rejects_unknown_fabric() {
        let mut bytes = sample().encode();
        bytes[6] = 0x02;
        assert!(DatagramHeader::decode(&bytes).is_none());
    }

    #[test]
    fn fabric_round_trip_for_both_values() {
        for fabric in [FabricId::A, FabricId::B] {
            let h = DatagramHeader { fabric, ..sample() };
            assert_eq!(DatagramHeader::decode(&h.encode()).unwrap().fabric, fabric);
        }
    }

    #[test]
    fn time_sync_predicate_reads_bit_zero_only() {
        let mut h = sample();
        h.flags = 0;
        assert!(!h.time_sync_valid());
        h.flags = FLAG_TIME_SYNC_VALID;
        assert!(h.time_sync_valid());
        h.flags = 0xFE;
        assert!(!h.time_sync_valid(), "bit 0 clear, reserved bits set");
        h.flags = 0xFF;
        assert!(h.time_sync_valid(), "bit 0 set, reserved bits set");
    }

    #[test]
    fn reserved_flag_bits_are_preserved_on_round_trip() {
        let h = DatagramHeader {
            flags: 0xFE,
            ..sample()
        };
        let back = DatagramHeader::decode(&h.encode()).expect("decode");
        assert_eq!(back.flags, 0xFE);
    }

    #[test]
    fn sequence_wraps_at_u16_max() {
        let h = DatagramHeader {
            sequence: u16::MAX,
            ..sample()
        };
        let back = DatagramHeader::decode(&h.encode()).expect("decode");
        assert_eq!(back.sequence, u16::MAX);
    }
}
