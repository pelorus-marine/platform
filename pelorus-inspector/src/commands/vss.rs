//! VSS (.vspec) catalog loading and editing commands.

use crate::agent::ops::load_vss as load_vss_inner;
use crate::dto::{VssCatalogDto, VssSnapshotDto};
use crate::state::AppState;
use crate::vss::{catalog_from_dto, catalog_to_snapshot_dto, catalog_to_yaml, parse_catalog_yaml};
use serde::Deserialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

/// Options for [`clear_vss`] (camelCase from the TypeScript `invoke` payload).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearVssPayload {
    #[serde(default)]
    pub emit_changed: Option<bool>,
}

pub fn empty_vss_template() -> &'static str {
    "Vessel:\n  type: branch\n  description: Pelorus vessel signal catalog root (edit me).\n"
}

/// Load and parse a `.vspec` YAML file into app state.
#[tauri::command]
pub async fn load_vss(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<VssSnapshotDto, String> {
    load_vss_inner(&state, &path)
}

/// Clear loaded VSS catalog and session path.
///
/// When `emit_changed` is `true` (default), emits Tauri event `vss-changed` so the UI can refresh
/// without reload (mitt bus bridges this in `pelorus-inspector.ts`).
#[tauri::command]
pub async fn clear_vss(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    payload: ClearVssPayload,
) -> Result<(), String> {
    state.clear_vss_catalog();
    *state.vss_path.lock() = None;
    if let Err(e) = state.session.lock().set_vss_path(None) {
        log::warn!("Failed to persist VSS session clear: {}", e);
    }
    if payload.emit_changed.unwrap_or(true) {
        let payload = serde_json::json!({
            "action": "cleared",
            "snapshot": null,
            "filename": null,
        });
        let _ = app.emit("vss-changed", payload);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_vss_path(state: State<'_, Arc<AppState>>) -> Result<Option<String>, String> {
    Ok(state.vss_path.lock().clone())
}

#[tauri::command]
pub async fn get_vss_snapshot(
    state: State<'_, Arc<AppState>>,
) -> Result<Option<VssSnapshotDto>, String> {
    let guard = state.vss_catalog.lock();
    Ok(guard.as_ref().map(catalog_to_snapshot_dto))
}

/// Save YAML content to disk; validates by round-trip parse.
#[tauri::command]
pub async fn save_vss_content(
    path: String,
    content: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let catalog = parse_catalog_yaml(&content)?;
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write VSS: {e}"))?;
    state.set_vss_catalog(Some(catalog));
    *state.vss_path.lock() = Some(path.clone());
    if let Err(e) = state.session.lock().set_vss_path(Some(path)) {
        log::warn!("Failed to persist VSS session path: {}", e);
    }
    Ok(())
}

/// Replace in-memory catalog from edited YAML string (validates parse).
#[tauri::command]
pub async fn update_vss_content(
    content: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let catalog = parse_catalog_yaml(&content)?;
    let (branches, leaves) = catalog.branch_and_leaf_counts();
    state.set_vss_catalog(Some(catalog));
    Ok(format!(
        "Updated VSS catalog ({branches} branches, {leaves} leaves)"
    ))
}

/// Structured catalog round-trip from the tree editor UI.
#[tauri::command]
pub async fn update_vss_catalog(
    dto: VssCatalogDto,
    state: State<'_, Arc<AppState>>,
) -> Result<VssSnapshotDto, String> {
    let catalog = catalog_from_dto(dto)?;
    let yaml = catalog_to_yaml(&catalog)?;
    parse_catalog_yaml(&yaml)?;
    state.set_vss_catalog(Some(catalog));
    let guard = state.vss_catalog.lock();
    Ok(catalog_to_snapshot_dto(guard.as_ref().unwrap()))
}

/// Pretty YAML emitted from an edited structured snapshot (preview / export).
#[tauri::command]
pub async fn serialize_vss_catalog(dto: VssCatalogDto) -> Result<String, String> {
    let catalog = catalog_from_dto(dto)?;
    catalog_to_yaml(&catalog)
}
