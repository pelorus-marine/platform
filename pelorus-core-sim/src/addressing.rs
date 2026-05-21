//! Address claiming simulation (`05-addressing.md`).

use pelorus_core::{
    AddressClaimConfig, AddressClaimEngine, CanFdBus, ClaimState, NameBuilder, SimulatedBus,
};

use crate::SimError;

/// Two-node claim: lower NAME holds preferred SA, higher NAME is reassigned.
pub fn run() -> Result<(), SimError> {
    let mut bus = SimulatedBus::new();
    let preferred = 0x30u8;

    let winner = NameBuilder::marine()
        .manufacturer_code(0x7FF)
        .identity_number(1)
        .build();
    let loser = NameBuilder::marine()
        .manufacturer_code(0x7FF)
        .identity_number(99)
        .build();

    let mut strong = AddressClaimEngine::new(AddressClaimConfig {
        listen_ms: 0,
        ..AddressClaimConfig::new(winner, preferred)
    });
    let mut weak = AddressClaimEngine::new(AddressClaimConfig {
        listen_ms: 0,
        ..AddressClaimConfig::new(loser, preferred)
    });

    let mut now = 0u32;
    strong.start(now);
    weak.start(now);

    let mut port = bus.port();
    if let Some(action) = strong.tick(now) {
        AddressClaimEngine::apply_action(action, &mut port)
            .map_err(|_| SimError("strong claim transmit failed"))?;
    }
    drop(port);

    let mut port = bus.port();
    while let Ok(Some(frame)) = port.try_receive() {
        let _ = weak.on_frame(now, &frame);
    }
    drop(port);

    let weak_sa = run_until_claimed(&mut weak, &mut bus, &mut now)?;

    if strong.claimed_address() != Some(preferred) {
        return Err(SimError("strong node did not hold preferred SA"));
    }
    if weak_sa == preferred {
        return Err(SimError("weak node kept contested SA"));
    }

    println!("  strong NAME id=1  -> SA 0x{preferred:02X} (held)");
    println!("  weak   NAME id=99 -> SA 0x{weak_sa:02X} (reassigned)");
    Ok(())
}

fn run_until_claimed(
    engine: &mut AddressClaimEngine,
    bus: &mut SimulatedBus,
    now: &mut u32,
) -> Result<u8, SimError> {
    loop {
        *now = now.saturating_add(10);
        let mut port = bus.port();
        if let Some(action) = engine.tick(*now) {
            AddressClaimEngine::apply_action(action, &mut port)
                .map_err(|_| SimError("claim transmit failed"))?;
        }
        drop(port);
        bus.finish_round();
        if let ClaimState::Claimed { sa } = engine.state() {
            return Ok(sa);
        }
        if engine.state() == ClaimState::CannotClaim {
            return Err(SimError("node entered CannotClaim"));
        }
    }
}
