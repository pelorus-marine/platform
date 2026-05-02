//! Phase 3 — **Voyage Data Recorder** service scaffold (Cortex-A55 / Linux).
//!
//! Implements naming convention §3.2 from `PELORUS_IMPLEMENTATION_PLAN.md`; file rotation and IPC
//! ingestion are **TODO**.

use std::time::Duration;

use pelorus_core::dcid::Dcid;
use pelorus_core::vdr::channel_map::{MDF4_GROUP_PREFIX, mdf4_channel_for_dcid};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    tracing::info!(
        group = MDF4_GROUP_PREFIX,
        gnss = %mdf4_channel_for_dcid(Dcid::GnssLatitude),
        nm = %mdf4_channel_for_dcid(Dcid::PelorusNetworkManagement),
        "pelorus-vdr scaffold — MDF4 `.mf4` pipeline and retention §3.3 not yet implemented"
    );

    // Keep Tokio runtime alive for future MDF4 writer / IPC tasks (Phase 3).
    tokio::time::sleep(Duration::ZERO).await;
}
