#![cfg_attr(not(test), allow(dead_code))]

use super::KernelValidationError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(crate) enum Currency {
    Idr,
    Usd,
}

impl Currency {
    pub(crate) fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_uppercase().as_str() {
            "IDR" => Some(Self::Idr),
            "USD" => Some(Self::Usd),
            _ => None,
        }
    }

    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::Idr => "IDR",
            Self::Usd => "USD",
        }
    }
}

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct Money {
    minor_units: i64,
    currency: Currency,
}

impl Money {
    pub(crate) const fn new_non_negative(
        minor_units: i64,
        currency: Currency,
    ) -> Result<Self, KernelValidationError> {
        if minor_units < 0 {
            return Err(KernelValidationError::NegativeAmount);
        }
        Ok(Self {
            minor_units,
            currency,
        })
    }

    pub(crate) const fn idr(minor_units: i64) -> Result<Self, KernelValidationError> {
        Self::new_non_negative(minor_units, Currency::Idr)
    }

    pub(crate) const fn usd(minor_units: i64) -> Result<Self, KernelValidationError> {
        Self::new_non_negative(minor_units, Currency::Usd)
    }

    pub(crate) const fn minor_units(self) -> i64 {
        self.minor_units
    }

    pub(crate) const fn currency(self) -> Currency {
        self.currency
    }

    pub(crate) fn checked_add(self, other: Self) -> Result<Self, KernelValidationError> {
        self.ensure_same_currency(other)?;
        let minor_units = self
            .minor_units
            .checked_add(other.minor_units)
            .ok_or(KernelValidationError::AmountOverflow)?;
        Self::new_non_negative(minor_units, self.currency)
    }

    pub(crate) fn checked_sub(self, other: Self) -> Result<Self, KernelValidationError> {
        self.ensure_same_currency(other)?;
        let minor_units = self
            .minor_units
            .checked_sub(other.minor_units)
            .ok_or(KernelValidationError::AmountOverflow)?;
        if minor_units < 0 {
            return Err(KernelValidationError::InsufficientAmount);
        }
        Self::new_non_negative(minor_units, self.currency)
    }

    pub(crate) fn checked_mul_i64(self, multiplier: i64) -> Result<Self, KernelValidationError> {
        if multiplier < 0 {
            return Err(KernelValidationError::NegativeAmount);
        }
        let minor_units = self
            .minor_units
            .checked_mul(multiplier)
            .ok_or(KernelValidationError::AmountOverflow)?;
        Self::new_non_negative(minor_units, self.currency)
    }

    fn ensure_same_currency(self, other: Self) -> Result<(), KernelValidationError> {
        if self.currency != other.currency {
            return Err(KernelValidationError::CurrencyMismatch);
        }
        Ok(())
    }
}
