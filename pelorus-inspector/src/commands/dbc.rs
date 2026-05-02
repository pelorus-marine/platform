//! DBC file loading and management commands.

use crate::agent::ops::{decode_frames as decode_frames_inner, load_dbc as load_dbc_inner};
use crate::dto::{
    AttributeAssignmentInfo, AttributeDefaultInfo, AttributeDefinitionInfo, AttributeTargetInfo,
    AttributeValueInfo, AttributeValueType, BitTimingInfo, CanFrameDto, DbcInfo, DecodeResponse,
    ExtendedMultiplexingInfo, MessageInfo, NodeInfo, SignalInfo, SignalValueDescriptions,
    ValueDescriptionEntry,
};
use crate::state::AppState;
use dbc_rs::Dbc;
use std::sync::Arc;
use tauri::State;

/// Load and parse a DBC file.
/// Saves the path to session config for persistence.
#[tauri::command]
pub async fn load_dbc(path: String, state: State<'_, Arc<AppState>>) -> Result<String, String> {
    load_dbc_inner(&state, &path)
}

/// Clear the loaded DBC data.
/// Removes from session config.
#[tauri::command]
pub async fn clear_dbc(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state.clear_dbc();
    *state.dbc_path.lock() = None;

    // Clear from session config
    if let Err(e) = state.session.lock().set_dbc_path(None) {
        log::warn!("Failed to save session: {}", e);
    }

    Ok(())
}

/// Get the path to the currently loaded DBC file.
#[tauri::command]
pub async fn get_dbc_path(state: State<'_, Arc<AppState>>) -> Result<Option<String>, String> {
    Ok(state.dbc_path.lock().clone())
}

/// Decode a single CAN frame using the loaded DBC.
#[tauri::command]
pub async fn decode_single_frame(
    frame: CanFrameDto,
    state: State<'_, Arc<AppState>>,
) -> Result<DecodeResponse, String> {
    Ok(decode_frames_inner(&state, std::slice::from_ref(&frame)))
}

/// Decode multiple CAN frames using the loaded DBC.
#[tauri::command]
pub async fn decode_frames(
    frames: Vec<CanFrameDto>,
    state: State<'_, Arc<AppState>>,
) -> Result<DecodeResponse, String> {
    Ok(decode_frames_inner(&state, &frames))
}

/// Save DBC content to a file.
/// Validates the content by parsing it before writing.
#[tauri::command]
pub async fn save_dbc_content(
    path: String,
    content: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    // Validate by parsing the content BEFORE writing to file
    let dbc = Dbc::parse(&content).map_err(|e| format!("Invalid DBC content: {:?}", e))?;

    // Content is valid, now write to file
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write DBC: {}", e))?;

    // Update state with the parsed DBC
    state.set_dbc(dbc);
    *state.dbc_path.lock() = Some(path.clone());

    // Save to session config
    if let Err(e) = state.session.lock().set_dbc_path(Some(path.clone())) {
        log::warn!("Failed to save session: {}", e);
    }

    Ok(())
}

/// Update the in-memory DBC from content string (for live editing).
/// Does NOT save to file or update the file path.
#[tauri::command]
pub async fn update_dbc_content(
    content: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let dbc = Dbc::parse(&content).map_err(|e| format!("Failed to parse DBC: {:?}", e))?;
    let msg_count = dbc.messages().len();

    state.set_dbc(dbc);
    Ok(format!("Updated DBC with {} messages", msg_count))
}

