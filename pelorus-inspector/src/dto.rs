//! Data Transfer Objects for frontend communication.
//!
//! These types are serializable versions of internal types, used for
//! communication between the Rust backend and the JavaScript frontend.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// DBC DTOs
// ─────────────────────────────────────────────────────────────────────────────

/// Node (ECU) definition from DBC.
#[derive(Debug, Clone, Serialize)]
pub struct NodeInfo {
    pub name: String,
    pub comment: Option<String>,
}

/// Signal definition from DBC.
#[derive(Debug, Clone, Serialize)]
pub struct SignalInfo {
    pub name: String,
    pub start_bit: u32,
    pub length: u32,
    pub byte_order: String,
    pub is_signed: bool,
    pub factor: f64,
    pub offset: f64,
    pub min: f64,
    pub max: f64,
    pub unit: String,
    pub receivers: Vec<String>,
    pub is_multiplexer: bool,
    pub multiplexer_value: Option<u64>,
    /// Comment from CM_ SG_ entry
    pub comment: Option<String>,
}

/// Message definition from DBC.
#[derive(Debug, Clone, Serialize)]
pub struct MessageInfo {
    pub id: u32,
    pub is_extended: bool,
    pub name: String,
    pub dlc: u8,
    pub sender: String,
    pub signals: Vec<SignalInfo>,
    /// Comment from CM_ BO_ entry
    pub comment: Option<String>,
}

/// Bit timing configuration (BS_ section).
#[derive(Debug, Clone, Serialize)]
pub struct BitTimingInfo {
    pub baudrate: u32,
    pub btr1: u32,
    pub btr2: u32,
}

/// Single value description entry.
#[derive(Debug, Clone, Serialize)]
pub struct ValueDescriptionEntry {
    pub value: i64,
    pub description: String,
}

/// Value descriptions for a signal (VAL_).
#[derive(Debug, Clone, Serialize)]
pub struct SignalValueDescriptions {
    pub message_id: u32,
    pub signal_name: String,
    pub descriptions: Vec<ValueDescriptionEntry>,
}

/// Attribute value type with constraints.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum AttributeValueType {
    #[serde(rename = "int")]
    Int { min: i64, max: i64 },
    #[serde(rename = "hex")]
    Hex { min: i64, max: i64 },
    #[serde(rename = "float")]
    Float { min: f64, max: f64 },
    #[serde(rename = "string")]
    String,
    #[serde(rename = "enum")]
    Enum { values: Vec<String> },
}

/// Attribute definition (BA_DEF_).
#[derive(Debug, Clone, Serialize)]
pub struct AttributeDefinitionInfo {
    pub name: String,
    pub object_type: String, // "network", "node", "message", "signal"
    pub value_type: AttributeValueType,
}

/// Attribute default value (BA_DEF_DEF_).
#[derive(Debug, Clone, Serialize)]
pub struct AttributeDefaultInfo {
    pub name: String,
    pub value: AttributeValueInfo,
}

/// Attribute value (can be int, float, or string).
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum AttributeValueInfo {
    Int(i64),
    Float(f64),
    String(String),
}

/// Attribute target specification.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum AttributeTargetInfo {
    #[serde(rename = "network")]
    Network,
    #[serde(rename = "node")]
    Node { node_name: String },
    #[serde(rename = "message")]
    Message { message_id: u32 },
    #[serde(rename = "signal")]
    Signal {
        message_id: u32,
        signal_name: String,
    },
}

/// Attribute value assignment (BA_).
#[derive(Debug, Clone, Serialize)]
pub struct AttributeAssignmentInfo {
    pub name: String,
    pub target: AttributeTargetInfo,
    pub value: AttributeValueInfo,
}

/// Extended multiplexing entry (SG_MUL_VAL_).
#[derive(Debug, Clone, Serialize)]
pub struct ExtendedMultiplexingInfo {
    pub message_id: u32,
    pub signal_name: String,
    pub multiplexer_signal: String,
    pub ranges: Vec<(u64, u64)>,
}

