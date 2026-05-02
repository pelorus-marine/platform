//! Tauri commands for CAN interface configuration
//!
//! Provides comprehensive SocketCAN configuration including:
//! - Virtual CAN (vcan) interfaces
//! - Physical CAN interfaces with bitrate/FD configuration
//! - Serial CAN (slcan) interfaces

use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;

/// CAN interface type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CanInterfaceType {
    Vcan,
    Physical,
    Slcan,
    PeakUsb,
    Unknown,
}

/// Interface status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InterfaceStatus {
    Up,
    Down,
    Error(String),
}

/// Detailed CAN interface information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanInterfaceInfo {
    pub name: String,
    pub interface_type: CanInterfaceType,
    pub status: InterfaceStatus,
    pub bitrate: Option<u32>,
    pub data_bitrate: Option<u32>,
    pub sample_point: Option<f32>,
    pub sjw: Option<u8>,
    pub is_fd_capable: bool,
    pub is_listen_only: bool,
    pub is_loopback: bool,
    pub restart_ms: Option<u32>,
    pub driver: Option<String>,
    pub state: Option<String>,
}

/// Configuration options for CAN interfaces
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanConfigOptions {
    // Timing
    pub bitrate: u32,
    pub sample_point: Option<f32>,
    pub sjw: Option<u8>,

    // CAN FD
    pub fd_enabled: bool,
    pub data_bitrate: Option<u32>,
    pub dsample_point: Option<f32>,

    // Mode flags
    pub loopback: bool,
    pub listen_only: bool,
    pub triple_sampling: bool,
    pub one_shot: bool,
    pub berr_reporting: bool,

    // Error recovery
    pub restart_ms: Option<u32>,
}

impl Default for CanConfigOptions {
    fn default() -> Self {
        Self {
            bitrate: 500000,
            sample_point: None,
            sjw: None,
            fd_enabled: false,
            data_bitrate: None,
            dsample_point: None,
            loopback: false,
            listen_only: false,
            triple_sampling: false,
            one_shot: false,
            berr_reporting: false,
            restart_ms: None,
        }
    }
}

/// Serial port information for slcan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub path: String,
    pub description: Option<String>,
}

/// List all CAN interfaces with detailed information
#[tauri::command]
pub fn can_list_interfaces() -> Result<Vec<CanInterfaceInfo>, String> {
    let mut interfaces = Vec::new();

    // Scan /sys/class/net for CAN interfaces
    let net_path = "/sys/class/net";
    let entries =
        fs::read_dir(net_path).map_err(|e| format!("Failed to read {}: {}", net_path, e))?;

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Check if it's a CAN interface (type 280 = ARPHRD_CAN)
        let type_path = format!("{}/{}/type", net_path, name);
        if let Ok(type_str) = fs::read_to_string(&type_path) {
            let type_num: u32 = type_str.trim().parse().unwrap_or(0);
            if type_num == 280 {
                if let Ok(info) = get_interface_details(&name) {
                    interfaces.push(info);
                }
            }
        }
    }

    // Sort by name
    interfaces.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(interfaces)
}

/// Get detailed info for a specific interface
#[tauri::command]
pub fn can_get_interface_info(interface: String) -> Result<CanInterfaceInfo, String> {
    get_interface_details(&interface)
}

