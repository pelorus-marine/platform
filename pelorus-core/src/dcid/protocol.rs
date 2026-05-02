//! Pelorus Core protocol constants and DCID derivation (**03-data-link-layer** §3–§5).
//!
//! Multi-frame transport **reassembly** is not implemented here — only numeric DCIDs and the
//! single-frame **request** payload encoding (**03** §5.3).

/// Address Claimed (**03** §4, **05-addressing**).
pub const DCID_ADDRESS_CLAIMED: u32 = 0x0EE00;
/// Request PGN — payload carries requested DCID, 3 bytes LE (**03** §5.3).
pub const DCID_REQUEST: u32 = 0x0EA00;
/// Transport Protocol — Data Transfer (**03** §5).
pub const DCID_TRANSPORT_DATA: u32 = 0x0EB00;
/// Transport Protocol — Connection Management / BAM (**03** §5).
pub const DCID_TRANSPORT_CONNECTION: u32 = 0x0EC00;

/// Derive the Pelorus Core **DCID** from J1939 identifier fields (**03** §3.2).
///
/// `r` and `dp` are **0 or 1**. For **PDU1** (`pf ≤ 0xEF`), `ps` (destination address) is **not**
/// part of the DCID. For **PDU2** (`pf ≥ 0xF0`), `ps` is the group extension and **is** included.
#[must_use]
pub fn derive_dcid(r: u8, dp: u8, pf: u8, ps: u8) -> u32 {
    let r = u32::from(r & 1);
    let dp = u32::from(dp & 1);
    let pf = u32::from(pf);
    let ps = u32::from(ps);
    if pf <= 0xEF {
        (r << 17) | (dp << 16) | (pf << 8)
    } else {
        (r << 17) | (dp << 16) | (pf << 8) | ps
    }
}

/// Split a **29-bit** extended CAN identifier into J1939 **PRI**, **R**, **DP**, **PF**, **PS**, **SA**
/// (**03** §3, Figure).
#[must_use]
pub fn split_extended_id(id: u32) -> (u8, u8, u8, u8, u8, u8) {
    let id = id & 0x1FFF_FFFF;
    let prio = ((id >> 26) & 0x7) as u8;
    let r = ((id >> 25) & 1) as u8;
    let dp = ((id >> 24) & 1) as u8;
    let pf = ((id >> 16) & 0xFF) as u8;
    let ps = ((id >> 8) & 0xFF) as u8;
    let sa = (id & 0xFF) as u8;
    (prio, r, dp, pf, ps, sa)
}

/// [`derive_dcid`] from a packed **29-bit** extended identifier (priority ignored).
#[must_use]
pub fn dcid_from_extended_id(id: u32) -> u32 {
    let (_, r, dp, pf, ps, _) = split_extended_id(id);
    derive_dcid(r, dp, pf, ps)
}

/// Encode the **0x0EA00** request data field: requested DCID, **3 bytes little-endian** (**03** §5.3).
#[must_use]
pub fn encode_request_payload(target_dcid: u32) -> [u8; 3] {
    [
        (target_dcid & 0xFF) as u8,
        ((target_dcid >> 8) & 0xFF) as u8,
        ((target_dcid >> 16) & 0xFF) as u8,
    ]
}

/// Decode a **0x0EA00** request payload. Returns [`None`] if not exactly **3** bytes.
#[must_use]
pub fn decode_request_payload(bytes: &[u8]) -> Option<u32> {
    if bytes.len() != 3 {
        return None;
    }
    Some(u32::from(bytes[0]) | (u32::from(bytes[1]) << 8) | (u32::from(bytes[2]) << 16))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn example_row_wuf_matches_03() {
        // Table row: 0x18FF8003 → DCID 0x0FF80 (PRI 6, PF 0xFF, PS 0x80, SA 0x03)
        assert_eq!(dcid_from_extended_id(0x18FF8003), 0xFF80);
        assert_eq!(derive_dcid(0, 0, 0xFF, 0x80), 0xFF80);
    }

    #[test]
    fn pdu1_address_claim_dcid() {
        assert_eq!(derive_dcid(0, 0, 0xEE, 0x01), DCID_ADDRESS_CLAIMED);
    }

    #[test]
    fn request_payload_round_trip() {
        let dcid = 0xF004_u32;
        let b = encode_request_payload(dcid);
        assert_eq!(decode_request_payload(&b), Some(dcid));
    }
}