/// Full DBC structure for display/editing.
#[derive(Debug, Clone, Serialize)]
pub struct DbcInfo {
    pub version: Option<String>,
    pub bit_timing: Option<BitTimingInfo>,
    pub comment: Option<String>,
    pub nodes: Vec<NodeInfo>,
    pub messages: Vec<MessageInfo>,
    pub value_descriptions: Vec<SignalValueDescriptions>,
    pub attribute_definitions: Vec<AttributeDefinitionInfo>,
    pub attribute_defaults: Vec<AttributeDefaultInfo>,
    pub attribute_values: Vec<AttributeAssignmentInfo>,
    pub extended_multiplexing: Vec<ExtendedMultiplexingInfo>,
}

// ─────────────────────────────────────────────────────────────────────────────
// CAN Frame DTOs
// ─────────────────────────────────────────────────────────────────────────────

/// Kernel-level CAN filter (BPF) for socket filtering.
///
/// Filters are applied at the kernel level before frames reach userspace,
/// providing efficient hardware-accelerated filtering.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanBpfFilter {
    /// CAN ID to match
    pub can_id: u32,
    /// Mask for matching (1 bits = must match, 0 bits = don't care)
    pub mask: u32,
    /// If true, filter matches extended (29-bit) IDs
    pub is_extended: bool,
    /// If true, invert the filter (reject matching frames)
    pub inverted: bool,
}

/// Serializable CAN frame for frontend communication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanFrameDto {
    pub timestamp: f64,
    pub channel: String,
    pub can_id: u32,
    pub is_extended: bool,
    pub is_fd: bool,
    pub brs: bool,
    pub esi: bool,
    pub dlc: u8,
    pub data: Vec<u8>,
}

impl CanFrameDto {
    /// Helper to extract CAN ID as u32 from embedded_can::Id.
    #[cfg(target_os = "linux")]
    fn id_to_u32(id: embedded_can::Id) -> u32 {
        match id {
            embedded_can::Id::Standard(id) => id.as_raw() as u32,
            embedded_can::Id::Extended(id) => id.as_raw(),
        }
    }

    /// Create from any socketcan frame type (classic CAN or CAN FD).
    /// Uses embedded_can::Frame trait for frame access.
    /// Returns None for error and remote frames.
    #[cfg(target_os = "linux")]
    pub fn from_any_frame(
        frame: &socketcan::CanAnyFrame,
        timestamp: f64,
        channel: &str,
    ) -> Option<Self> {
        // Use embedded_can::Frame trait for generic frame access
        use embedded_can::Frame;
        // Note: is_brs() and is_esi() are inherent methods on CanFdFrame

        match frame {
            socketcan::CanAnyFrame::Normal(data_frame) => Some(Self {
                timestamp,
                channel: channel.to_string(),
                can_id: Self::id_to_u32(data_frame.id()),
                is_extended: data_frame.is_extended(),
                is_fd: false,
                brs: false,
                esi: false,
                dlc: data_frame.dlc() as u8,
                data: data_frame.data().to_vec(),
            }),
            socketcan::CanAnyFrame::Remote(_) => None, // Omit remote frames (not represented in payloads)
            socketcan::CanAnyFrame::Fd(fd_frame) => Some(Self {
                timestamp,
                channel: channel.to_string(),
                can_id: Self::id_to_u32(fd_frame.id()),
                is_extended: fd_frame.is_extended(),
                is_fd: true,
                brs: fd_frame.is_brs(),
                esi: fd_frame.is_esi(),
                dlc: fd_frame.dlc() as u8,
                data: fd_frame.data().to_vec(),
            }),
            socketcan::CanAnyFrame::Error(_) => None, // Skip error frames
        }
    }

    /// Create from MDF4 channel data (classic CAN).
    pub fn from_mdf4(timestamp: f64, channel: String, can_id: u32, dlc: u8, data: Vec<u8>) -> Self {
        let is_fd = data.len() > 8 || dlc > 8;
        Self {
            timestamp,
            channel,
            can_id,
            is_extended: can_id > 0x7FF,
            is_fd,
            brs: false, // Not available in basic MDF4 data
            esi: false,
            dlc,
            data,
        }
    }

