use core::ops::Deref;

use dbc_rs::Dbc;

/// Decodes CAN frames via [`Dbc`] (DBC must be parsed or built beforehand).
///
/// This is a thin handle so integration code wires **one** Pelorus-named type; all decode APIs
/// come from [`Dbc::decode_frame`](dbc_rs::Dbc::decode_frame) via [`Deref`].
#[derive(Debug)]
pub struct PelorusCanDecoder<'a> {
    dbc: &'a Dbc,
}

impl<'a> PelorusCanDecoder<'a> {
    /// Borrow a decoder for `dbc`.
    pub fn new(dbc: &'a Dbc) -> Self {
        Self { dbc }
    }
}

impl<'a> Deref for PelorusCanDecoder<'a> {
    type Target = Dbc;

    fn deref(&self) -> &Self::Target {
        self.dbc
    }
}
