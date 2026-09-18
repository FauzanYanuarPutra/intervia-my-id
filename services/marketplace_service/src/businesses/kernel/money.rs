#![cfg_attr(not(test), allow(dead_code))]

use rust_decimal::Decimal;

use super::KernelValidationError;

const MAX_MONEY_SCALE: u32 = 9;

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

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct CurrencyCode(String);

impl CurrencyCode {
    pub(crate) fn new(value: &str) -> Result<Self, KernelValidationError> {
        let normalized = value.trim().to_ascii_uppercase();
        if normalized.len() != 3 || !normalized.bytes().all(|byte| byte.is_ascii_uppercase()) {
            return Err(KernelValidationError::InvalidCurrency);
        }
        Ok(Self(normalized))
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ScaledMoney {
    minor_units: i64,
    currency: CurrencyCode,
    scale: u32,
}

impl ScaledMoney {
    pub(crate) fn new(
        minor_units: i64,
        currency: &str,
        scale: u32,
    ) -> Result<Self, KernelValidationError> {
        if scale > MAX_MONEY_SCALE {
            return Err(KernelValidationError::InvalidMoneyScale);
        }
        Ok(Self {
            minor_units,
            currency: CurrencyCode::new(currency)?,
            scale,
        })
    }

    pub(crate) fn zero(currency: &str, scale: u32) -> Result<Self, KernelValidationError> {
        Self::new(0, currency, scale)
    }

    pub(crate) fn positive(
        minor_units: i64,
        currency: &str,
        scale: u32,
    ) -> Result<Self, KernelValidationError> {
        PositiveAmount::new(minor_units)?;
        Self::new(minor_units, currency, scale)
    }

    pub(crate) const fn minor_units(&self) -> i64 {
        self.minor_units
    }

    pub(crate) fn currency(&self) -> &str {
        self.currency.as_str()
    }

    pub(crate) const fn scale(&self) -> u32 {
        self.scale
    }

    pub(crate) fn checked_add(&self, other: &Self) -> Result<Self, KernelValidationError> {
        self.ensure_compatible(other)?;
        let minor_units = self
            .minor_units
            .checked_add(other.minor_units)
            .ok_or(KernelValidationError::AmountOverflow)?;
        Ok(Self {
            minor_units,
            currency: self.currency.clone(),
            scale: self.scale,
        })
    }

    pub(crate) fn checked_sub(&self, other: &Self) -> Result<Self, KernelValidationError> {
        self.ensure_compatible(other)?;
        let minor_units = self
            .minor_units
            .checked_sub(other.minor_units)
            .ok_or(KernelValidationError::AmountOverflow)?;
        Ok(Self {
            minor_units,
            currency: self.currency.clone(),
            scale: self.scale,
        })
    }

    pub(crate) fn checked_mul_i64(&self, multiplier: i64) -> Result<Self, KernelValidationError> {
        let minor_units = self
            .minor_units
            .checked_mul(multiplier)
            .ok_or(KernelValidationError::AmountOverflow)?;
        Ok(Self {
            minor_units,
            currency: self.currency.clone(),
            scale: self.scale,
        })
    }

    pub(crate) fn to_decimal(&self) -> Decimal {
        Decimal::new(self.minor_units, self.scale)
    }

    fn ensure_compatible(&self, other: &Self) -> Result<(), KernelValidationError> {
        if self.currency != other.currency {
            return Err(KernelValidationError::CurrencyMismatch);
        }
        if self.scale != other.scale {
            return Err(KernelValidationError::MoneyScaleMismatch);
        }
        Ok(())
    }
}
