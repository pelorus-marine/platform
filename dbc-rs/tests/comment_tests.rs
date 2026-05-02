//! Tests for multiline CM_ comment string parsing.
//!
//! Uses tests/data/multiline_comments.dbc as the fixture.

#![cfg(feature = "std")]

use dbc_rs::Dbc;
use std::fs::read_to_string;

fn load() -> Dbc {
    let content = read_to_string("tests/data/multiline_comments.dbc")
        .expect("Failed to read multiline_comments.dbc");
    Dbc::parse(&content).expect("Failed to parse multiline_comments.dbc")
}

#[test]
fn test_file_parses_successfully() {
    load();
}

#[test]
fn test_message_and_signal_counts() {
    let dbc = load();
    assert_eq!(dbc.messages().len(), 2);
    assert_eq!(
        dbc.messages().find("BatteryData").unwrap().signals().len(),
        4
    );
    assert_eq!(
        dbc.messages().find("StatusData").unwrap().signals().len(),
        3
    );
}

#[test]
fn test_db_comment_multiline() {
    // Database-level comment spanning multiple lines
    let dbc = load();
    let c = dbc.comment().expect("db comment should exist");
    assert!(c.contains("General database comment"));
    assert!(c.contains("spanning two lines"));
    assert!(c.contains('\n'));
}

#[test]
fn test_message_comment_multiline() {
    // Message comment with three lines
    let dbc = load();
    let msg = dbc.messages().find("BatteryData").unwrap();
    let c = msg.comment().expect("BatteryData comment should exist");
    assert!(c.contains("Battery data message"));
    assert!(c.contains("multiline description"));
    assert!(c.contains("third line"));
}

#[test]
fn test_message_comment_only_newline() {
    // Message comment that is just a newline character - CM_ BO_ "\n";
    let dbc = load();
    let msg = dbc.messages().find("StatusData").unwrap();
    assert_eq!(
        msg.comment().expect("StatusData comment should exist"),
        "\n"
    );
}

#[test]
fn test_signal_comment_single_line() {
    // Normal single-line signal comment should still work after the fix
    let dbc = load();
    let msg = dbc.messages().find("BatteryData").unwrap();
    assert_eq!(
        msg.signals().find("SOH_Fixed").unwrap().comment(),
        Some("Portable battery - SOH")
    );
}

#[test]
fn test_signal_comment_trailing_newline() {
    // Signal comment with a trailing newline inside the quotes
    let dbc = load();
    let msg = dbc.messages().find("BatteryData").unwrap();
    let c = msg.signals().find("SOH_Port").unwrap().comment().unwrap();
    assert!(c.starts_with("Fixed battery - SOH"));
    assert!(c.ends_with('\n'));
}

#[test]
fn test_signal_comment_trailing_newline_fet1() {
    // Signal comment with trailing newline - real-world pattern from automotive DBCs
    let dbc = load();
    let msg = dbc.messages().find("BatteryData").unwrap();
    let c = msg.signals().find("FETTemp1").unwrap().comment().unwrap();
    assert!(c.contains("Average temperature"));
    assert!(c.ends_with('\n'));
}

#[test]
fn test_signal_comment_trailing_newline_fet2() {
    // Same pattern on a second signal in the same message
    let dbc = load();
    let msg = dbc.messages().find("BatteryData").unwrap();
    let c = msg.signals().find("FETTemp2").unwrap().comment().unwrap();
    assert!(c.contains("Average temperature"));
    assert!(c.ends_with('\n'));
}

#[test]
fn test_signal_comment_multiline_mid() {
    // Signal comment with a newline in the middle of the string
    let dbc = load();
    let msg = dbc.messages().find("StatusData").unwrap();
    let c = msg.signals().find("ShutdownFixed").unwrap().comment().unwrap();
    assert!(c.contains("shutdown status"));
    assert!(c.contains("along with time"));
    assert!(c.contains('\n'));
}

#[test]
fn test_signal_comment_single_line_after_multiline() {
    // Parser should correctly resume after multiline comments and parse subsequent entries
    let dbc = load();
    let msg = dbc.messages().find("StatusData").unwrap();
    assert_eq!(
        msg.signals().find("ShutdownPort").unwrap().comment(),
        Some("Fixed battery shutdown status")
    );
    assert_eq!(
        msg.signals().find("NormalSig").unwrap().comment(),
        Some("This is a normal single-line comment")
    );
}

#[test]
fn test_error_line_accurate_after_multiline_comment() {
    // Line numbers must remain accurate after the parser processes multiline comments
    let content =
        read_to_string("tests/data/multiline_comments.dbc").expect("Failed to read fixture");
    let broken = format!("{}\nINVALID_KEYWORD\n", content);
    let err = Dbc::parse(&broken).unwrap_err();
    assert!(err.line().expect("error should carry a line number") > 1);
}