/// Validate interface name (alphanumeric and limited length)
fn is_valid_interface_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15  // IFNAMSIZ - 1
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Create a new vcan interface
#[tauri::command]
pub fn can_create_vcan(name: String) -> Result<String, String> {
    // Validate name
    if !name.starts_with("vcan") {
        return Err("Interface name must start with 'vcan'".to_string());
    }
    if !is_valid_interface_name(&name) {
        return Err("Invalid interface name".to_string());
    }

    // Check if interface already exists
    let exists = Command::new("ip")
        .args(["link", "show", &name])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if exists {
        return Err(format!("Interface {} already exists", name));
    }

    // Single pkexec call: load module if needed, create interface, bring up
    let script = format!(
        "modprobe -q vcan 2>/dev/null; ip link add dev {} type vcan && ip link set up {}",
        name, name
    );

    let output = Command::new("pkexec")
        .args(["sh", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to create interface: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to create {}: {}", name, stderr));
    }

    Ok(format!("{} created and is up", name))
}

/// Configure a physical CAN interface
#[tauri::command]
pub fn can_configure_interface(
    interface: String,
    config: CanConfigOptions,
) -> Result<String, String> {
    if !is_valid_interface_name(&interface) {
        return Err("Invalid interface name".to_string());
    }

    // Build the configuration command arguments
    let mut config_args = format!("bitrate {}", config.bitrate);

    // Timing parameters
    if let Some(sp) = config.sample_point {
        config_args.push_str(&format!(" sample-point {:.3}", sp));
    }
    if let Some(sjw) = config.sjw {
        config_args.push_str(&format!(" sjw {}", sjw));
    }

    // CAN FD options
    if config.fd_enabled {
        config_args.push_str(" fd on");
        if let Some(dbitrate) = config.data_bitrate {
            config_args.push_str(&format!(" dbitrate {}", dbitrate));
        }
        if let Some(dsp) = config.dsample_point {
            config_args.push_str(&format!(" dsample-point {:.3}", dsp));
        }
    }

    // Mode flags
    if config.loopback {
        config_args.push_str(" loopback on");
    }
    if config.listen_only {
        config_args.push_str(" listen-only on");
    }
    if config.triple_sampling {
        config_args.push_str(" triple-sampling on");
    }
    if config.one_shot {
        config_args.push_str(" one-shot on");
    }
    if config.berr_reporting {
        config_args.push_str(" berr-reporting on");
    }

    // Error recovery
    if let Some(restart) = config.restart_ms {
        config_args.push_str(&format!(" restart-ms {}", restart));
    }

    // Single pkexec call: down, configure, up
    let script = format!(
        "ip link set {} down && ip link set {} type can {} && ip link set {} up",
        interface, interface, config_args, interface
    );

    let output = Command::new("pkexec")
        .args(["sh", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to configure interface: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to configure {}: {}", interface, stderr));
    }

    Ok(format!("{} configured successfully", interface))
}

/// Bring interface up
#[tauri::command]
pub fn can_interface_up(interface: String) -> Result<String, String> {
    if !is_valid_interface_name(&interface) {
        return Err("Invalid interface name".to_string());
    }

    let output = Command::new("pkexec")
        .args(["ip", "link", "set", "up", &interface])
        .output()
        .map_err(|e| format!("Failed to bring up interface: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to bring up {}: {}", interface, stderr));
    }

    Ok(format!("{} is up", interface))
}

/// Bring interface down
#[tauri::command]
pub fn can_interface_down(interface: String) -> Result<String, String> {
    if !is_valid_interface_name(&interface) {
        return Err("Invalid interface name".to_string());
    }

    let output = Command::new("pkexec")
        .args(["ip", "link", "set", "down", &interface])
        .output()
        .map_err(|e| format!("Failed to bring down interface: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to bring down {}: {}", interface, stderr));
    }

    Ok(format!("{} is down", interface))
}

/// Delete a vcan interface
#[tauri::command]
pub fn can_delete_vcan(interface: String) -> Result<String, String> {
    if !interface.starts_with("vcan") {
        return Err("Can only delete vcan interfaces".to_string());
    }
    if !is_valid_interface_name(&interface) {
        return Err("Invalid interface name".to_string());
    }

    let output = Command::new("pkexec")
        .args(["ip", "link", "delete", &interface])
        .output()
        .map_err(|e| format!("Failed to delete interface: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to delete {}: {}", interface, stderr));
    }

    Ok(format!("{} deleted", interface))
}

