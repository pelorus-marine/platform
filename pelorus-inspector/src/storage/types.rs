//! Storage Types
//!
//! Data structures for artifact management.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// Artifact type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ArtifactType {
    Dbc,
    Mdf4,
    Rhai,
    Workflow,
}

/// Returned when parsing an [`ArtifactType`] from string fails.
#[derive(Debug, Clone, Copy)]
pub struct UnknownArtifactType;

impl fmt::Display for UnknownArtifactType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("unknown artifact type")
    }
}

impl std::error::Error for UnknownArtifactType {}

impl FromStr for ArtifactType {
    type Err = UnknownArtifactType;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "dbc" => Ok(Self::Dbc),
            "mdf4" => Ok(Self::Mdf4),
            "rhai" => Ok(Self::Rhai),
            "workflow" => Ok(Self::Workflow),
            _ => Err(UnknownArtifactType),
        }
    }
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
