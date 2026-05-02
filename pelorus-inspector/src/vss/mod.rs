//! Pelorus **VSS (.vspec)** catalog — parse, emit, and correlate decoded CAN signals by leaf path.

mod dto_convert;

use serde_yaml::Value as YamlValue;
use std::collections::BTreeMap;

pub use dto_convert::{catalog_from_dto, catalog_to_dto, catalog_to_snapshot_dto};

/// Parsed VSS catalog (one or more root branches).
#[derive(Debug, Clone)]
pub struct VssCatalog {
    pub roots: Vec<VssNode>,
}

#[derive(Debug, Clone)]
pub struct VssNode {
    pub segment: String,
    pub path: String,
    pub meta: BTreeMap<String, YamlValue>,
    pub children: Vec<VssNode>,
}

#[derive(Debug, Clone)]
pub struct VssLeafSummary {
    pub path: String,
    pub node_type: Option<String>,
    pub datatype: Option<String>,
    pub unit: Option<String>,
    pub description: Option<String>,
}

/// Fast lookup from normalized DBC-style signal name → full `Vessel.*` path.
#[derive(Debug, Clone, Default)]
pub struct VssMatchIndex {
    /// Normalized alphanumeric-only lowercase key → canonical vessel path.
    map: std::collections::HashMap<String, String>,
}

/// Metadata keys reserved by VSS — other keys at the same level are child branches.
const RESERVED_KEYS: &[&str] = &[
    "type",
    "description",
    "datatype",
    "unit",
    "min",
    "max",
    "allowed",
    "default",
    "comment",
    "deprecation",
    "aggregate",
    "$include",
    "instances",
    "struct",
    "arraysize",
];

fn is_reserved_key(key: &str) -> bool {
    RESERVED_KEYS.contains(&key)
}

fn full_path(parent: &str, segment: &str) -> String {
    if parent.is_empty() {
        segment.to_string()
    } else {
        format!("{parent}.{segment}")
    }
}

/// Parse `.vspec` YAML into a catalog.
pub fn parse_catalog_yaml(yaml: &str) -> Result<VssCatalog, String> {
    let root: YamlValue = serde_yaml::from_str(yaml).map_err(|e| format!("Invalid YAML: {e}"))?;
    let mapping = root
        .as_mapping()
        .ok_or_else(|| "Root must be a YAML mapping".to_string())?;

    let mut roots = Vec::new();
    for (k, v) in mapping {
        let segment = k
            .as_str()
            .ok_or_else(|| "Catalog keys must be strings".to_string())?
            .to_string();
        let node = parse_node("", &segment, v)?;
        roots.push(node);
    }

    if roots.is_empty() {
        return Err("Catalog has no root branches".into());
    }

    Ok(VssCatalog { roots })
}

fn parse_node(parent_path: &str, segment: &str, value: &YamlValue) -> Result<VssNode, String> {
    let path = full_path(parent_path, segment);
    let mapping = value
        .as_mapping()
        .ok_or_else(|| format!("Node `{path}` must be a mapping (got scalar or sequence)"))?;

    let mut meta = BTreeMap::new();
    let mut children = Vec::new();

    for (k, v) in mapping {
        let key = k
            .as_str()
            .ok_or_else(|| format!("Non-string key under `{path}`"))?;

        if is_reserved_key(key) {
            meta.insert(key.to_string(), v.clone());
        } else {
            children.push(parse_node(&path, key, v)?);
        }
    }

    Ok(VssNode {
        segment: segment.to_string(),
        path,
        meta,
        children,
    })
}

fn node_to_mapping(node: &VssNode) -> serde_yaml::Mapping {
    let mut m = serde_yaml::Mapping::new();
    for (k, v) in &node.meta {
        m.insert(YamlValue::String(k.clone()), v.clone());
    }
    for child in &node.children {
        m.insert(
            YamlValue::String(child.segment.clone()),
            YamlValue::Mapping(node_to_mapping(child)),
        );
    }
    m
}

