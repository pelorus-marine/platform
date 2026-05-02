//! MDF4 loading integration test.
//!
//! This test verifies that pelorus-inspector can correctly load and decode MDF4 files
//! created by mdf4-rs, using the same DBC definition as can-frame-generator.
//!
//! Two workflows are tested:
//! 1. Raw MDF4: Load raw CAN frames and decode with DBC at read time
//! 2. Decoded MDF4: Load pre-decoded signal values

use dbc_rs::Dbc;
use mdf4_rs::MDF;
use mdf4_rs::can::{CanDbcLogger, RawCanLogger};

/// The complete.dbc file content from can-frame-generator.
const COMPLETE_DBC: &str = r#"VERSION "2.0"

NS_ :

BS_:

BU_: ECM TCM BCM ABS SENSOR

BO_ 256 EngineData : 8 ECM
 SG_ RPM : 7|16@0+ (0.25,0) [0|8000] "rpm" TCM BCM
 SG_ Temperature : 23|8@0- (1,-40) [-40|215] "C" TCM BCM ABS
 SG_ ThrottlePosition : 31|8@0+ (0.392157,0) [0|100] "%" *
 SG_ OilPressure : 32|16@1+ (0.01,0) [0|1000] "kPa" TCM

BO_ 512 TransmissionData : 8 TCM
 SG_ GearPosition : 7|8@0+ (1,0) [0|5] "" BCM
 SG_ ClutchEngaged : 8|1@0+ (1,0) [0|1] "" ECM
 SG_ Torque : 16|16@1- (0.1,0) [-3276.8|3276.7] "Nm" ECM BCM
 SG_ TransmissionTemp : 39|8@0- (1,-40) [-40|215] "C" ECM

BO_ 768 BrakeData : 6 ABS
 SG_ BrakePressure : 0|16@1+ (0.1,0) [0|1000] "bar" ECM BCM
 SG_ ABSActive : 16|1@0+ (1,0) [0|1] "" ECM
 SG_ WheelSpeedFL : 17|15@1+ (0.01,0) [0|327.67] "km/h" ECM
 SG_ WheelSpeedFR : 32|15@1+ (0.01,0) [0|327.67] "km/h" ECM

BO_ 1024 SensorData : 6 SENSOR
 SG_ Voltage : 7|16@0+ (0.01,0) [0|20] "V" ECM TCM
 SG_ Current : 23|16@0- (0.001,0) [-32.768|32.767] "A" ECM
 SG_ Humidity : 39|8@0+ (0.5,0) [0|127.5] "%" BCM
"#;

/// Test data representing vehicle state
struct TestSignals {
    rpm: f64,
    temperature: f64,
    throttle: f64,
    oil_pressure: f64,
    gear: f64,
    torque: f64,
    brake_pressure: f64,
    voltage: f64,
}

impl TestSignals {
    fn idle() -> Self {
        Self {
            rpm: 800.0,
            temperature: 25.0,
            throttle: 0.0,
            oil_pressure: 100.0,
            gear: 0.0,
            torque: 0.0,
            brake_pressure: 0.0,
            voltage: 12.6,
        }
    }

    fn cruising() -> Self {
        Self {
            rpm: 3000.0,
            temperature: 85.0,
            throttle: 30.0,
            oil_pressure: 350.0,
            gear: 4.0,
            torque: 150.0,
            brake_pressure: 0.0,
            voltage: 14.2,
        }
    }

    fn braking() -> Self {
        Self {
            rpm: 2000.0,
            temperature: 85.0,
            throttle: 0.0,
            oil_pressure: 250.0,
            gear: 3.0,
            torque: -50.0,
            brake_pressure: 150.0,
            voltage: 13.8,
        }
    }
}

