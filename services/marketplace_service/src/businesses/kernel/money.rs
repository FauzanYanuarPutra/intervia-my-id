#![cfg_attr(not(test), allow(dead_code))]

use super::KernelValidationError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(crate) struct NonNegativeAmount(i64);

impl NonNegativeAmount {
    pub(crate) const fn new(value: i64) -> Result<Self, KernelValidationError> {
        if value < 0 {
            Err(KernelValidationError::NegativeAmount)
        } else {
            Ok(Self(value))
        }
    }

    pub(crate) const fn value(self) -> i64 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(crate) struct PositiveAmount(i64);

impl PositiveAmount {
    pub(crate) const fn new(value: i64) -> Result<Self, KernelValidationError> {
        if value <= 0 {
            Err(KernelValidationError::NonPositiveAmount)
        } else {
            Ok(Self(value))
        }
    }

    pub(crate) const fn value(self) -> i64 {
        self.0
    }
}