/// Build a structured view of `dbc` for JSON / automation (also used by `pelorus-agent dbc-info`).
pub fn build_dbc_info(dbc: &Dbc) -> DbcInfo {
    // Extract nodes
    let nodes: Vec<NodeInfo> = dbc
        .nodes()
        .iter_nodes()
        .map(|node| NodeInfo {
            name: node.name().to_string(),
            comment: node.comment().map(|s| s.to_string()),
        })
        .collect();

    // Extract messages with full signal info
    let messages: Vec<MessageInfo> = dbc
        .messages()
        .iter()
        .map(|msg| {
            let signals: Vec<SignalInfo> = msg
                .signals()
                .iter()
                .map(|sig| {
                    let byte_order = match sig.byte_order() {
                        dbc_rs::ByteOrder::BigEndian => "big_endian",
                        dbc_rs::ByteOrder::LittleEndian => "little_endian",
                    };
                    let receivers: Vec<String> =
                        sig.receivers().iter().map(|r| r.to_string()).collect();
                    SignalInfo {
                        name: sig.name().to_string(),
                        start_bit: sig.start_bit() as u32,
                        length: sig.length() as u32,
                        byte_order: byte_order.to_string(),
                        is_signed: !sig.is_unsigned(),
                        factor: sig.factor(),
                        offset: sig.offset(),
                        min: sig.min(),
                        max: sig.max(),
                        unit: sig.unit().unwrap_or("").to_string(),
                        receivers,
                        is_multiplexer: sig.is_multiplexer_switch(),
                        multiplexer_value: sig.multiplexer_switch_value(),
                        comment: sig.comment().map(|s| s.to_string()),
                    }
                })
                .collect();

            MessageInfo {
                id: msg.id(),
                is_extended: msg.is_extended(),
                name: msg.name().to_string(),
                dlc: msg.dlc(),
                sender: msg.sender().to_string(),
                signals,
                comment: msg.comment().map(|s| s.to_string()),
            }
        })
        .collect();

    // Extract value descriptions
    let mut value_descriptions: Vec<SignalValueDescriptions> = Vec::new();
    for msg in dbc.messages().iter() {
        for sig in msg.signals().iter() {
            if let Some(val_descs) = dbc.value_descriptions_for_signal(msg.id(), sig.name()) {
                let descriptions: Vec<ValueDescriptionEntry> = val_descs
                    .iter()
                    .map(|(val, desc)| ValueDescriptionEntry {
                        value: val as i64,
                        description: desc.to_string(),
                    })
                    .collect();
                if !descriptions.is_empty() {
                    value_descriptions.push(SignalValueDescriptions {
                        message_id: msg.id(),
                        signal_name: sig.name().to_string(),
                        descriptions,
                    });
                }
            }
        }
    }

    // Extract attribute definitions
    let attribute_definitions: Vec<AttributeDefinitionInfo> = dbc
        .attribute_definitions()
        .iter()
        .map(|def| {
            let object_type = match def.object_type() {
                dbc_rs::AttributeObjectType::Network => "network",
                dbc_rs::AttributeObjectType::Node => "node",
                dbc_rs::AttributeObjectType::Message => "message",
                dbc_rs::AttributeObjectType::Signal => "signal",
            };
            let value_type = match def.value_type() {
                dbc_rs::AttributeValueType::Int { min, max } => AttributeValueType::Int {
                    min: *min,
                    max: *max,
                },
                dbc_rs::AttributeValueType::Hex { min, max } => AttributeValueType::Hex {
                    min: *min,
                    max: *max,
                },
                dbc_rs::AttributeValueType::Float { min, max } => AttributeValueType::Float {
                    min: *min,
                    max: *max,
                },
                dbc_rs::AttributeValueType::String => AttributeValueType::String,
                dbc_rs::AttributeValueType::Enum { values } => AttributeValueType::Enum {
                    values: values.iter().map(|v| v.to_string()).collect(),
                },
            };
            AttributeDefinitionInfo {
                name: def.name().to_string(),
                object_type: object_type.to_string(),
                value_type,
            }
        })
        .collect();

    // Extract attribute defaults
    let attribute_defaults: Vec<AttributeDefaultInfo> = dbc
        .attribute_defaults()
        .iter()
        .map(|(name, value)| AttributeDefaultInfo {
            name: name.to_string(),
            value: convert_attribute_value(value),
        })
        .collect();

    // Extract attribute values
    let attribute_values: Vec<AttributeAssignmentInfo> = dbc
        .attribute_values()
        .iter()
        .map(|((name, target), value)| {
            let target_info = match target {
                dbc_rs::AttributeTarget::Network => AttributeTargetInfo::Network,
                dbc_rs::AttributeTarget::Node(node_name) => AttributeTargetInfo::Node {
                    node_name: node_name.to_string(),
                },
                dbc_rs::AttributeTarget::Message(msg_id) => AttributeTargetInfo::Message {
                    message_id: *msg_id,
                },
                dbc_rs::AttributeTarget::Signal(msg_id, sig_name) => AttributeTargetInfo::Signal {
                    message_id: *msg_id,
                    signal_name: sig_name.to_string(),
                },
            };
            AttributeAssignmentInfo {
                name: name.to_string(),
                target: target_info,
                value: convert_attribute_value(value),
            }
        })
        .collect();

    // Extract extended multiplexing
    let extended_multiplexing: Vec<ExtendedMultiplexingInfo> = dbc
        .extended_multiplexing()
        .iter()
        .map(|em| ExtendedMultiplexingInfo {
            message_id: em.message_id(),
            signal_name: em.signal_name().to_string(),
            multiplexer_signal: em.multiplexer_switch().to_string(),
            ranges: em.value_ranges().to_vec(),
        })
        .collect();

    // Extract bit timing
    let bit_timing = dbc.bit_timing().and_then(|bt| {
        bt.baudrate().map(|baudrate| BitTimingInfo {
            baudrate,
            btr1: bt.btr1().unwrap_or(0),
            btr2: bt.btr2().unwrap_or(0),
        })
    });

    DbcInfo {
        version: dbc.version().map(|v| v.to_string()),
        bit_timing,
        comment: dbc.comment().map(|s| s.to_string()),
        nodes,
        messages,
        value_descriptions,
        attribute_definitions,
        attribute_defaults,
        attribute_values,
        extended_multiplexing,
    }
}

/// Get information about the loaded DBC.
#[tauri::command]
pub async fn get_dbc_info(state: State<'_, Arc<AppState>>) -> Result<Option<DbcInfo>, String> {
    let dbc_guard = state.dbc.lock();
    let Some(ref dbc) = *dbc_guard else {
        return Ok(None);
    };
    Ok(Some(build_dbc_info(dbc)))
}

fn convert_attribute_value(value: &dbc_rs::AttributeValue) -> AttributeValueInfo {
    match value {
        dbc_rs::AttributeValue::Int(i) => AttributeValueInfo::Int(*i),
        dbc_rs::AttributeValue::Float(f) => AttributeValueInfo::Float(*f),
        dbc_rs::AttributeValue::String(s) => AttributeValueInfo::String(s.to_string()),
    }
}

/// Get the DBC file format specification.
/// This is the SPECIFICATIONS.md from the dbc-rs crate.
#[tauri::command]
pub async fn get_dbc_specification() -> Result<String, String> {
    Ok(dbc_rs::SPECIFICATION.to_string())
}