fn generate_test_mdf4_raw(dbc: &Dbc) -> Vec<u8> {
    let mut logger = RawCanLogger::new().expect("Failed to create logger");

    let scenarios = [
        (0u64, TestSignals::idle()),
        (100_000, TestSignals::cruising()),
        (200_000, TestSignals::braking()),
    ];

    let message_configs: [(u32, u8); 4] = [
        (256, 8),  // EngineData
        (512, 8),  // TransmissionData
        (768, 6),  // BrakeData
        (1024, 6), // SensorData
    ];

    for (base_time, signals) in &scenarios {
        for (idx, &(can_id, dlc)) in message_configs.iter().enumerate() {
            let timestamp = base_time + (idx as u64 * 1000);

            let signal_values: Vec<(&str, f64)> = match can_id {
                256 => vec![
                    ("RPM", signals.rpm),
                    ("Temperature", signals.temperature),
                    ("ThrottlePosition", signals.throttle),
                    ("OilPressure", signals.oil_pressure),
                ],
                512 => vec![
                    ("GearPosition", signals.gear),
                    ("ClutchEngaged", 0.0),
                    ("Torque", signals.torque),
                    ("TransmissionTemp", signals.temperature),
                ],
                768 => vec![
                    ("BrakePressure", signals.brake_pressure),
                    ("ABSActive", 0.0),
                    ("WheelSpeedFL", 0.0),
                    ("WheelSpeedFR", 0.0),
                ],
                1024 => vec![
                    ("Voltage", signals.voltage),
                    ("Current", 0.0),
                    ("Humidity", 50.0),
                ],
                _ => vec![],
            };

            if let Ok(payload) = dbc.encode(can_id, &signal_values, false) {
                let data = &payload.as_slice()[..dlc as usize];
                logger.log(can_id, timestamp, data);
            }
        }
    }

    logger.finalize().expect("Failed to finalize MDF4")
}

fn generate_test_mdf4_decoded(dbc: &Dbc) -> Vec<u8> {
    let mut logger = CanDbcLogger::builder(dbc.clone())
        .store_raw_values(false)
        .include_units(true)
        .build()
        .expect("Failed to create logger");

    let scenarios = [
        (0u64, TestSignals::idle()),
        (100_000, TestSignals::cruising()),
        (200_000, TestSignals::braking()),
    ];

    let message_configs: [(u32, u8); 4] = [
        (256, 8),  // EngineData
        (512, 8),  // TransmissionData
        (768, 6),  // BrakeData
        (1024, 6), // SensorData
    ];

    for (base_time, signals) in &scenarios {
        for (idx, &(can_id, dlc)) in message_configs.iter().enumerate() {
            let timestamp = base_time + (idx as u64 * 1000);

            let signal_values: Vec<(&str, f64)> = match can_id {
                256 => vec![
                    ("RPM", signals.rpm),
                    ("Temperature", signals.temperature),
                    ("ThrottlePosition", signals.throttle),
                    ("OilPressure", signals.oil_pressure),
                ],
                512 => vec![
                    ("GearPosition", signals.gear),
                    ("ClutchEngaged", 0.0),
                    ("Torque", signals.torque),
                    ("TransmissionTemp", signals.temperature),
                ],
                768 => vec![
                    ("BrakePressure", signals.brake_pressure),
                    ("ABSActive", 0.0),
                    ("WheelSpeedFL", 0.0),
                    ("WheelSpeedFR", 0.0),
                ],
                1024 => vec![
                    ("Voltage", signals.voltage),
                    ("Current", 0.0),
                    ("Humidity", 50.0),
                ],
                _ => vec![],
            };

            if let Ok(payload) = dbc.encode(can_id, &signal_values, false) {
                let data = &payload.as_slice()[..dlc as usize];
                logger.log(can_id, timestamp, data);
            }
        }
    }

    logger.finalize().expect("Failed to finalize MDF4")
}

