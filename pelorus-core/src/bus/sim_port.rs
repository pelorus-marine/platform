//! One attachment to a [`super::SimulatedBus`].

use super::{CanFdBus, CanFdFrame, SimBusError, SimulatedBus};

/// One node's attachment to a [`SimulatedBus`].
#[derive(Debug)]
pub struct SimPort<'a> {
    pub(super) bus: &'a mut SimulatedBus,
    pub(super) read_cursor: usize,
}

impl SimPort<'_> {
    /// Reset read position to the start of the current batch.
    pub fn rewind(&mut self) {
        self.read_cursor = 0;
    }
}

impl CanFdBus for SimPort<'_> {
    type Error = SimBusError;

    fn try_transmit(&mut self, frame: &CanFdFrame) -> Result<(), Self::Error> {
        self.bus.push_frame(*frame)?;
        Ok(())
    }

    fn try_receive(&mut self) -> Result<Option<CanFdFrame>, Self::Error> {
        if let Some(frame) = self.bus.frame_at(self.read_cursor) {
            self.read_cursor += 1;
            Ok(Some(frame))
        } else {
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_ports_see_each_other() {
        let mut bus = SimulatedBus::new();
        let frame = CanFdFrame::new_fd(0x1800_0502, &[0; 8]);

        {
            let mut a = bus.port();
            a.try_transmit(&frame).unwrap();
        }
        {
            let mut b = bus.port();
            let from_b = b.try_receive().unwrap().unwrap();
            assert_eq!(from_b.id, frame.id);
        }
        {
            let mut a = bus.port();
            assert!(a.try_receive().unwrap().is_some());
        }
    }
}
