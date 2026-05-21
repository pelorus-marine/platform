//! Multi-frame session limits (`03-data-link.md` §4.1).

/// v1.0: at most one ingress and one egress session per node.
pub const MAX_CONCURRENT_INGRESS: usize = 1;
/// v1.0: at most one ingress and one egress session per node.
pub const MAX_CONCURRENT_EGRESS: usize = 1;
/// Payload bytes per `Pelorus.MultiFrameData` frame (`03` §4.3).
pub const MULTIFRAME_DATA_CHUNK: usize = 58;
/// Default reassembly cap for embedded receivers (implementation-defined under spec max).
pub const DEFAULT_REASSEMBLY_CAP: usize = 8192;