#[test]
fn test_load_raw_mdf4_and_decode() {
    println!("\n{}", "=".repeat(80));
    println!("Integration Test: Load Raw MDF4 and Decode with DBC");
    println!("{}\n", "=".repeat(80));

    // Parse DBC
    let dbc = Dbc::parse(COMPLETE_DBC).expect("Failed to parse DBC");

    // Generate test MDF4 file
    let mdf_bytes = generate_test_mdf4_raw(&dbc);
    let temp_path = std::env::temp_dir().join("pelorus_inspector_raw_test.mf4");
    std::fs::write(&temp_path, &mdf_bytes).expect("Failed to write MDF4");
    println!("Generated raw MDF4: {} bytes", mdf_bytes.len());

    // Load MDF4 file (similar to pelorus-inspector's load_mdf4)
    let mdf = MDF::from_file(temp_path.to_str().unwrap()).expect("Failed to load MDF4");

    let mut total_frames = 0;
    let mut decoded_signals = Vec::new();

    for cg in mdf.channel_groups() {
        let channels = cg.channels();

        // ASAM MDF4 Bus Logging format: Timestamp (Float64) + CAN_DataFrame (ByteArray)
        let mut timestamp_vals: Vec<f64> = Vec::new();
        let mut dataframe_vals: Vec<Vec<u8>> = Vec::new();

        for channel in channels.iter() {
            let name = channel.name().ok().flatten().unwrap_or_default();
            let vals = channel.values().unwrap_or_default();

            match name.as_str() {
                "Timestamp" => {
                    for v in vals.iter().flatten() {
                        if let mdf4_rs::DecodedValue::Float(ts) = v {
                            timestamp_vals.push(*ts);
                        }
                    }
                }
                "CAN_DataFrame" => {
                    for v in vals.iter().flatten() {
                        if let mdf4_rs::DecodedValue::ByteArray(bytes) = v {
                            dataframe_vals.push(bytes.clone());
                        }
                    }
                }
                _ => {}
            }
        }

        // Parse ASAM CAN_DataFrame format and decode frames
        // Format: ID(4 bytes LE) + DLC(1 byte) + Data(8 bytes)
        let num_frames = timestamp_vals.len().min(dataframe_vals.len());
        for i in 0..num_frames {
            let timestamp = timestamp_vals[i];
            let frame_bytes = &dataframe_vals[i];

            if frame_bytes.len() < 5 {
                continue;
            }

            // Parse CAN ID (little-endian, bit 31 = extended flag)
            let raw_id = u32::from_le_bytes([
                frame_bytes[0],
                frame_bytes[1],
                frame_bytes[2],
                frame_bytes[3],
            ]);
            let is_extended = (raw_id & 0x8000_0000) != 0;
            let can_id = raw_id & 0x1FFF_FFFF;

            // Parse DLC and data
            let dlc = frame_bytes[4] as usize;
            let data_start = 5;
            let data_end = (data_start + dlc).min(frame_bytes.len());
            let mut data = [0u8; 8];
            let actual_len = (data_end - data_start).min(8);
            data[..actual_len].copy_from_slice(&frame_bytes[data_start..data_start + actual_len]);

            // Decode using DBC
            if let Ok(signals) = dbc.decode(can_id, &data, is_extended) {
                for sig in signals.iter() {
                    decoded_signals.push((timestamp, can_id, sig.name.to_string(), sig.value));
                }
            }

            total_frames += 1;
        }
    }

    println!("Loaded {} CAN frames", total_frames);
    println!("Decoded {} signals", decoded_signals.len());

    // Verify we got the expected data
    assert_eq!(
        total_frames, 12,
        "Expected 12 frames (4 messages x 3 scenarios)"
    );

    // Find RPM signals and verify values
    let rpm_values: Vec<f64> = decoded_signals
        .iter()
        .filter(|(_, _, name, _)| name == "RPM")
        .map(|(_, _, _, value)| *value)
        .collect();

    println!("RPM values: {:?}", rpm_values);
    assert_eq!(rpm_values.len(), 3, "Expected 3 RPM values");
    assert!(
        (rpm_values[0] - 800.0).abs() < 1.0,
        "First RPM should be ~800"
    );
    assert!(
        (rpm_values[1] - 3000.0).abs() < 1.0,
        "Second RPM should be ~3000"
    );
    assert!(
        (rpm_values[2] - 2000.0).abs() < 1.0,
        "Third RPM should be ~2000"
    );

    // Cleanup
    std::fs::remove_file(&temp_path).ok();
    println!("\nRaw MDF4 loading test PASSED!\n");
}

