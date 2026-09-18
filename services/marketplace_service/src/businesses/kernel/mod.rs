pub(crate) mod command;
pub(crate) mod money;
pub(crate) mod scope;
pub(crate) mod time;
pub(crate) mod transaction;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum KernelValidationError {
    NegativeAmount,
    NonPositiveAmount,
    CurrencyMismatch,
    AmountOverflow,
    InsufficientAmount,
    InvalidTimezone,
}

#[cfg(test)]
mod command_tests;
#[cfg(test)]
mod kernel_tests;
#[cfg(test)]
mod transaction_tests;