/// Serialize catalog to YAML text (deterministic key order via `BTreeMap`).
pub fn catalog_to_yaml(catalog: &VssCatalog) -> Result<String, String> {
    let mut root = serde_yaml::Mapping::new();
    for node in &catalog.roots {
        root.insert(
            YamlValue::String(node.segment.clone()),
            YamlValue::Mapping(node_to_mapping(node)),
        );
    }
    serde_yaml::to_string(&YamlValue::Mapping(root)).map_err(|e| e.to_string())
}

fn node_type(meta: &BTreeMap<String, YamlValue>) -> Option<String> {
    meta.get("type")
        .and_then(|v| v.as_str())
        .map(std::string::ToString::to_string)
}

fn is_catalog_leaf(meta: &BTreeMap<String, YamlValue>) -> bool {
    matches!(
        node_type(meta).as_deref(),
        Some("sensor" | "actuator" | "attribute" | "property")
    ) || meta.contains_key("datatype")
}

fn push_leaf_summaries(node: &VssNode, out: &mut Vec<VssLeafSummary>) {
    if is_catalog_leaf(&node.meta) {
        out.push(VssLeafSummary {
            path: node.path.clone(),
            node_type: node_type(&node.meta),
            datatype: meta_string(&node.meta, "datatype"),
            unit: meta_string(&node.meta, "unit"),
            description: meta_string(&node.meta, "description"),
        });
    }
    for c in &node.children {
        push_leaf_summaries(c, out);
    }
}

fn meta_string(meta: &BTreeMap<String, YamlValue>, key: &str) -> Option<String> {
    meta.get(key).map(yaml_value_display)
}

fn yaml_value_display(v: &YamlValue) -> String {
    match v {
        YamlValue::String(s) => s.clone(),
        YamlValue::Number(n) => n.to_string(),
        YamlValue::Bool(b) => b.to_string(),
        YamlValue::Null => String::new(),
        YamlValue::Sequence(seq) => format!(
            "[{}]",
            seq.iter()
                .map(yaml_value_display)
                .collect::<Vec<_>>()
                .join(", ")
        ),
        YamlValue::Mapping(_) | YamlValue::Tagged(_) => {
            serde_yaml::to_string(v).unwrap_or_else(|_| "<complex>".into())
        }
    }
}

fn count_branches(nodes: &[VssNode]) -> usize {
    let mut total = 0usize;
    for node in nodes {
        let nt = node_type(&node.meta);
        let is_branch = matches!(nt.as_deref(), Some("branch"))
            || (!node.children.is_empty() && !is_catalog_leaf(&node.meta));
        if is_branch {
            total += 1;
        }
        total += count_branches(&node.children);
    }
    total
}

/// Normalize for heuristic DBC signal name ↔ VSS leaf matching.
pub fn normalize_ident(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

impl VssMatchIndex {
    pub fn lookup<'a>(&'a self, signal_name: &str) -> Option<&'a str> {
        let key = normalize_ident(signal_name);
        self.map.get(&key).map(|s| s.as_str())
    }
}

impl VssCatalog {
    pub fn flatten_leaves(&self) -> Vec<VssLeafSummary> {
        let mut out = Vec::new();
        for r in &self.roots {
            push_leaf_summaries(r, &mut out);
        }
        out.sort_by(|a, b| a.path.cmp(&b.path));
        out
    }

    pub fn match_index(&self) -> VssMatchIndex {
        let mut idx = VssMatchIndex::default();
        for leaf in self.flatten_leaves() {
            if let Some(seg) = leaf.path.rsplit('.').next() {
                let key = normalize_ident(seg);
                if key.is_empty() {
                    continue;
                }
                idx.map.entry(key).or_insert(leaf.path.clone());
            }
        }
        idx
    }

    pub fn branch_and_leaf_counts(&self) -> (usize, usize) {
        let leaves = self.flatten_leaves().len();
        let branches = count_branches(&self.roots);
        (branches, leaves)
    }
}