#[test]
fn test_load_decoded_mdf4() {
    println!("\n{}", "=".repeat(80));
    println!("Integration Test: Load Pre-Decoded MDF4");
    println!("{}\n", "=".repeat(80));

    // Parse DBC
    let dbc = Dbc::parse(COMPLETE_DBC).expect("Failed to parse DBC");

    // Generate test MDF4 file with decoded signals
    let mdf_bytes = generate_test_mdf4_decoded(&dbc);
    let temp_path = std::env::temp_dir().join("pelorus_inspector_decoded_test.mf4");
    std::fs::write(&temp_path, &mdf_bytes).expect("Failed to write MDF4");
    println!("Generated decoded MDF4: {} bytes", mdf_bytes.len());

    // Load MDF4 file
    let mdf = MDF::from_file(temp_path.to_str().unwrap()).expect("Failed to load MDF4");

    let groups = mdf.channel_groups();
    println!("Found {} channel groups", groups.len());

    // Verify expected message groups
    let expected_messages = ["EngineData", "TransmissionData", "BrakeData", "SensorData"];
    for expected in &expected_messages {
        let found = groups.iter().any(|g| {
            g.name()
                .ok()
                .flatten()
                .map(|n| n == *expected)
                .unwrap_or(false)
        });
        assert!(found, "Missing message group: {}", expected);
    }

    // Find EngineData group and verify RPM values
    for group in groups.iter() {
        let name = group.name().ok().flatten().unwrap_or_default();
        if name == "EngineData" {
            println!("\nVerifying EngineData group:");

            for channel in group.channels().iter() {
                let ch_name = channel.name().ok().flatten().unwrap_or_default();
                let values = channel.values().unwrap_or_default();

                if ch_name == "RPM" {
                    let rpm_values: Vec<f64> = values
                        .iter()
                        .filter_map(|v| v.as_ref())
                        .filter_map(|v| v.as_f64())
                        .collect();

                    println!("  RPM values: {:?}", rpm_values);
                    assert_eq!(rpm_values.len(), 3, "Expected 3 RPM values");
                    assert!(
                        (rpm_values[0] - 800.0).abs() < 1.0,
                        "First RPM should be ~800"
                    );
                    assert!(
                        (rpm_values[1] - 3000.0).abs() < 1.0,
                        "Second RPM should be ~3000"
                    );
                }
            }
        }
    }

    // Cleanup
    std::fs::remove_file(&temp_path).ok();
    println!("\nDecoded MDF4 loading test PASSED!\n");
}

#[test]
fn test_signal_decoding_accuracy() {
    println!("\n{}", "=".repeat(80));
    println!("Integration Test: Signal Decoding Accuracy");
    println!("{}\n", "=".repeat(80));

    let dbc = Dbc::parse(COMPLETE_DBC).expect("Failed to parse DBC");

    // Test specific signal encoding/decoding round-trip
    let test_cases = [
        (256u32, "RPM", 3456.0, 1.0),
        (256, "Temperature", 85.0, 1.0),
        (256, "OilPressure", 425.5, 0.1),
        (512, "Torque", -125.5, 0.2),
        (768, "BrakePressure", 75.5, 0.2),
        (1024, "Voltage", 14.25, 0.02),
    ];

    for (can_id, signal_name, expected_value, tolerance) in test_cases {
        // Create a frame with just this signal
        let signals: Vec<(&str, f64)> = match can_id {
            256 => vec![
                (
                    "RPM",
                    if signal_name == "RPM" {
                        expected_value
                    } else {
                        0.0
                    },
                ),
                (
                    "Temperature",
                    if signal_name == "Temperature" {
                        expected_value
                    } else {
                        0.0
                    },
                ),
                ("ThrottlePosition", 0.0),
                (
                    "OilPressure",
                    if signal_name == "OilPressure" {
                        expected_value
                    } else {
                        0.0
                    },
                ),
            ],
            512 => vec![
                ("GearPosition", 0.0),
                ("ClutchEngaged", 0.0),
                (
                    "Torque",
                    if signal_name == "Torque" {
                        expected_value
                    } else {
                        0.0
                    },
                ),
                ("TransmissionTemp", 0.0),
            ],
            768 => vec![
                (
                    "BrakePressure",
                    if signal_name == "BrakePressure" {
                        expected_value
                    } else {
                        0.0
                    },
                ),
                ("ABSActive", 0.0),
                ("WheelSpeedFL", 0.0),
                ("WheelSpeedFR", 0.0),
            ],
            1024 => vec![
                (
                    "Voltage",
                    if signal_name == "Voltage" {
                        expected_value
                    } else {
                        0.0
                    },
                ),
                ("Current", 0.0),
                ("Humidity", 0.0),
            ],
            _ => vec![],
        };

        let payload = dbc.encode(can_id, &signals, false).expect("Encode failed");
        let decoded = dbc
            .decode(can_id, payload.as_slice(), false)
            .expect("Decode failed");

        let decoded_value = decoded
            .iter()
            .find(|s| s.name == signal_name)
            .map(|s| s.value)
            .unwrap_or_else(|| panic!("Signal {signal_name} not found"));

        let error = (decoded_value - expected_value).abs();
        println!(
            "  {}: expected={:.2}, decoded={:.2}, error={:.4}",
            signal_name, expected_value, decoded_value, error
        );

        assert!(
            error <= tolerance,
            "Signal {} error {:.4} exceeds tolerance {:.4}",
            signal_name,
            error,
            tolerance
        );
    }

    println!("\nSignal decoding accuracy test PASSED!\n");
}

