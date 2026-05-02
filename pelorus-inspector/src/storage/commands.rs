//! Storage Tauri Commands
//!
//! Exposes storage operations to the frontend via Tauri IPC.

use super::state::{ArtifactMeta, ArtifactType, StorageState};
use std::sync::Arc;
use tauri::State;

/// List all artifacts of a given type
#[tauri::command]
pub fn storage_list(
    artifact_type: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<Vec<ArtifactMeta>, String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;
    state.list(atype)
}

/// Get artifact content by name and type
#[tauri::command]
pub fn storage_get(
    name: String,
    artifact_type: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<Option<Vec<u8>>, String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;
    state.get_content(&name, atype)
}

/// Import artifact from file path
#[tauri::command]
pub fn storage_import(
    path: String,
    name: String,
    artifact_type: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<ArtifactMeta, String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;

    let content =
        std::fs::read(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))?;

    state.store(&name, atype, &content)
}

/// Store artifact from raw content
#[tauri::command]
pub fn storage_store(
    name: String,
    artifact_type: String,
    content: Vec<u8>,
    state: State<'_, Arc<StorageState>>,
) -> Result<ArtifactMeta, String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;

    state.store(&name, atype, &content)
}

/// Export artifact to file path
#[tauri::command]
pub fn storage_export(
    name: String,
    artifact_type: String,
    path: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<(), String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;

    let content = state
        .get_content(&name, atype)?
        .ok_or_else(|| format!("Artifact '{}' not found", name))?;

    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

/// Delete an artifact
#[tauri::command]
pub fn storage_delete(
    name: String,
    artifact_type: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<bool, String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;

    state.delete(&name, atype)
}

/// Rename an artifact
#[tauri::command]
pub fn storage_rename(
    old_name: String,
    new_name: String,
    artifact_type: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<ArtifactMeta, String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;

    state.rename(&old_name, &new_name, atype)
}

/// Check if an artifact name exists
#[tauri::command]
pub fn storage_exists(
    name: String,
    artifact_type: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<bool, String> {
    let atype = artifact_type
        .parse::<ArtifactType>()
        .map_err(|_| format!("Invalid artifact type: {}", artifact_type))?;

    state.exists(&name, atype)
}

/// Export entire database to a ZIP file
#[tauri::command]
pub fn storage_export_all(
    path: String,
    state: State<'_, Arc<StorageState>>,
) -> Result<usize, String> {
    state.export_all(&path)
}
