//! Generates `OUT_DIR/pelorus_dcid_reference.rs` from [`data/dcid_reference.toml`].

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let data_path = Path::new(&manifest_dir).join("data/dcid_reference.toml");
    println!("cargo:rerun-if-changed={}", data_path.display());

    let raw = fs::read_to_string(&data_path).unwrap_or_else(|e| {
        panic!("read {}: {e}", data_path.display());
    });
    let root: toml::Value = raw.parse().expect("parse dcid_reference.toml");

    let maps = root
        .get("map")
        .and_then(|v| v.as_array())
        .expect("dcid_reference.toml: expected [[map]] tables");

    let mut rows: Vec<(u32, Vec<String>)> = Vec::new();
    for entry in maps {
        let wire_s = entry
            .get("wire")
            .and_then(|v| v.as_str())
            .expect("map entry: wire (string hex or decimal)");
        let wire = parse_wire(wire_s);

        let signals = entry
            .get("signals")
            .and_then(|v| v.as_array())
            .expect("map entry: signals array");
        let mut ctors = Vec::new();
        for s in signals {
            let sig = s.as_str().expect("signals: string");
            ctors.push(dcid_ctor_from_spec(sig));
        }

        if rows.iter().any(|(w, _)| *w == wire) {
            panic!("duplicate wire {wire:#x} in dcid_reference.toml");
        }
        rows.push((wire, ctors));
    }

    rows.sort_by_key(|(w, _)| *w);

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR");
    let out_path = Path::new(&out_dir).join("pelorus_dcid_reference.rs");

    let mut out_src = String::new();
    out_src.push_str(
        "// @generated — edit data/dcid_reference.toml (do not edit by hand).\n\
         pub(super) fn lookup_pelorus_reference_dcids(wire: u32) -> &'static [Dcid] {\n\
         \tmatch wire {\n",
    );

    for (i, (wire, _)) in rows.iter().enumerate() {
        out_src.push_str(&format!(
            "\t\t{wire:#010x}u32 => &SLICE_{i},\n",
            wire = wire,
            i = i
        ));
    }
    out_src.push_str("\t\t_ => &[],\n\t}\n}\n\n");

    for (i, (_, ctors)) in rows.iter().enumerate() {
        out_src.push_str(&format!("static SLICE_{i}: [Dcid; {}] = [\n", ctors.len()));
        for c in ctors {
            out_src.push('\t');
            out_src.push_str(c);
            out_src.push_str(",\n");
        }
        out_src.push_str("];\n\n");
    }

    fs::write(&out_path, out_src).unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
}

fn parse_wire(s: &str) -> u32 {
    let s = s.trim();
    if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u32::from_str_radix(hex, 16).expect("wire hex")
    } else {
        s.parse::<u32>().expect("wire decimal")
    }
}

/// Maps TOML signal token to a `Dcid::…` expression (must parse as Rust in generated file).
fn dcid_ctor_from_spec(spec: &str) -> String {
    let spec = spec.trim();
    if let Some((name, idx)) = spec.split_once(':') {
        let idx: u8 = idx.trim().parse().unwrap_or_else(|_| {
            panic!("invalid indexed Dcid spec {spec:?} (expected Name:index)");
        });
        let name = name.trim();
        match name {
            "EngineRpm" => format!("Dcid::EngineRpm({idx})"),
            "FuelFlowRate" => format!("Dcid::FuelFlowRate({idx})"),
            "EngineCoolantTemp" => format!("Dcid::EngineCoolantTemp({idx})"),
            _ => panic!("unknown indexed Dcid variant {name:?}"),
        }
    } else {
        match spec {
            "GnssLatitude" => "Dcid::GnssLatitude".into(),
            "GnssLongitude" => "Dcid::GnssLongitude".into(),
            "GnssSpeedOverGround" => "Dcid::GnssSpeedOverGround".into(),
            "SpeedThroughWater" => "Dcid::SpeedThroughWater".into(),
            "GnssCourseOverGround" => "Dcid::GnssCourseOverGround".into(),
            "HeadingTrue" => "Dcid::HeadingTrue".into(),
            "HeadingMagnetic" => "Dcid::HeadingMagnetic".into(),
            "RateOfTurn" => "Dcid::RateOfTurn".into(),
            "Heel" => "Dcid::Heel".into(),
            "Trim" => "Dcid::Trim".into(),
            "Pitch" => "Dcid::Pitch".into(),
            "Roll" => "Dcid::Roll".into(),
            "DepthBelowKeel" => "Dcid::DepthBelowKeel".into(),
            "WaterTemperature" => "Dcid::WaterTemperature".into(),
            "WindSpeedApparent" => "Dcid::WindSpeedApparent".into(),
            "WindAngleApparent" => "Dcid::WindAngleApparent".into(),
            "PelorusWakeUpFrame" => "Dcid::PelorusWakeUpFrame".into(),
            "PelorusNetworkManagement" => "Dcid::PelorusNetworkManagement".into(),
            _ => panic!("unknown Dcid variant {spec:?}"),
        }
    }
}
