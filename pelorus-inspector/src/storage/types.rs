//! Storage Types
//!
//! Data structures for artifact management.

use serde::{Deserialize, Serialize};

/// Artifact type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ArtifactType {
    Dbc,
    Mdf4,
    Rhai,
    Workflow,
}

impl ArtifactType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Dbc => "dbc",
            Self::Mdf4 => "mdf4",
            Self::Rhai => "rhai",
            Self::Workflow => "workflow",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "dbc" => Some(Self::Dbc),
            "mdf4" => Some(Self::Mdf4),
            "rhai" => Some(Self::Rhai),
            "workflow" => Some(Self::Workflow),
            _ => None,
        }
    }
}

/// Artifact metadata (without content)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactMeta {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub artifact_type: String,
    pub size: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Full artifact (with content)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // Part of public API, used in tests
pub struct Artifact {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub artifact_type: String,
    pub size: i64,
    pub content: Vec<u8>,
    pub created_at: String,
    pub updated_at: String,
}
