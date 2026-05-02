//! Convert between frontend JSON DTOs and internal [`YamlValue`] metadata.

use crate::dto::{VssCatalogDto, VssLeafDto, VssNodeDto, VssSnapshotDto};
use crate::vss::{VssCatalog, VssNode};
use serde_yaml::Value as YamlValue;
use std::collections::BTreeMap;

pub fn catalog_to_dto(catalog: &VssCatalog) -> VssCatalogDto {
    VssCatalogDto {
        roots: catalog.roots.iter().map(node_to_dto).collect(),
    }
}

/// Full snapshot for UI / automation (roots, flat leaves, counts).
pub fn catalog_to_snapshot_dto(catalog: &VssCatalog) -> VssSnapshotDto {
    let (branch_count, leaf_count) = catalog.branch_and_leaf_counts();
    let dto = catalog_to_dto(catalog);
    let leaves: Vec<VssLeafDto> = catalog
        .flatten_leaves()
        .into_iter()
        .map(|l| VssLeafDto {
            path: l.path,
            node_type: l.node_type,
            datatype: l.datatype,
            unit: l.unit,
            description: l.description,
        })
        .collect();
    VssSnapshotDto {
        roots: dto.roots,
        leaves,
        branch_count,
        leaf_count,
    }
}

pub fn catalog_from_dto(dto: VssCatalogDto) -> Result<VssCatalog, String> {
    let mut roots = Vec::new();
    for r in dto.roots {
        roots.push(dto_to_node(r)?);
    }
    if roots.is_empty() {
        return Err("Catalog must have at least one root branch".into());
    }
    Ok(VssCatalog { roots })
}

fn node_to_dto(node: &VssNode) -> VssNodeDto {
    VssNodeDto {
        segment: node.segment.clone(),
        path: node.path.clone(),
        meta: node
            .meta
            .iter()
            .map(|(k, v)| {
                let j = yaml_to_json(v).unwrap_or_else(|_| {
                    serde_json::Value::String(format!("<unsupported meta for key {k}>"))
                });
                (k.clone(), j)
            })
            .collect(),
        children: node.children.iter().map(node_to_dto).collect(),
    }
}

fn dto_to_node(dto: VssNodeDto) -> Result<VssNode, String> {
    let mut meta = BTreeMap::new();
    for (k, v) in dto.meta {
        meta.insert(k, json_to_yaml(&v)?);
    }
    let mut children = Vec::new();
    for c in dto.children {
        children.push(dto_to_node(c)?);
    }
    Ok(VssNode {
        segment: dto.segment,
        path: dto.path,
        meta,
        children,
    })
}

fn yaml_to_json(v: &YamlValue) -> Result<serde_json::Value, String> {
    Ok(match v {
        YamlValue::Null => serde_json::Value::Null,
        YamlValue::Bool(b) => serde_json::Value::Bool(*b),
        YamlValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_json::Value::Number(i.into())
            } else if let Some(u) = n.as_u64() {
                serde_json::Value::Number(u.into())
            } else if let Some(f) = n.as_f64() {
                serde_json::Number::from_f64(f)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            } else {
                serde_json::Value::Null
            }
        }
        YamlValue::String(s) => serde_json::Value::String(s.clone()),
        YamlValue::Sequence(seq) => {
            let mut arr = Vec::with_capacity(seq.len());
            for item in seq {
                arr.push(yaml_to_json(item)?);
            }
            serde_json::Value::Array(arr)
        }
        YamlValue::Mapping(m) => {
            let mut obj = serde_json::Map::new();
            for (k, val) in m {
                let key = k
                    .as_str()
                    .ok_or_else(|| "Mapping keys must be strings for JSON export".to_string())?
                    .to_string();
                obj.insert(key, yaml_to_json(val)?);
            }
            serde_json::Value::Object(obj)
        }
        YamlValue::Tagged(t) => yaml_to_json(&t.value)?,
    })
}

fn json_to_yaml(v: &serde_json::Value) -> Result<YamlValue, String> {
    Ok(match v {
        serde_json::Value::Null => YamlValue::Null,
        serde_json::Value::Bool(b) => YamlValue::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                YamlValue::Number(i.into())
            } else if let Some(u) = n.as_u64() {
                YamlValue::Number(u.into())
            } else if let Some(f) = n.as_f64() {
                YamlValue::Number(serde_yaml::Number::from(f))
            } else {
                YamlValue::Null
            }
        }
        serde_json::Value::String(s) => YamlValue::String(s.clone()),
        serde_json::Value::Array(a) => {
            YamlValue::Sequence(a.iter().map(json_to_yaml).collect::<Result<Vec<_>, _>>()?)
        }
        serde_json::Value::Object(o) => {
            let mut m = serde_yaml::Mapping::new();
            for (k, val) in o {
                m.insert(YamlValue::String(k.clone()), json_to_yaml(val)?);
            }
            YamlValue::Mapping(m)
        }
    })
}