/// List available serial ports for slcan
#[tauri::command]
pub fn can_list_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    let mut ports = Vec::new();

    // Check /dev for serial ports
    if let Ok(entries) = fs::read_dir("/dev") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("ttyUSB") || name.starts_with("ttyACM") || name.starts_with("ttyS")
            {
                let path = format!("/dev/{}", name);
                ports.push(SerialPortInfo {
                    path,
                    description: None,
                });
            }
        }
    }

    ports.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(ports)
}

/// Create slcan interface from serial port
#[tauri::command]
pub fn can_create_slcan(
    serial_port: String,
    interface_name: String,
    speed: u8,
) -> Result<String, String> {
    // Validate interface name
    if !interface_name.starts_with("slcan") && !interface_name.starts_with("can") {
        return Err("Interface name should start with 'slcan' or 'can'".to_string());
    }
    if !is_valid_interface_name(&interface_name) {
        return Err("Invalid interface name".to_string());
    }
    // Validate serial port path
    if !serial_port.starts_with("/dev/tty") {
        return Err("Invalid serial port path".to_string());
    }
    if speed > 8 {
        return Err("Invalid speed code (0-8)".to_string());
    }

    // Single pkexec call: create slcan interface and bring up
    // Speed codes: 0=10k, 1=20k, 2=50k, 3=100k, 4=125k, 5=250k, 6=500k, 7=800k, 8=1M
    let script = format!(
        "slcand -o -c -s{} {} {} && ip link set up {}",
        speed, serial_port, interface_name, interface_name
    );

    let output = Command::new("pkexec")
        .args(["sh", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to create slcan: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to create slcan: {}", stderr));
    }

    Ok(format!(
        "{} created from {} and is up",
        interface_name, serial_port
    ))
}

/// Detach slcan interface
#[tauri::command]
pub fn can_detach_slcan(interface: String) -> Result<String, String> {
    if !is_valid_interface_name(&interface) {
        return Err("Invalid interface name".to_string());
    }

    // Single pkexec call: bring down and kill slcand
    let script = format!(
        "ip link set down {} 2>/dev/null; pkill -x slcand 2>/dev/null; true",
        interface
    );

    let _ = Command::new("pkexec").args(["sh", "-c", &script]).output();

    Ok(format!("{} detached", interface))
}

// ─────────────────────────────────────────────────────────────────────────────
// CAN Gateway (cangw) Commands
// ─────────────────────────────────────────────────────────────────────────────

/// A CAN gateway rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanGateway {
    /// Unique ID for this gateway (index in list)
    pub id: u32,
    /// Source interface
    pub src: String,
    /// Destination interface
    pub dst: String,
}

/// List all CAN gateway rules
#[tauri::command]
pub fn can_list_gateways() -> Result<Vec<CanGateway>, String> {
    let output = Command::new("cangw")
        .arg("-L")
        .output()
        .map_err(|e| format!("Failed to run cangw: {}", e))?;

    // cangw -L may return non-zero exit code but still output valid data
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut gateways = Vec::new();
    let mut id = 0u32;

    for line in stdout.lines() {
        // Parse lines like: cangw -A -s can0 -d vcan0 ...
        if let (Some(src_idx), Some(dst_idx)) = (line.find("-s "), line.find("-d ")) {
            let src_start = src_idx + 3;
            let src_end = line[src_start..]
                .find(' ')
                .map(|i| src_start + i)
                .unwrap_or(line.len());
            let src = line[src_start..src_end].trim().to_string();

            let dst_start = dst_idx + 3;
            let dst_end = line[dst_start..]
                .find(' ')
                .map(|i| dst_start + i)
                .unwrap_or(line.len());
            let dst = line[dst_start..dst_end].trim().to_string();

            if !src.is_empty() && !dst.is_empty() {
                gateways.push(CanGateway { id, src, dst });
                id += 1;
            }
        }
    }

    Ok(gateways)
}

