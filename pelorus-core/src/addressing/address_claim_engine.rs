//! Address-claim state machine (`05-addressing.md` §3–§4).

use crate::bus::{CanFdBus, CanFdFrame};

use super::{
    AddressClaimConfig, AddressClaimFrame, AddressCommandFrame, ClaimAction, ClaimState, Name,
    listen_timing::MAX_CLAIMED_ADDRESS,
};

/// J1939-81-style address claiming on Pelorus Core.
#[derive(Debug, Clone)]
pub struct AddressClaimEngine {
    config: AddressClaimConfig,
    state: ClaimState,
    listen_deadline_ms: u32,
    candidate_sa: u8,
    attempts: u8,
    listen_contender: Option<Name>,
    bus_table: [Option<Name>; 254],
}

impl AddressClaimEngine {
    /// New engine in [`ClaimState::Idle`].
    #[must_use]
    pub fn new(config: AddressClaimConfig) -> Self {
        Self {
            config,
            state: ClaimState::Idle,
            listen_deadline_ms: 0,
            candidate_sa: 0,
            attempts: 0,
            listen_contender: None,
            bus_table: [None; 254],
        }
    }

    /// Current state.
    #[must_use]
    pub const fn state(&self) -> ClaimState {
        self.state
    }

    /// Held address when [`ClaimState::Claimed`].
    #[must_use]
    pub const fn claimed_address(&self) -> Option<u8> {
        match self.state {
            ClaimState::Claimed { sa } => Some(sa),
            _ => None,
        }
    }

    /// Begin or restart claiming (`05` §3).
    pub fn start(&mut self, now_ms: u32) {
        self.attempts = 0;
        self.enter_listen(now_ms, self.config.preferred_address);
    }

    /// Advance time — may return a claim frame when the listen window expires.
    #[must_use]
    pub fn tick(&mut self, now_ms: u32) -> Option<ClaimAction> {
        if !matches!(self.state, ClaimState::Listening) {
            return None;
        }
        if now_ms < self.listen_deadline_ms {
            return None;
        }
        self.finish_listen(now_ms)
    }

    /// Handle one received frame.
    #[must_use]
    pub fn on_frame(&mut self, now_ms: u32, frame: &CanFdFrame) -> Option<ClaimAction> {
        if let Some(claim) = AddressClaimFrame::parse(frame.id, frame.payload()) {
            self.on_address_claim(now_ms, claim);
        }
        if let Some(cmd) = AddressCommandFrame::parse(frame.id, frame.payload()) {
            self.on_address_command(cmd);
        }
        self.tick(now_ms)
    }

    /// Drain a [`CanFdBus`], then run [`Self::tick`].
    pub fn poll_bus<B: CanFdBus>(
        &mut self,
        now_ms: u32,
        bus: &mut B,
    ) -> Result<Option<ClaimAction>, B::Error> {
        while let Some(frame) = bus.try_receive()? {
            let _ = self.on_frame(now_ms, &frame);
        }
        Ok(self.tick(now_ms))
    }

    /// Apply one [`ClaimAction`] on a bus.
    pub fn apply_action<B: CanFdBus>(action: ClaimAction, bus: &mut B) -> Result<(), B::Error> {
        match action {
            ClaimAction::Transmit(frame) => bus.try_transmit(&frame),
        }
    }

    fn on_address_claim(&mut self, now_ms: u32, claim: AddressClaimFrame) {
        let sa = claim.claimed_address;
        if sa > MAX_CLAIMED_ADDRESS {
            return;
        }
        self.update_bus_table(sa, claim.name);

        match self.state {
            ClaimState::Listening if sa == self.candidate_sa => {
                self.listen_contender = Some(match self.listen_contender {
                    Some(current) if current.wins_over(claim.name) => current,
                    _ => claim.name,
                });
            }
            ClaimState::Claimed { sa: held } if sa == held => {
                if claim.name.wins_over(self.config.name) {
                    self.release_and_reclaim(now_ms, held);
                }
            }
            _ => {}
        }
    }

    fn on_address_command(&mut self, cmd: AddressCommandFrame) {
        if cmd.target_name != self.config.name {
            return;
        }
        if cmd.new_address > MAX_CLAIMED_ADDRESS {
            return;
        }
        self.state = ClaimState::Claimed {
            sa: cmd.new_address,
        };
        self.update_bus_table(cmd.new_address, self.config.name);
    }

    fn enter_listen(&mut self, now_ms: u32, candidate_sa: u8) {
        self.state = ClaimState::Listening;
        self.candidate_sa = if candidate_sa > MAX_CLAIMED_ADDRESS {
            MAX_CLAIMED_ADDRESS
        } else {
            candidate_sa
        };
        self.listen_deadline_ms = now_ms.saturating_add(self.config.listen_ms);
        self.listen_contender = None;
    }

    fn finish_listen(&mut self, now_ms: u32) -> Option<ClaimAction> {
        if self.should_defer_to_contender() {
            self.attempts = self.attempts.saturating_add(1);
            if self.attempts >= self.config.max_attempts {
                self.state = ClaimState::CannotClaim;
                return None;
            }
            let Some(next) = self.next_free_address(self.candidate_sa.wrapping_add(1)) else {
                self.state = ClaimState::CannotClaim;
                return None;
            };
            self.enter_listen(now_ms, next);
            return None;
        }

        Some(self.transmit_claim(self.candidate_sa))
    }

    fn should_defer_to_contender(&self) -> bool {
        if let Some(contender) = self.listen_contender {
            if contender.wins_over(self.config.name) {
                return true;
            }
        }
        if let Some(occupant) = self.bus_table[self.candidate_sa as usize] {
            if occupant.wins_over(self.config.name) {
                return true;
            }
        }
        false
    }

    fn release_and_reclaim(&mut self, now_ms: u32, lost_sa: u8) {
        self.bus_table[lost_sa as usize] = None;
        self.attempts = self.attempts.saturating_add(1);
        if self.attempts >= self.config.max_attempts {
            self.state = ClaimState::CannotClaim;
            return;
        }
        if let Some(next) = self.next_free_address(lost_sa.wrapping_add(1)) {
            self.enter_listen(now_ms, next);
        } else {
            self.state = ClaimState::CannotClaim;
        }
    }

    fn next_free_address(&self, start: u8) -> Option<u8> {
        let start = if start > MAX_CLAIMED_ADDRESS {
            MAX_CLAIMED_ADDRESS
        } else {
            start
        };
        for offset in 0..=MAX_CLAIMED_ADDRESS {
            let sa = start.wrapping_add(offset).min(MAX_CLAIMED_ADDRESS);
            let taken_by_lower = self.bus_table[sa as usize]
                .is_some_and(|occupant| occupant.wins_over(self.config.name));
            if !taken_by_lower {
                return Some(sa);
            }
        }
        None
    }

    fn update_bus_table(&mut self, sa: u8, name: Name) {
        if sa > MAX_CLAIMED_ADDRESS {
            return;
        }
        let idx = sa as usize;
        match self.bus_table[idx] {
            Some(current) if current.wins_over(name) => {}
            _ => self.bus_table[idx] = Some(name),
        }
    }

    fn transmit_claim(&mut self, sa: u8) -> ClaimAction {
        self.state = ClaimState::Claimed { sa };
        self.update_bus_table(sa, self.config.name);
        ClaimAction::Transmit(
            AddressClaimFrame {
                claimed_address: sa,
                name: self.config.name,
            }
            .into_can_frame(),
        )
    }
}
