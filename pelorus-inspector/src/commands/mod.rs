//! Tauri command handlers.

mod capture;
mod capabilities;
mod dbc;
pub mod filter;
mod init;
pub mod mdf;

pub use capture::*;
pub use capabilities::*;
pub use dbc::*;
pub use filter::*;
pub use init::*;
pub use mdf::*;

/// Invoke handler for Pelorus Inspector.
#[macro_export]
macro_rules! base_commands {
    () => {
        tauri::generate_handler![
            pelorus_inspector::commands::load_dbc,
            pelorus_inspector::commands::clear_dbc,
            pelorus_inspector::commands::get_dbc_path,
            pelorus_inspector::commands::save_dbc_content,
            pelorus_inspector::commands::update_dbc_content,
            pelorus_inspector::commands::decode_single_frame,
            pelorus_inspector::commands::decode_frames,
            pelorus_inspector::commands::get_dbc_info,
            pelorus_inspector::commands::get_dbc_specification,
            pelorus_inspector::commands::load_mdf4,
            pelorus_inspector::commands::export_logs,
            pelorus_inspector::commands::list_can_interfaces,
            pelorus_inspector::commands::start_capture,
            pelorus_inspector::commands::stop_capture,
            pelorus_inspector::commands::is_capture_running,
            pelorus_inspector::commands::get_initial_files,
            pelorus_inspector::commands::filter_frames,
            pelorus_inspector::commands::calculate_frame_stats,
            pelorus_inspector::commands::get_message_counts,
            pelorus_inspector::commands::detect_dlc,
            pelorus_inspector::analysis::analyze_message_frames,
            pelorus_inspector::commands::pelorus_capabilities,
            pelorus_inspector::can_iface::can_list_interfaces,
            pelorus_inspector::can_iface::can_get_interface_info,
            pelorus_inspector::can_iface::can_create_vcan,
            pelorus_inspector::can_iface::can_configure_interface,
            pelorus_inspector::can_iface::can_interface_up,
            pelorus_inspector::can_iface::can_interface_down,
            pelorus_inspector::can_iface::can_delete_vcan,
            pelorus_inspector::can_iface::can_list_serial_ports,
            pelorus_inspector::can_iface::can_create_slcan,
            pelorus_inspector::can_iface::can_detach_slcan,
            pelorus_inspector::can_iface::can_list_gateways,
            pelorus_inspector::can_iface::can_create_gateway,
            pelorus_inspector::can_iface::can_delete_gateway,
            pelorus_inspector::can_iface::can_flush_gateways,
            pelorus_inspector::can_iface::can_create_filtered_gateway,
            pelorus_inspector::can_iface::can_list_gateways_detailed,
            pelorus_inspector::simulator::sim_get_config,
            pelorus_inspector::simulator::sim_set_config,
            pelorus_inspector::simulator::sim_set_rate,
            pelorus_inspector::simulator::sim_get_stats,
            pelorus_inspector::simulator::sim_list_interfaces,
            pelorus_inspector::simulator::sim_start,
            pelorus_inspector::simulator::sim_stop,
            pelorus_inspector::simulator::sim_get_signals,
            pelorus_inspector::simulator::sim_get_messages,
            pelorus_inspector::simulator::sim_validate_script,
            pelorus_inspector::simulator::sim_load_script,
            pelorus_inspector::simulator::sim_clear_script,
            pelorus_inspector::simulator::sim_get_script,
            pelorus_inspector::simulator::sim_get_logs,
            pelorus_inspector::simulator::sim_has_script,
            pelorus_inspector::storage::storage_list,
            pelorus_inspector::storage::storage_get,
            pelorus_inspector::storage::storage_import,
            pelorus_inspector::storage::storage_store,
            pelorus_inspector::storage::storage_export,
            pelorus_inspector::storage::storage_delete,
            pelorus_inspector::storage::storage_rename,
            pelorus_inspector::storage::storage_exists,
            pelorus_inspector::storage::storage_export_all,
            pelorus_inspector::workflow::workflow_start,
            pelorus_inspector::workflow::workflow_stop,
            pelorus_inspector::workflow::workflow_get_status,
            pelorus_inspector::workflow::workflow_validate_script,
            pelorus_inspector::workflow::workflow_would_create_cycle,
        ]
    };
}
