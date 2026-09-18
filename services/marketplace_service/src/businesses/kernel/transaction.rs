#![cfg_attr(not(test), allow(dead_code))]

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum OrderLifecycle {
    Draft,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
}

impl OrderLifecycle {
    pub(crate) const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Draft, Self::Confirmed)
                | (Self::Draft, Self::Cancelled)
                | (Self::Confirmed, Self::InProgress)
                | (Self::Confirmed, Self::Cancelled)
                | (Self::InProgress, Self::Completed)
                | (Self::InProgress, Self::Cancelled)
        )
    }

    pub(crate) const fn is_terminal(self) -> bool {
        matches!(self, Self::Completed | Self::Cancelled)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum InvoiceLifecycle {
    Draft,
    Posted,
    Reversed,
    Voided,
}

impl InvoiceLifecycle {
    pub(crate) const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Draft, Self::Posted)
                | (Self::Draft, Self::Voided)
                | (Self::Posted, Self::Reversed)
        )
    }

    pub(crate) const fn body_is_mutable(self) -> bool {
        matches!(self, Self::Draft)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum PaymentLifecycle {
    Pending,
    Authorized,
    Captured,
    Failed,
    Expired,
    Cancelled,
    PartiallyRefunded,
    Refunded,
    Chargeback,
}

impl PaymentLifecycle {
    pub(crate) const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Pending, Self::Authorized)
                | (Self::Pending, Self::Captured)
                | (Self::Pending, Self::Failed)
                | (Self::Pending, Self::Expired)
                | (Self::Pending, Self::Cancelled)
                | (Self::Authorized, Self::Captured)
                | (Self::Authorized, Self::Failed)
                | (Self::Authorized, Self::Expired)
                | (Self::Authorized, Self::Cancelled)
                | (Self::Captured, Self::PartiallyRefunded)
                | (Self::Captured, Self::Refunded)
                | (Self::Captured, Self::Chargeback)
                | (Self::PartiallyRefunded, Self::PartiallyRefunded)
                | (Self::PartiallyRefunded, Self::Refunded)
                | (Self::PartiallyRefunded, Self::Chargeback)
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TransactionInvariantError {
    NonPositiveAmount,
    NegativeExistingAmount,
    AmountOverflow,
    AllocationExceedsCaptured,
    RefundExceedsCaptured,
}

pub(crate) fn validate_payment_allocation(
    captured_amount: i64,
    already_allocated: i64,
    requested_amount: i64,
) -> Result<i64, TransactionInvariantError> {
    if captured_amount < 0 || already_allocated < 0 {
        return Err(TransactionInvariantError::NegativeExistingAmount);
    }
    if requested_amount <= 0 {
        return Err(TransactionInvariantError::NonPositiveAmount);
    }
    let total = already_allocated
        .checked_add(requested_amount)
        .ok_or(TransactionInvariantError::AmountOverflow)?;
    if total > captured_amount {
        return Err(TransactionInvariantError::AllocationExceedsCaptured);
    }
    Ok(total)
}

pub(crate) fn validate_refund(
    captured_amount: i64,
    already_refunded: i64,
    requested_amount: i64,
) -> Result<i64, TransactionInvariantError> {
    if captured_amount < 0 || already_refunded < 0 {
        return Err(TransactionInvariantError::NegativeExistingAmount);
    }
    if requested_amount <= 0 {
        return Err(TransactionInvariantError::NonPositiveAmount);
    }
    let total = already_refunded
        .checked_add(requested_amount)
        .ok_or(TransactionInvariantError::AmountOverflow)?;
    if total > captured_amount {
        return Err(TransactionInvariantError::RefundExceedsCaptured);
    }
    Ok(total)
}