/// Test case demonstrating DLC mismatch between DBC definition and actual frame data.
///
/// This test shows what happens when:
/// - DBC defines a message with DLC=8
/// - Actual frame data has only 6 bytes
///
/// The decoder will reject frames where payload length < declared DLC.
#[test]
fn test_dlc_mismatch_newmessage() {
    println!("\n{}", "=".repeat(80));
    println!("Test Case: DLC Mismatch (NewMessage)");
    println!("{}\n", "=".repeat(80));

    // =========================================================================
    // INPUT: DBC with NewMessage defined as 8 bytes
    // =========================================================================
    let dbc_with_dlc8 = r#"VERSION ""

NS_ :

BS_:

BU_:

BO_ 1024 NewMessage: 8 Vector__XXX
 SG_ Temp : 0|8@1+ (1,0) [0|255] "" Vector__XXX
 SG_ Pressure : 8|8@1+ (1,0) [0|255] "" Vector__XXX
 SG_ Heel : 16|8@1+ (1,0) [0|255] "" Vector__XXX
 SG_ Rest : 24|40@1+ (1,0) [0|255] "" Vector__XXX
"#;

    // =========================================================================
    // INPUT: Frame data with only 6 bytes (as found in sample.mf4)
    // =========================================================================
    let frame_data_6bytes: [u8; 6] = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
    //                                 Temp  Press Heel  Rest[0] Rest[1] Rest[2]

    println!("DBC Definition:");
    println!("  Message: NewMessage (ID: 1024 / 0x400)");
    println!("  Declared DLC: 8 bytes");
    println!("  Signals:");
    println!("    - Temp:     bits 0-7   (1 byte)  factor=1, offset=0");
    println!("    - Pressure: bits 8-15  (1 byte)  factor=1, offset=0");
    println!("    - Heel:     bits 16-23 (1 byte)  factor=1, offset=0");
    println!("    - Rest:     bits 24-63 (5 bytes) factor=1, offset=0");
    println!();
    println!("Frame Data (from MF4 file):");
    println!("  Actual length: {} bytes", frame_data_6bytes.len());
    println!("  Bytes: {:02X?}", frame_data_6bytes);
    println!();

    // =========================================================================
    // EXPECTED: Decode should FAIL due to DLC mismatch
    // =========================================================================
    let dbc = Dbc::parse(dbc_with_dlc8).expect("Failed to parse DBC");
    let result = dbc.decode(1024, &frame_data_6bytes, false);

    println!("EXPECTED: Decode should fail (payload 6 bytes < DLC 8 bytes)");
    println!("ACTUAL:   {:?}", result);
    assert!(
        result.is_err(),
        "Decode should fail when payload < declared DLC"
    );
    println!("✓ Correctly rejected frame with insufficient data\n");

    // =========================================================================
    // FIX: DBC with corrected DLC=6 and adjusted Rest signal
    // =========================================================================
    let dbc_with_dlc6 = r#"VERSION ""

NS_ :

BS_:

BU_:

BO_ 1024 NewMessage: 6 Vector__XXX
 SG_ Temp : 0|8@1+ (1,0) [0|255] "" Vector__XXX
 SG_ Pressure : 8|8@1+ (1,0) [0|255] "" Vector__XXX
 SG_ Heel : 16|8@1+ (1,0) [0|255] "" Vector__XXX
 SG_ Rest : 24|24@1+ (1,0) [0|16777215] "" Vector__XXX
"#;

    println!("FIXED DBC Definition:");
    println!("  Message: NewMessage (ID: 1024 / 0x400)");
    println!("  Declared DLC: 6 bytes (matches actual frame data)");
    println!("  Signals:");
    println!("    - Temp:     bits 0-7   (1 byte)");
    println!("    - Pressure: bits 8-15  (1 byte)");
    println!("    - Heel:     bits 16-23 (1 byte)");
    println!("    - Rest:     bits 24-47 (3 bytes) - reduced from 40 to 24 bits");
    println!();

    // =========================================================================
    // EXPECTED: Decode should now SUCCEED
    // =========================================================================
    let dbc_fixed = Dbc::parse(dbc_with_dlc6).expect("Failed to parse fixed DBC");
    let result = dbc_fixed.decode(1024, &frame_data_6bytes, false);

    println!("EXPECTED: Decode should succeed with corrected DLC");

    let decoded = result.expect("Decode should succeed with corrected DBC");

    println!("DECODED SIGNALS:");
    println!("  +----------+----------+----------+------------------+");
    println!("  | Signal   | Raw Hex  | Raw Dec  | Physical Value   |");
    println!("  +----------+----------+----------+------------------+");
    for sig in decoded.iter() {
        println!(
            "  | {:<8} | 0x{:06X} | {:>8} | {:>16.2} |",
            sig.name, sig.raw_value, sig.raw_value, sig.value
        );
    }
    println!("  +----------+----------+----------+------------------+");
    println!();

    // Verify expected values
    let find_signal = |name: &str| decoded.iter().find(|s| s.name == name);

    let temp = find_signal("Temp").expect("Temp signal not found");
    let pressure = find_signal("Pressure").expect("Pressure signal not found");
    let heel = find_signal("Heel").expect("Heel signal not found");
    let rest = find_signal("Rest").expect("Rest signal not found");

    // frame_data_6bytes = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66]
    // Little-endian signals:
    // - Temp (bits 0-7):     byte[0] = 0x11 = 17
    // - Pressure (bits 8-15): byte[1] = 0x22 = 34
    // - Heel (bits 16-23):   byte[2] = 0x33 = 51
    // - Rest (bits 24-47):   bytes[3..6] = 0x44, 0x55, 0x66 = 0x665544 = 6706500 (LE)

    assert_eq!(temp.raw_value, 0x11, "Temp raw value mismatch");
    assert_eq!(temp.value, 17.0, "Temp physical value mismatch");

    assert_eq!(pressure.raw_value, 0x22, "Pressure raw value mismatch");
    assert_eq!(pressure.value, 34.0, "Pressure physical value mismatch");

    assert_eq!(heel.raw_value, 0x33, "Heel raw value mismatch");
    assert_eq!(heel.value, 51.0, "Heel physical value mismatch");

    // Rest: 3 bytes little-endian = 0x66 << 16 | 0x55 << 8 | 0x44 = 6706500
    assert_eq!(rest.raw_value, 0x665544, "Rest raw value mismatch");
    assert_eq!(rest.value, 6706500.0, "Rest physical value mismatch");

    println!("✓ All signals decoded correctly with fixed DBC\n");
    println!("DLC mismatch test PASSED!\n");
}
