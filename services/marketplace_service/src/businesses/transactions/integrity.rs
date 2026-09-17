use chrono::NaiveDate;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TransactionIntegrityError {
    NegativeAmount,
    NonPositiveAmount,
    AllocationExceedsCaptured,
    RefundExceedsCaptured,
    ReturnExceedsFulfilled,
    ArithmeticOverflow,
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
    already_allocated_amount: i64,
    requested_amount: i64,
) -> Result<(), TransactionIntegrityError> {
    validate_non_negative(captured_amount)?;
    validate_non_negative(already_allocated_amount)?;
    validate_positive(requested_amount)?;

    let total = already_allocated_amount
        .checked_add(requested_amount)
        .ok_or(TransactionIntegrityError::ArithmeticOverflow)?;
    if total > captured_amount {
        return Err(TransactionIntegrityError::AllocationExceedsCaptured);
    }
    Ok(())
}

pub(crate) fn validate_refund(
    captured_amount: i64,
    already_refunded_amount: i64,
    requested_amount: i64,
) -> Result<(), TransactionIntegrityError> {
    validate_non_negative(captured_amount)?;
    validate_non_negative(already_refunded_amount)?;
    validate_positive(requested_amount)?;

    let total = already_refunded_amount
        .checked_add(requested_amount)
        .ok_or(TransactionIntegrityError::ArithmeticOverflow)?;
    if total > captured_amount {
        return Err(TransactionIntegrityError::RefundExceedsCaptured);
    }
    Ok(())
}

pub(crate) fn validate_return_quantity(
    fulfilled_quantity: Decimal,
    already_returned_quantity: Decimal,
    requested_quantity: Decimal,
) -> Result<(), TransactionIntegrityError> {
    if fulfilled_quantity < Decimal::ZERO || already_returned_quantity < Decimal::ZERO {
        return Err(TransactionIntegrityError::NegativeAmount);
    }
    if requested_quantity <= Decimal::ZERO {
        return Err(TransactionIntegrityError::NonPositiveAmount);
    }
    if already_returned_quantity + requested_quantity > fulfilled_quantity {
        return Err(TransactionIntegrityError::ReturnExceedsFulfilled);
    }
    Ok(())
}

pub(crate) fn derive_invoice_settlement(
    total_amount: i64,
    allocated_amount: i64,
    due_on: Option<NaiveDate>,
    business_date: NaiveDate,
) -> Result<InvoiceSettlement, TransactionIntegrityError> {
    validate_positive(total_amount)?;
    validate_non_negative(allocated_amount)?;

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

const fn validate_non_negative(value: i64) -> Result<(), TransactionIntegrityError> {
    if value < 0 {
        Err(TransactionIntegrityError::NegativeAmount)
    } else {
        Ok(())
    }
}

const fn validate_positive(value: i64) -> Result<(), TransactionIntegrityError> {
    if value <= 0 {
        Err(TransactionIntegrityError::NonPositiveAmount)
    } else {
        Ok(())
    }
}
