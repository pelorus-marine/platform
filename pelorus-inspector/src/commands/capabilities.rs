//! Shell metadata for the desktop app (`pelorus_capabilities` IPC).

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PelorusCapabilities {
    pub version: String,
    pub motto: &'static str,
    pub highlights: Vec<&'static str>,
}

#[tauri::command]
pub fn pelorus_capabilities() -> PelorusCapabilities {
    PelorusCapabilities {
        version: env!("CARGO_PKG_VERSION").to_string(),
        motto: "By sailors, for sailors.",
        highlights: vec![
            "Pelorus-aligned MDF4, DBC, and SocketCAN inspection",
            "Workflows and Rhai traffic lab tooling",
            "SQLite artifact stash for voyages and test campaigns",
        ],
    }
}
