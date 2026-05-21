//! Cluster network-management FSM (`04-power.md` §6).

use crate::bus::{CanFdBus, CanFdFrame};

use super::{
    ClusterNmState, FunctionalGroups, NetworkManagementConfig, NetworkManagementFrame, NmAction,
    NmWireState, WakeUpFrame, nm_timing,
};

/// Coordinated sleep / wake per `04-power.md` §6.
#[derive(Debug, Clone)]
pub struct NetworkManagementEngine {
    config: NetworkManagementConfig,
    cluster: ClusterNmState,
    last_peer_nm_ms: u32,
    phase_deadline_ms: u32,
    last_tx_ms: u32,
}

impl NetworkManagementEngine {
    /// New engine in [`ClusterNmState::BusSleep`].
    #[must_use]
    pub fn new(config: NetworkManagementConfig) -> Self {
        Self {
            config,
            cluster: ClusterNmState::BusSleep,
            last_peer_nm_ms: 0,
            phase_deadline_ms: 0,
            last_tx_ms: 0,
        }
    }

    /// Cluster FSM state.
    #[must_use]
    pub const fn cluster_state(&self) -> ClusterNmState {
        self.cluster
    }

    /// Application sets whether this node keeps the cluster in normal operation.
    pub fn set_has_application_work(&mut self, yes: bool) {
        self.config.has_application_work = yes;
    }

    /// Originate a wake-up for `groups` (gateway / coordinator).
    #[must_use]
    pub fn transmit_wake_up(&self, groups: FunctionalGroups) -> NmAction {
        NmAction::TransmitWakeUp(
            WakeUpFrame {
                source_address: self.config.source_address,
                groups,
            }
            .into_can_frame(),
        )
    }

    /// Handle one frame; may combine with [`Self::tick`].
    #[must_use]
    pub fn on_frame(&mut self, now_ms: u32, frame: &CanFdFrame) -> Option<NmAction> {
        if let Some(wuf) = WakeUpFrame::parse(frame.id, frame.payload()) {
            if FunctionalGroups::should_wake_for(self.config.membership, wuf.groups) {
                self.enter_repeat_message(now_ms);
            }
        }
        if let Some(nm) = NetworkManagementFrame::parse(frame.id, frame.payload()) {
            if nm.source_address != self.config.source_address {
                self.last_peer_nm_ms = now_ms;
                if matches!(
                    self.cluster,
                    ClusterNmState::ReadySleep | ClusterNmState::PrepareBusSleep
                ) {
                    self.enter_repeat_message(now_ms);
                }
            }
        }
        self.tick(now_ms)
    }

    /// Advance timers and NM cadence.
    #[must_use]
    pub fn tick(&mut self, now_ms: u32) -> Option<NmAction> {
        self.advance_cluster(now_ms);
        self.maybe_transmit_nm(now_ms)
    }

    /// Apply one [`NmAction`] on a bus.
    pub fn apply_action<B: CanFdBus>(action: NmAction, bus: &mut B) -> Result<(), B::Error> {
        match action {
            NmAction::TransmitWakeUp(f) | NmAction::TransmitNetworkManagement(f) => {
                bus.try_transmit(&f)
            }
        }
    }

    fn advance_cluster(&mut self, now_ms: u32) {
        match self.cluster {
            ClusterNmState::RepeatMessage if now_ms >= self.phase_deadline_ms => {
                if self.config.has_application_work {
                    self.cluster = ClusterNmState::NormalOperation;
                } else {
                    self.enter_ready_sleep(now_ms);
                }
            }
            ClusterNmState::ReadySleep
                if now_ms.saturating_sub(self.last_peer_nm_ms) >= nm_timing::READY_SLEEP_MS
                    && now_ms >= self.phase_deadline_ms =>
            {
                self.enter_prepare_bus_sleep(now_ms);
            }
            ClusterNmState::PrepareBusSleep
                if now_ms.saturating_sub(self.last_peer_nm_ms) >= nm_timing::WAIT_BUS_SLEEP_MS
                    && now_ms >= self.phase_deadline_ms =>
            {
                self.cluster = ClusterNmState::BusSleep;
            }
            ClusterNmState::NormalOperation if !self.config.has_application_work => {
                self.enter_ready_sleep(now_ms);
            }
            _ => {}
        }
    }

    fn maybe_transmit_nm(&mut self, now_ms: u32) -> Option<NmAction> {
        let wire = match self.cluster {
            ClusterNmState::NormalOperation | ClusterNmState::RepeatMessage => {
                if self.cluster == ClusterNmState::RepeatMessage {
                    NmWireState::RepeatMessage
                } else {
                    NmWireState::NormalOperation
                }
            }
            _ => return None,
        };
        if now_ms.saturating_sub(self.last_tx_ms) < nm_timing::NM_PERIOD_MS {
            return None;
        }
        self.last_tx_ms = now_ms;
        Some(NmAction::TransmitNetworkManagement(
            NetworkManagementFrame {
                source_address: self.config.source_address,
                wire_state: wire,
                active_groups: self.config.membership,
            }
            .into_can_frame(),
        ))
    }

    fn enter_repeat_message(&mut self, now_ms: u32) {
        self.cluster = ClusterNmState::RepeatMessage;
        self.phase_deadline_ms = now_ms.saturating_add(nm_timing::REPEAT_MESSAGE_MS);
        self.last_tx_ms = 0;
    }

    fn enter_ready_sleep(&mut self, now_ms: u32) {
        self.cluster = ClusterNmState::ReadySleep;
        self.phase_deadline_ms = now_ms.saturating_add(nm_timing::READY_SLEEP_MS);
    }

    fn enter_prepare_bus_sleep(&mut self, now_ms: u32) {
        self.cluster = ClusterNmState::PrepareBusSleep;
        self.phase_deadline_ms = now_ms.saturating_add(nm_timing::WAIT_BUS_SLEEP_MS);
    }
}