/// Create a CAN gateway between two interfaces
#[tauri::command]
pub fn can_create_gateway(src: String, dst: String, bidirectional: bool) -> Result<String, String> {
    if !is_valid_interface_name(&src) || !is_valid_interface_name(&dst) {
        return Err("Invalid interface name".to_string());
    }
    if src == dst {
        return Err("Source and destination must be different".to_string());
    }

    // Build script: load can-gw module, add rule(s)
    let script = if bidirectional {
        format!(
            "modprobe -q can-gw 2>/dev/null; cangw -A -s {} -d {} && cangw -A -s {} -d {}",
            src, dst, dst, src
        )
    } else {
        format!(
            "modprobe -q can-gw 2>/dev/null; cangw -A -s {} -d {}",
            src, dst
        )
    };

    let output = Command::new("pkexec")
        .args(["sh", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to create gateway: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to create gateway: {}", stderr));
    }

    if bidirectional {
        Ok(format!("Gateway {} <-> {} created", src, dst))
    } else {
        Ok(format!("Gateway {} -> {} created", src, dst))
    }
}

/// Delete a CAN gateway rule
#[tauri::command]
pub fn can_delete_gateway(src: String, dst: String) -> Result<String, String> {
    if !is_valid_interface_name(&src) || !is_valid_interface_name(&dst) {
        return Err("Invalid interface name".to_string());
    }

    let output = Command::new("pkexec")
        .args(["cangw", "-D", "-s", &src, "-d", &dst])
        .output()
        .map_err(|e| format!("Failed to delete gateway: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to delete gateway: {}", stderr));
    }

    Ok(format!("Gateway {} -> {} deleted", src, dst))
}