    /// Create from MDF4 channel data with CAN FD flags.
    #[allow(dead_code)]
    pub fn from_mdf4_fd(
        timestamp: f64,
        channel: String,
        can_id: u32,
        dlc: u8,
        data: Vec<u8>,
        brs: bool,
        esi: bool,
    ) -> Self {
        Self {
            timestamp,
            channel,
            can_id,
            is_extended: can_id > 0x7FF,
            is_fd: true,
            brs,
            esi,
            dlc,
            data,
        }
    }
}

/// Serializable decoded signal for frontend communication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedSignalDto {
    pub timestamp: f64,
    pub message_name: String,
    pub signal_name: String,
    pub value: f64,
    pub raw_value: i64,
    pub unit: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl DecodedSignalDto {
    /// Convert from dbc_rs::DecodedSignal, adding timestamp and message name.
    pub fn from_dbc_signal(
        sig: &dbc_rs::DecodedSignal<'_>,
        timestamp: f64,
        message_name: &str,
    ) -> Self {
        Self {
            timestamp,
            message_name: message_name.to_string(),
            signal_name: sig.name.to_string(),
            value: sig.value,
            raw_value: sig.raw_value,
            unit: sig.unit.unwrap_or("").to_string(),
            description: sig.description.map(|s| s.to_string()),
        }
    }
}

/// Response from decode_frames command, including any errors.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodeResponse {
    pub signals: Vec<DecodedSignalDto>,
    pub errors: Vec<String>,
}

/// CAN bus error frame for frontend communication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanErrorDto {
    pub timestamp: f64,
    pub channel: String,
    pub error_type: String,
    pub details: String,
}

#[cfg(target_os = "linux")]
impl CanErrorDto {
    /// Create from socketcan error frame.
    pub fn from_error_frame(
        frame: socketcan::CanErrorFrame,
        timestamp: f64,
        channel: &str,
    ) -> Self {
        use socketcan::CanError;

        // Convert frame to CanError using the From trait
        let error: CanError = frame.into();

        let (error_type, details) = match error {
            CanError::TransmitTimeout => ("TX Timeout", "Transmit timeout".to_string()),
            CanError::LostArbitration(bit) => ("Lost Arbitration", format!("at bit {}", bit)),
            CanError::ControllerProblem(err) => ("Controller", format!("{:?}", err)),
            CanError::ProtocolViolation { vtype, location } => (
                "Protocol Violation",
                format!("{:?} at {:?}", vtype, location),
            ),
            CanError::TransceiverError => ("Transceiver", "Transceiver error".to_string()),
            CanError::NoAck => ("No ACK", "No acknowledgment received".to_string()),
            CanError::BusOff => ("Bus Off", "Controller is bus-off".to_string()),
            CanError::BusError => ("Bus Error", "Bus error occurred".to_string()),
            CanError::Restarted => ("Restarted", "Controller restarted".to_string()),
            CanError::DecodingFailure(msg) => ("Decode Error", msg.to_string()),
            CanError::Unknown(code) => ("Unknown", format!("Error code: 0x{:08X}", code)),
        };

        Self {
            timestamp,
            channel: channel.to_string(),
            error_type: error_type.to_string(),
            details,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Capture DTOs
// ─────────────────────────────────────────────────────────────────────────────

/// Capture statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureStatsDto {
    pub frame_count: u64,
    pub message_count: u32,
    pub signal_count: u32,
    pub frame_rate: f64,
    pub elapsed_secs: f64,
    pub capture_file: Option<String>,
}

/// Pre-rendered stats strings for frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsHtml {
    pub message_count: String,
    pub frame_count: String,
    pub frame_rate: String,
    pub elapsed: String,
}

/// Periodic update sent to frontend during live capture.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveCaptureUpdate {
    pub stats: CaptureStatsDto,
    /// Pre-rendered HTML for message monitor table body.
    pub messages_html: String,
    /// Pre-rendered HTML for signal monitor container.
    pub signals_html: String,
    /// Pre-rendered HTML for frame stream table body.
    pub frames_html: String,
    /// Pre-rendered HTML for error monitor table body.
    pub errors_html: String,
    /// Pre-formatted stats strings.
    pub stats_html: StatsHtml,
    /// Badge counts for tabs.
    pub message_count: u32,
    pub signal_count: u32,
    pub frame_count: usize,
    pub error_count: u32,
}
