use chrono::NaiveDate;
use rust_decimal::Decimal;

use super::{
    integrity::{
        derive_invoice_settlement, validate_payment_allocation, validate_refund,
        validate_return_quantity, InvoiceSettlementState, TransactionIntegrityError,
    },
    state::{FulfillmentState, InvoiceState, OrderState, PaymentState, TransactionStateError},
};

#[test]
fn order_state_machine_rejects_reopening_terminal_orders() {
    assert_eq!(
        OrderState::Draft.transition(OrderState::Confirmed),
        Ok(OrderState::Confirmed)
    );
    assert_eq!(
        OrderState::Confirmed.transition(OrderState::InProgress),
        Ok(OrderState::InProgress)
    );
    assert_eq!(
        OrderState::InProgress.transition(OrderState::Completed),
        Ok(OrderState::Completed)
    );
    assert_eq!(
        OrderState::Completed.transition(OrderState::Confirmed),
        Err(TransactionStateError::InvalidTransition)
    );
    assert_eq!(
        OrderState::Cancelled.transition(OrderState::Draft),
        Err(TransactionStateError::InvalidTransition)
    );
}

#[test]
fn posted_invoice_can_only_be_corrected_through_reversal() {
    assert_eq!(
        InvoiceState::Draft.transition(InvoiceState::Posted),
        Ok(InvoiceState::Posted)
    );
    assert_eq!(
        InvoiceState::Posted.transition(InvoiceState::Reversed),
        Ok(InvoiceState::Reversed)
    );
    assert_eq!(
        InvoiceState::Posted.transition(InvoiceState::Draft),
        Err(TransactionStateError::InvalidTransition)
    );
    assert_eq!(
        InvoiceState::Reversed.transition(InvoiceState::Posted),
        Err(TransactionStateError::InvalidTransition)
    );
}

#[test]
fn captured_payment_supports_controlled_refund_lifecycle() {
    assert_eq!(
        PaymentState::Pending.transition(PaymentState::Captured),
        Ok(PaymentState::Captured)
    );
    assert_eq!(
        PaymentState::Captured.transition(PaymentState::PartiallyRefunded),
        Ok(PaymentState::PartiallyRefunded)
    );
    assert_eq!(
        PaymentState::PartiallyRefunded.transition(PaymentState::Refunded),
        Ok(PaymentState::Refunded)
    );
    assert_eq!(
        PaymentState::Refunded.transition(PaymentState::Captured),
        Err(TransactionStateError::InvalidTransition)
    );
}

#[test]
fn delivered_fulfillment_is_terminal_in_base_lifecycle() {
    assert_eq!(
        FulfillmentState::Pending.transition(FulfillmentState::Preparing),
        Ok(FulfillmentState::Preparing)
    );
    assert_eq!(
        FulfillmentState::Preparing.transition(FulfillmentState::Ready),
        Ok(FulfillmentState::Ready)
    );
    assert_eq!(
        FulfillmentState::Ready.transition(FulfillmentState::Dispatched),
        Ok(FulfillmentState::Dispatched)
    );
    assert_eq!(
        FulfillmentState::Dispatched.transition(FulfillmentState::Delivered),
        Ok(FulfillmentState::Delivered)
    );
    assert_eq!(
        FulfillmentState::Delivered.transition(FulfillmentState::Cancelled),
        Err(TransactionStateError::InvalidTransition)
    );
}

#[test]
fn payment_allocation_never_exceeds_captured_funds() {
    assert_eq!(validate_payment_allocation(100_000, 25_000, 75_000), Ok(()));
    assert_eq!(
        validate_payment_allocation(100_000, 25_000, 75_001),
        Err(TransactionIntegrityError::AllocationExceedsCaptured)
    );
}

#[test]
fn refunds_never_exceed_captured_funds() {
    assert_eq!(validate_refund(100_000, 10_000, 90_000), Ok(()));
    assert_eq!(
        validate_refund(100_000, 10_000, 90_001),
        Err(TransactionIntegrityError::RefundExceedsCaptured)
    );
}

#[test]
fn returned_quantity_never_exceeds_fulfilled_quantity() {
    assert_eq!(
        validate_return_quantity(
            Decimal::from(10),
            Decimal::from(4),
            Decimal::from(6)
        ),
        Ok(())
    );
    assert_eq!(
        validate_return_quantity(
            Decimal::from(10),
            Decimal::from(4),
            Decimal::from(7)
        ),
        Err(TransactionIntegrityError::ReturnExceedsFulfilled)
    );
}

#[test]
fn invoice_settlement_keeps_commercial_and_payment_state_separate() {
    let business_date = NaiveDate::from_ymd_opt(2026, 9, 18).unwrap();
    let due_on = NaiveDate::from_ymd_opt(2026, 9, 17).unwrap();

    let partial =
        derive_invoice_settlement(100_000, 40_000, Some(due_on), business_date).unwrap();
    assert_eq!(partial.state, InvoiceSettlementState::Partial);
    assert_eq!(partial.outstanding_amount, 60_000);
    assert_eq!(partial.credit_amount, 0);
    assert!(partial.overdue);

    let overpaid =
        derive_invoice_settlement(100_000, 125_000, Some(due_on), business_date).unwrap();
    assert_eq!(overpaid.state, InvoiceSettlementState::CreditBalance);
    assert_eq!(overpaid.outstanding_amount, 0);
    assert_eq!(overpaid.credit_amount, 25_000);
    assert!(!overpaid.overdue);
}