/// Delete all CAN gateway rules
#[tauri::command]
pub fn can_flush_gateways() -> Result<String, String> {
    let output = Command::new("pkexec")
        .args(["cangw", "-F"])
        .output()
        .map_err(|e| format!("Failed to flush gateways: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to flush gateways: {}", stderr));
    }

    Ok("All gateways removed".to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/// Get detailed information about a CAN interface
fn get_interface_details(name: &str) -> Result<CanInterfaceInfo, String> {
    let net_path = format!("/sys/class/net/{}", name);

    // Check operstate (up/down)
    let operstate_path = format!("{}/operstate", net_path);
    let status = if let Ok(state) = fs::read_to_string(&operstate_path) {
        match state.trim() {
            "up" => InterfaceStatus::Up,
            "down" => InterfaceStatus::Down,
            "unknown" => InterfaceStatus::Up, // vcan shows "unknown" when up
            other => InterfaceStatus::Error(other.to_string()),
        }
    } else {
        InterfaceStatus::Error("Cannot read state".to_string())
    };

    // Determine interface type
    let interface_type = if name.starts_with("vcan") {
        CanInterfaceType::Vcan
    } else if name.starts_with("slcan") {
        CanInterfaceType::Slcan
    } else if name.starts_with("can") || name.starts_with("peak") {
        CanInterfaceType::Physical
    } else {
        CanInterfaceType::Unknown
    };

    // Try to get detailed info from ip link
    let mut bitrate = None;
    let mut data_bitrate = None;
    let mut sample_point = None;
    let mut sjw = None;
    let mut is_fd_capable = false;
    let mut is_listen_only = false;
    let mut is_loopback = false;
    let mut restart_ms = None;
    let mut state = None;

    if let Ok(output) = Command::new("ip")
        .args(["-details", "link", "show", name])
        .output()
    {
        if output.status.success() {
            let details = String::from_utf8_lossy(&output.stdout);

            // Parse bitrate
            if let Some(cap) = details.find("bitrate ") {
                let rest = &details[cap + 8..];
                if let Some(end) = rest.find(' ') {
                    if let Ok(br) = rest[..end].parse::<u32>() {
                        bitrate = Some(br);
                    }
                }
            }

            // Parse data bitrate (CAN FD)
            if let Some(cap) = details.find("dbitrate ") {
                let rest = &details[cap + 9..];
                if let Some(end) = rest.find(' ') {
                    if let Ok(dbr) = rest[..end].parse::<u32>() {
                        data_bitrate = Some(dbr);
                    }
                }
            }

            // Check for FD capability
            is_fd_capable = details.contains(" fd ") || details.contains("fd on");

            // Parse sample-point
            if let Some(cap) = details.find("sample-point ") {
                let rest = &details[cap + 13..];
                if let Some(end) = rest.find(' ').or_else(|| rest.find('\n')) {
                    if let Ok(sp) = rest[..end].parse::<f32>() {
                        sample_point = Some(sp);
                    }
                }
            }

            // Parse SJW
            if let Some(cap) = details.find("sjw ") {
                let rest = &details[cap + 4..];
                if let Some(end) = rest.find(' ').or_else(|| rest.find('\n')) {
                    if let Ok(s) = rest[..end].parse::<u8>() {
                        sjw = Some(s);
                    }
                }
            }

            // Check listen-only
            is_listen_only = details.contains("listen-only on");

            // Check loopback
            is_loopback = details.contains("loopback on");

            // Parse restart-ms
            if let Some(cap) = details.find("restart-ms ") {
                let rest = &details[cap + 11..];
                if let Some(end) = rest.find(' ').or_else(|| rest.find('\n')) {
                    if let Ok(r) = rest[..end].parse::<u32>() {
                        restart_ms = Some(r);
                    }
                }
            }

            // Parse CAN state (ERROR-ACTIVE, ERROR-PASSIVE, BUS-OFF)
            if let Some(cap) = details.find("state ") {
                let rest = &details[cap + 6..];
                if let Some(end) = rest.find(' ').or_else(|| rest.find('\n')) {
                    state = Some(rest[..end].to_string());
                }
            }
        }
    }

    // Get driver info
    let driver_path = format!("{}/device/driver", net_path);
    let driver = fs::read_link(&driver_path)
        .ok()
        .and_then(|p| p.file_name().map(|s| s.to_string_lossy().to_string()));

    Ok(CanInterfaceInfo {
        name: name.to_string(),
        interface_type,
        status,
        bitrate,
        data_bitrate,
        sample_point,
        sjw,
        is_fd_capable,
        is_listen_only,
        is_loopback,
        restart_ms,
        driver,
        state,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// CAN Filters
// ─────────────────────────────────────────────────────────────────────────────

/// CAN ID filter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanFilter {
    /// CAN ID to match
    pub can_id: u32,
    /// Mask for matching (0xFFFFFFFF = exact match)
    pub mask: u32,
    /// Whether this is an extended ID
    pub is_extended: bool,
}

/// Filter mode for gateway rules
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FilterMode {
    /// Pass matching frames
    Pass,
    /// Block matching frames (inverse)
    Block,
}

/// A gateway rule with filters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanGatewayWithFilter {
    /// Source interface
    pub src: String,
    /// Destination interface
    pub dst: String,
    /// Filters to apply
    pub filters: Vec<CanFilter>,
    /// Filter mode
    pub mode: FilterMode,
}

/// Create a filtered gateway between two interfaces
///
/// Uses cangw with -f filter option:
/// cangw -A -s can0 -d vcan0 -f 0x123:0xFFF
#[tauri::command]
pub fn can_create_filtered_gateway(
    src: String,
    dst: String,
    filters: Vec<CanFilter>,
    mode: FilterMode,
) -> Result<String, String> {
    if !is_valid_interface_name(&src) || !is_valid_interface_name(&dst) {
        return Err("Invalid interface name".to_string());
    }
    if src == dst {
        return Err("Source and destination must be different".to_string());
    }
    if filters.is_empty() {
        return Err("At least one filter is required".to_string());
    }

    // Build filter arguments for cangw
    // Format: -f can_id:can_mask (can be repeated)
    let mut filter_args = Vec::new();
    for f in &filters {
        // For extended IDs, set the extended flag bit (0x80000000)
        let id = if f.is_extended {
            f.can_id | 0x80000000
        } else {
            f.can_id
        };
        let mask = if f.is_extended {
            f.mask | 0x80000000
        } else {
            f.mask
        };
        filter_args.push("-f".to_string());
        filter_args.push(format!("0x{:X}:0x{:X}", id, mask));
    }

    let filter_str = filter_args.join(" ");

    // For block mode, we'd need to use XOR modification or a different approach
    // cangw doesn't have a native "block" mode - it only forwards matching frames
    // For now, we only support "pass" mode (forward matching frames)
    if mode == FilterMode::Block {
        return Err("Block mode not supported for gateway filters. Use pass mode to forward only matching frames.".to_string());
    }

    let script = format!(
        "modprobe -q can-gw 2>/dev/null; cangw -A -s {} -d {} {}",
        src, dst, filter_str
    );

    let output = Command::new("pkexec")
        .args(["sh", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to create filtered gateway: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Authentication cancelled".to_string());
        }
        return Err(format!("Failed to create filtered gateway: {}", stderr));
    }

    let filter_desc = filters
        .iter()
        .map(|f| format!("0x{:X}", f.can_id))
        .collect::<Vec<_>>()
        .join(", ");

    Ok(format!(
        "Filtered gateway {} -> {} created (IDs: {})",
        src, dst, filter_desc
    ))
}

/// Parse detailed gateway info including filters from cangw -L output
#[tauri::command]
pub fn can_list_gateways_detailed() -> Result<Vec<CanGatewayWithFilter>, String> {
    let output = Command::new("cangw")
        .arg("-L")
        .output()
        .map_err(|e| format!("Failed to run cangw: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut gateways = Vec::new();

    for line in stdout.lines() {
        // Parse lines like: cangw -A -s can0 -d vcan0 -f 0x123:0xFFF
        if let (Some(src_idx), Some(dst_idx)) = (line.find("-s "), line.find("-d ")) {
            let src_start = src_idx + 3;
            let src_end = line[src_start..]
                .find(' ')
                .map(|i| src_start + i)
                .unwrap_or(line.len());
            let src = line[src_start..src_end].trim().to_string();

            let dst_start = dst_idx + 3;
            let dst_end = line[dst_start..]
                .find(' ')
                .map(|i| dst_start + i)
                .unwrap_or(line.len());
            let dst = line[dst_start..dst_end].trim().to_string();

            if src.is_empty() || dst.is_empty() {
                continue;
            }

            // Parse filters: -f 0xID:0xMASK
            let mut filters = Vec::new();
            let mut search_start = 0;
            while let Some(f_idx) = line[search_start..].find("-f ") {
                let abs_idx = search_start + f_idx + 3;
                let filter_end = line[abs_idx..]
                    .find(' ')
                    .map(|i| abs_idx + i)
                    .unwrap_or(line.len());
                let filter_str = &line[abs_idx..filter_end];

                if let Some(colon_idx) = filter_str.find(':') {
                    let id_str = &filter_str[..colon_idx];
                    let mask_str = &filter_str[colon_idx + 1..];

                    let id = parse_hex(id_str).unwrap_or(0);
                    let mask = parse_hex(mask_str).unwrap_or(0xFFFFFFFF);

                    // Check extended flag
                    let is_extended = (id & 0x80000000) != 0;
                    let can_id = id & 0x1FFFFFFF;
                    let can_mask = mask & 0x1FFFFFFF;

                    filters.push(CanFilter {
                        can_id,
                        mask: can_mask,
                        is_extended,
                    });
                }
                search_start = filter_end;
            }

            gateways.push(CanGatewayWithFilter {
                src,
                dst,
                filters,
                mode: FilterMode::Pass,
            });
        }
    }

    Ok(gateways)
}

/// Parse hex string (with or without 0x prefix)
fn parse_hex(s: &str) -> Option<u32> {
    let s = s.trim().trim_start_matches("0x").trim_start_matches("0X");
    u32::from_str_radix(s, 16).ok()
}
