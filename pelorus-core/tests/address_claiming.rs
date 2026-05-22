//! Address claiming on [`SimulatedBus`].

use pelorus_core::{
    AddressClaimConfig, AddressClaimEngine, CanFdBus, ClaimState, Name, NameBuilder, SimulatedBus,
};

fn name_with_identity(id: u32) -> Name {
    NameBuilder::marine()
        .manufacturer_code(0x7FF)
        .identity_number(id)
        .build()
}

fn run_until_claimed(engine: &mut AddressClaimEngine, bus: &mut SimulatedBus, now: &mut u32) -> u8 {
    loop {
        *now = now.saturating_add(10);
        {
            let mut port = bus.port();
            if let Some(action) = engine.tick(*now) {
                AddressClaimEngine::apply_action(action, &mut port).unwrap();
            }
        }
        bus.finish_round();
        if let ClaimState::Claimed { sa } = engine.state() {
            return sa;
        }
        if engine.state() == ClaimState::CannotClaim {
            panic!("cannot claim");
        }
    }
}

#[test]
fn single_node_claims_preferred_address() {
    let mut bus = SimulatedBus::new();
    let name = name_with_identity(1);
    let mut engine = AddressClaimEngine::new(AddressClaimConfig::new(name, 0x28));
    let mut now = 0u32;
    engine.start(now);
    let sa = run_until_claimed(&mut engine, &mut bus, &mut now);
    assert_eq!(sa, 0x28);
}

#[test]
fn lower_name_wins_same_address() {
    let mut bus = SimulatedBus::new();
    let preferred = 0x30u8;

    let winner = name_with_identity(1);
    let loser = name_with_identity(99);

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

    {
        let mut port = bus.port();
        if let Some(a) = strong.tick(now) {
            AddressClaimEngine::apply_action(a, &mut port).unwrap();
        }
    }

    {
        let mut port = bus.port();
        while let Some(frame) = port.try_receive().unwrap() {
            let _ = weak.on_frame(now, &frame);
        }
    }
    bus.finish_round();

    let weak_sa = run_until_claimed(&mut weak, &mut bus, &mut now);
    assert_ne!(weak_sa, preferred);
    assert_eq!(strong.claimed_address(), Some(preferred));
}

#[test]
fn commanded_address_overrides_target() {
    let mut bus = SimulatedBus::new();
    let target_name = name_with_identity(42);
    let mut target = AddressClaimEngine::new(AddressClaimConfig::new(target_name, 0x10));
    target.start(0);

    let cmd = pelorus_core::AddressCommandFrame {
        commander_address: 0x01,
        target_name,
        new_address: 0x55,
    };
    {
        let mut port = bus.port();
        port.try_transmit(&cmd.into_can_frame()).unwrap();
    }

    {
        let mut port = bus.port();
        while let Some(frame) = port.try_receive().unwrap() {
            let _ = target.on_frame(0, &frame);
        }
    }
    assert_eq!(target.claimed_address(), Some(0x55));
}
