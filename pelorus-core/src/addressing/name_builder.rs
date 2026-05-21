//! J1939-81 NAME field builder (`05-addressing.md` §2).

use super::Name;

/// Construct a NAME from J1939-81 fields (marine industry group = 4).
#[derive(Debug, Clone, Copy, Default)]
pub struct NameBuilder {
    arbitrary_address_capable: bool,
    industry_group: u8,
    device_class: u8,
    function: u8,
    function_instance: u8,
    device_class_instance: u8,
    manufacturer_code: u16,
    identity_number: u32,
}

impl NameBuilder {
    /// New builder with marine industry group (**4**) and arbitrary-address capable set.
    #[must_use]
    pub fn marine() -> Self {
        Self {
            arbitrary_address_capable: true,
            industry_group: 4,
            ..Self::default()
        }
    }

    /// J1939 "Arbitrary Address Capable" bit.
    #[must_use]
    pub const fn arbitrary_address_capable(mut self, yes: bool) -> Self {
        self.arbitrary_address_capable = yes;
        self
    }

    /// Industry group (3 bits) — marine = 4.
    #[must_use]
    pub const fn industry_group(mut self, group: u8) -> Self {
        self.industry_group = group & 0x7;
        self
    }

    /// Device class (7 bits in NAME layout).
    #[must_use]
    pub const fn device_class(mut self, class: u8) -> Self {
        self.device_class = class & 0x7F;
        self
    }

    /// Function (8 bits).
    #[must_use]
    pub const fn function(mut self, function: u8) -> Self {
        self.function = function;
        self
    }

    /// Function instance (5 bits in standard layout).
    #[must_use]
    pub const fn function_instance(mut self, instance: u8) -> Self {
        self.function_instance = instance & 0x1F;
        self
    }

    /// Device class instance (4 bits).
    #[must_use]
    pub const fn device_class_instance(mut self, instance: u8) -> Self {
        self.device_class_instance = instance & 0x0F;
        self
    }

    /// Manufacturer code (11 bits).
    #[must_use]
    pub const fn manufacturer_code(mut self, code: u16) -> Self {
        self.manufacturer_code = code & 0x7FF;
        self
    }

    /// Identity number (21 bits).
    #[must_use]
    pub const fn identity_number(mut self, id: u32) -> Self {
        self.identity_number = id & 0x1F_FFFF;
        self
    }

    /// Pack fields into a [`Name`] (J1939-81 bit layout, LE integer for compare).
    #[must_use]
    pub fn build(self) -> Name {
        let mut value = u64::from(self.identity_number);
        value |= u64::from(self.manufacturer_code) << 21;
        value |= u64::from(self.device_class_instance) << 32;
        value |= u64::from(self.function_instance) << 35;
        value |= u64::from(self.function) << 40;
        value |= u64::from(self.device_class) << 49;
        value |= u64::from(self.industry_group) << 56;
        if self.arbitrary_address_capable {
            value |= 1 << 63;
        }
        Name(value)
    }
}
