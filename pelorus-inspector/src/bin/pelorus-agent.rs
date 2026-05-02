#![forbid(unsafe_code)]

//! **`pelorus-agent`** — headless CLI for MDF4 extraction, DBC decode, VSS snapshots, and JSON automation.
//! Shares implementation with Pelorus Inspector (`pelorus_inspector::agent::ops`, [`pelorus_inspector::commands`] modules).

use clap::{Parser, Subcommand};
use dbc_rs::Dbc;
use pelorus_inspector::agent::ops::{
    decode_frames, export_can_frames_to_mdf4_path, load_dbc, load_mdf4, load_vss,
};
use pelorus_inspector::commands::{
    FilterConfig, MatchStatus, build_dbc_info, build_message_cache, filter_frames_with_cache,
};
use pelorus_inspector::dto::CanFrameDto;
use pelorus_inspector::state::{AppState, InitialFiles};
use pelorus_inspector::vss::{catalog_to_snapshot_dto, parse_catalog_yaml};
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Parser, Debug)]
#[command(
    name = "pelorus-agent",
    version,
    about = "Pelorus automation CLI — MDF4, DBC decode, VSS (same Rust core as Pelorus Inspector)."
)]
struct Cli {
    /// Load this DBC before running the subcommand (decode, mdf, filter, …).
    #[arg(short = 'd', long, global = true)]
    dbc: Option<PathBuf>,
    /// Load this VSS (.vspec) catalog before running the subcommand.
    #[arg(long, global = true)]
    vss: Option<PathBuf>,
    #[command(subcommand)]
    cmd: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Decode CAN frames to signals (`DecodeResponse` JSON). Frames: JSON array or newline-delimited JSON (stdin or `--frames`).
    Decode {
        #[arg(short = 'f', long)]
        frames: Option<PathBuf>,
    },
    /// Extract CAN frames and decoded signals from MDF4 bus logging (needs `--dbc` for decode).
    Mdf {
        path: PathBuf,
        #[arg(long)]
        include_frames: bool,
    },
    /// Print Inspector-compatible `DbcInfo` JSON parsed from a `.dbc` file (no `--dbc` required).
    DbcInfo { path: PathBuf },
    /// Print `VssSnapshotDto` JSON from a `.vspec` / YAML file (does not touch Inspector session files beyond defaults).
    VssSnapshot { path: PathBuf },
    /// Load MDF4, apply `FilterConfig` JSON, emit `FilterResult` JSON (`--dbc` recommended for message/signal filters).
    Filter {
        #[arg(long)]
        mdf: PathBuf,
        #[arg(long)]
        config: PathBuf,
    },
    /// Write MDF4 bus logging from a JSON array of `CanFrameDto`.
    ExportMdf {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
}

#[derive(Serialize)]
struct MdfAgentOut<'a> {
    frame_count: usize,
    decoded_signal_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    frames: Option<&'a [CanFrameDto]>,
    decoded_signals: &'a [pelorus_inspector::dto::DecodedSignalDto],
}

fn main() -> Result<(), String> {
    let cli = Cli::parse();
    let dbc_flag = cli.dbc.clone();
    let vss_flag = cli.vss.clone();

    match cli.cmd {
        Command::DbcInfo { path } => {
            let content = std::fs::read_to_string(&path).map_err(|e| format!("read DBC: {e}"))?;
            let dbc = Dbc::parse(&content).map_err(|e| format!("parse DBC: {e:?}"))?;
            print_json(&build_dbc_info(&dbc))?;
        }
        Command::VssSnapshot { path } => {
            let content = std::fs::read_to_string(&path).map_err(|e| format!("read VSS: {e}"))?;
            let catalog = parse_catalog_yaml(&content)?;
            print_json(&catalog_to_snapshot_dto(&catalog))?;
        }
        Command::Decode { frames } => {
            let state = prepare_state(dbc_flag.as_ref(), vss_flag.as_ref())?;
            let frames_v = read_can_frames(frames)?;
            if frames_v.is_empty() {
                return Err("No frames to decode.".into());
            }
            print_json(&decode_frames(&state, &frames_v))?;
        }
        Command::Mdf {
            path,
            include_frames,
        } => {
            let state = prepare_state(dbc_flag.as_ref(), vss_flag.as_ref())?;
            let path_s = path_to_utf8(&path)?;
            let (frames, decoded_signals) = load_mdf4(&state, path_s)?;
            print_json(&MdfAgentOut {
                frame_count: frames.len(),
                decoded_signal_count: decoded_signals.len(),
                frames: include_frames.then_some(frames.as_slice()),
                decoded_signals: decoded_signals.as_slice(),
            })?;
        }
        Command::Filter { mdf, config } => {
            let state = prepare_state(dbc_flag.as_ref(), vss_flag.as_ref())?;
            let cfg_raw =
                std::fs::read_to_string(&config).map_err(|e| format!("read filter config: {e}"))?;
            let filters: FilterConfig =
                serde_json::from_str(&cfg_raw).map_err(|e| format!("filter JSON: {e}"))?;

            let mdf_s = path_to_utf8(&mdf)?;
            let (frames, _) = load_mdf4(&state, mdf_s)?;

            let needs_dbc = filters.match_status != MatchStatus::All
                || !filters.messages.is_empty()
                || !filters.signals.is_empty();
            let msg_cache = if needs_dbc {
                build_message_cache(&state)
            } else {
                HashMap::new()
            };

            print_json(&filter_frames_with_cache(frames, &filters, &msg_cache))?;
        }
        Command::ExportMdf { input, output } => {
            let raw =
                std::fs::read_to_string(&input).map_err(|e| format!("read frames JSON: {e}"))?;
            let frames: Vec<CanFrameDto> =
                serde_json::from_str(&raw).map_err(|e| format!("frames JSON: {e}"))?;
            let out_s = path_to_utf8(&output)?;
            println!("{}", export_can_frames_to_mdf4_path(out_s, &frames)?);
        }
    }

    Ok(())
}

fn prepare_state(dbc: Option<&PathBuf>, vss: Option<&PathBuf>) -> Result<Arc<AppState>, String> {
    let state = Arc::new(AppState::with_initial_files(InitialFiles::default()));
    if let Some(p) = dbc {
        load_dbc(&state, path_to_utf8(p)?)?;
    }
    if let Some(p) = vss {
        load_vss(&state, path_to_utf8(p)?)?;
    }
    Ok(state)
}

fn path_to_utf8(p: &Path) -> Result<&str, String> {
    p.to_str()
        .ok_or_else(|| format!("path is not valid UTF-8: {}", p.display()))
}

fn read_can_frames(path: Option<PathBuf>) -> Result<Vec<CanFrameDto>, String> {
    let raw = match path {
        Some(p) => std::fs::read_to_string(&p).map_err(|e| format!("read frames file: {e}"))?,
        None => {
            let mut s = String::new();
            std::io::stdin()
                .read_to_string(&mut s)
                .map_err(|e| format!("read stdin: {e}"))?;
            s
        }
    };
    let raw = raw.trim();
    if raw.starts_with('[') {
        serde_json::from_str(raw).map_err(|e| format!("frames JSON array: {e}"))
    } else if raw.is_empty() {
        Ok(Vec::new())
    } else {
        let mut out = Vec::new();
        for line in raw.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            out.push(serde_json::from_str(line).map_err(|e| format!("frame JSON line: {e}"))?);
        }
        Ok(out)
    }
}

fn print_json<T: Serialize>(v: &T) -> Result<(), String> {
    serde_json::to_writer_pretty(std::io::stdout(), v).map_err(|e| e.to_string())?;
    println!();
    Ok(())
}
