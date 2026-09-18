#![cfg_attr(not(test), allow(dead_code))]

use chrono::NaiveDate;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TransactionStateError {
    InvalidTransition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum OrderState {
    Draft,
    PendingPayment,
    Paid,
    Processing,
    Shipped,
    InService,
    Delivered,
    Completed,
    Cancelled,
    Rejected,
    Expired,
    Refunded,
}

impl OrderState {
    pub(crate) const fn as_db(self) -> &'static str {
        match self {
            Self::Draft => "DRAFT",
            Self::PendingPayment => "PENDING_PAYMENT",
            Self::Paid => "PAID",
            Self::Processing => "PROCESSING",
            Self::Shipped => "SHIPPED",
            Self::InService => "IN_SERVICE",
            Self::Delivered => "DELIVERED",
            Self::Completed => "COMPLETED",
            Self::Cancelled => "CANCELLED",
            Self::Rejected => "REJECTED",
            Self::Expired => "EXPIRED",
            Self::Refunded => "REFUNDED",
        }
    }

    pub(crate) fn from_db(value: &str) -> Option<Self> {
        match value {
            "DRAFT" => Some(Self::Draft),
            "PENDING_PAYMENT" => Some(Self::PendingPayment),
            "PAID" => Some(Self::Paid),
            "PROCESSING" => Some(Self::Processing),
            "SHIPPED" => Some(Self::Shipped),
            "IN_SERVICE" => Some(Self::InService),
            "DELIVERED" => Some(Self::Delivered),
            "COMPLETED" => Some(Self::Completed),
            "CANCELLED" => Some(Self::Cancelled),
            "REJECTED" => Some(Self::Rejected),
            "EXPIRED" => Some(Self::Expired),
            "REFUNDED" => Some(Self::Refunded),
            _ => None,
        }
    }

    pub(crate) const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Draft, Self::PendingPayment)
                | (Self::Draft, Self::Cancelled)
                | (Self::PendingPayment, Self::Paid)
                | (Self::PendingPayment, Self::Expired)
                | (Self::PendingPayment, Self::Cancelled)
                | (Self::PendingPayment, Self::Rejected)
                | (Self::Paid, Self::Processing)
                | (Self::Paid, Self::Cancelled)
                | (Self::Paid, Self::Refunded)
                | (Self::Processing, Self::Shipped)
                | (Self::Processing, Self::InService)
                | (Self::Processing, Self::Delivered)
                | (Self::Processing, Self::Cancelled)
                | (Self::Processing, Self::Refunded)
                | (Self::Shipped, Self::Delivered)
                | (Self::Shipped, Self::Completed)
                | (Self::Shipped, Self::Refunded)
                | (Self::InService, Self::Delivered)
                | (Self::InService, Self::Completed)
                | (Self::InService, Self::Cancelled)
                | (Self::InService, Self::Refunded)
                | (Self::Delivered, Self::Completed)
                | (Self::Delivered, Self::Refunded)
        )
    }

    pub(crate) const fn transition(self, next: Self) -> Result<Self, TransactionStateError> {
        if self.can_transition_to(next) {
            Ok(next)
        } else {
            Err(TransactionStateError::InvalidTransition)
        }
    }

    pub(crate) const fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Completed | Self::Cancelled | Self::Rejected | Self::Expired | Self::Refunded
        )
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum InvoiceState {
    Draft,
    Posted,
    Reversed,
    Voided,
}

impl InvoiceState {
    pub(crate) const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Draft, Self::Posted)
                | (Self::Draft, Self::Voided)
                | (Self::Posted, Self::Reversed)
        )
    }

    pub(crate) const fn transition(self, next: Self) -> Result<Self, TransactionStateError> {
        if self.can_transition_to(next) {
            Ok(next)
        } else {
            Err(TransactionStateError::InvalidTransition)
        }
    }

    pub(crate) const fn body_is_mutable(self) -> bool {
        matches!(self, Self::Draft)
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum PaymentState {
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

impl PaymentState {
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

    pub(crate) const fn transition(self, next: Self) -> Result<Self, TransactionStateError> {
        if self.can_transition_to(next) {
            Ok(next)
        } else {
            Err(TransactionStateError::InvalidTransition)
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FulfillmentState {
    Pending,
    Preparing,
    Ready,
    Dispatched,
    Delivered,
    Cancelled,
}

impl FulfillmentState {
    pub(crate) const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Pending, Self::Preparing)
                | (Self::Pending, Self::Ready)
                | (Self::Pending, Self::Cancelled)
                | (Self::Preparing, Self::Ready)
                | (Self::Preparing, Self::Cancelled)
                | (Self::Ready, Self::Dispatched)
                | (Self::Ready, Self::Delivered)
                | (Self::Ready, Self::Cancelled)
                | (Self::Dispatched, Self::Delivered)
        )
    }

    pub(crate) const fn transition(self, next: Self) -> Result<Self, TransactionStateError> {
        if self.can_transition_to(next) {
            Ok(next)
        } else {
            Err(TransactionStateError::InvalidTransition)
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TransactionInvariantError {
    NonPositiveAmount,
    NegativeExistingAmount,
    NegativeAmount,
    AmountOverflow,
    AllocationExceedsCaptured,
    RefundExceedsCaptured,
    ReturnExceedsFulfilled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InvoiceSettlementState {
    Unpaid,
    Partial,
    Paid,
    CreditBalance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct InvoiceSettlement {
    pub(crate) state: InvoiceSettlementState,
    pub(crate) outstanding_amount: i64,
    pub(crate) credit_amount: i64,
    pub(crate) overdue: bool,
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

pub(crate) fn validate_return_quantity(
    fulfilled_quantity: Decimal,
    already_returned_quantity: Decimal,
    requested_quantity: Decimal,
) -> Result<(), TransactionInvariantError> {
    if fulfilled_quantity < Decimal::ZERO || already_returned_quantity < Decimal::ZERO {
        return Err(TransactionInvariantError::NegativeAmount);
    }
    if requested_quantity <= Decimal::ZERO {
        return Err(TransactionInvariantError::NonPositiveAmount);
    }
    if already_returned_quantity + requested_quantity > fulfilled_quantity {
        return Err(TransactionInvariantError::ReturnExceedsFulfilled);
    }
    Ok(())
}

pub(crate) fn derive_invoice_settlement(
    total_amount: i64,
    allocated_amount: i64,
    due_on: Option<NaiveDate>,
    business_date: NaiveDate,
) -> Result<InvoiceSettlement, TransactionInvariantError> {
    if total_amount <= 0 {
        return Err(TransactionInvariantError::NonPositiveAmount);
    }
    if allocated_amount < 0 {
        return Err(TransactionInvariantError::NegativeExistingAmount);
    }

    let (state, outstanding_amount, credit_amount) = if allocated_amount == 0 {
        (InvoiceSettlementState::Unpaid, total_amount, 0)
    } else if allocated_amount < total_amount {
        (
            InvoiceSettlementState::Partial,
            total_amount - allocated_amount,
            0,
        )
    } else if allocated_amount == total_amount {
        (InvoiceSettlementState::Paid, 0, 0)
    } else {
        (
            InvoiceSettlementState::CreditBalance,
            0,
            allocated_amount - total_amount,
        )
    };

    let overdue = outstanding_amount > 0 && due_on.is_some_and(|due| due < business_date);
    Ok(InvoiceSettlement {
        state,
        outstanding_amount,
        credit_amount,
        overdue,
    })
}
