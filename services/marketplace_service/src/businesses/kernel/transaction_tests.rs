use chrono::NaiveDate;
use rust_decimal::Decimal;

use super::transaction::{
    derive_invoice_settlement, validate_payment_allocation, validate_refund,
    validate_return_quantity, FulfillmentState, InvoiceSettlementState, InvoiceState,
    OrderState, PaymentState, TransactionInvariantError, TransactionStateError,
};

#[test]
fn canonical_order_lifecycle_matches_database_states() {
    assert_eq!(
        OrderState::Draft.transition(OrderState::PendingPayment),
        Ok(OrderState::PendingPayment)
    );
    assert_eq!(
        OrderState::PendingPayment.transition(OrderState::Paid),
        Ok(OrderState::Paid)
    );
    assert_eq!(
        OrderState::Paid.transition(OrderState::Processing),
        Ok(OrderState::Processing)
    );
    assert_eq!(
        OrderState::Processing.transition(OrderState::Shipped),
        Ok(OrderState::Shipped)
    );
    assert_eq!(
        OrderState::Shipped.transition(OrderState::Delivered),
        Ok(OrderState::Delivered)
    );
    assert_eq!(
        OrderState::Delivered.transition(OrderState::Completed),
        Ok(OrderState::Completed)
    );
    assert!(OrderState::Completed.is_terminal());
    assert!(OrderState::Cancelled.is_terminal());
    assert!(OrderState::Rejected.is_terminal());
    assert!(OrderState::Expired.is_terminal());
    assert!(OrderState::Refunded.is_terminal());
    assert_eq!(
        OrderState::Completed.transition(OrderState::Paid),
        Err(TransactionStateError::InvalidTransition)
    );
}

#[test]
fn canonical_order_state_round_trips_database_labels() {
    for state in [
        OrderState::Draft,
        OrderState::PendingPayment,
        OrderState::Paid,
        OrderState::Processing,
        OrderState::Shipped,
        OrderState::InService,
        OrderState::Delivered,
        OrderState::Completed,
        OrderState::Cancelled,
        OrderState::Rejected,
        OrderState::Expired,
        OrderState::Refunded,
    ] {
        assert_eq!(OrderState::from_db(state.as_db()), Some(state));
    }
    assert_eq!(OrderState::from_db("UNKNOWN"), None);
}

#[test]
fn invoice_body_is_immutable_after_posting_and_reversal_only_corrects_posted_invoice() {
    assert!(InvoiceState::Draft.body_is_mutable());
    assert_eq!(
        InvoiceState::Draft.transition(InvoiceState::Posted),
        Ok(InvoiceState::Posted)
    );
    assert!(!InvoiceState::Posted.body_is_mutable());
    assert_eq!(
        InvoiceState::Posted.transition(InvoiceState::Reversed),
        Ok(InvoiceState::Reversed)
    );
    assert_eq!(
        InvoiceState::Posted.transition(InvoiceState::Draft),
        Err(TransactionStateError::InvalidTransition)
    );
}

#[test]
fn payment_lifecycle_supports_capture_refund_and_chargeback_without_arbitrary_reopen() {
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
    assert!(PaymentState::Captured.can_transition_to(PaymentState::Chargeback));
    assert_eq!(
        PaymentState::Refunded.transition(PaymentState::Captured),
        Err(TransactionStateError::InvalidTransition)
    );
}

#[test]
fn fulfillment_lifecycle_rejects_terminal_mutation() {
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
    assert_eq!(
        validate_payment_allocation(100_000, 25_000, 75_000).unwrap(),
        100_000
    );
    assert_eq!(
        validate_payment_allocation(100_000, 25_000, 75_001),
        Err(TransactionInvariantError::AllocationExceedsCaptured)
    );
    assert_eq!(
        validate_payment_allocation(100_000, 0, 0),
        Err(TransactionInvariantError::NonPositiveAmount)
    );
}

#[test]
fn refunds_never_exceed_captured_funds() {
    assert_eq!(
        validate_refund(100_000, 20_000, 80_000).unwrap(),
        100_000
    );
    assert_eq!(
        validate_refund(100_000, 20_000, 80_001),
        Err(TransactionInvariantError::RefundExceedsCaptured)
    );
}

#[test]
fn allocation_math_fails_closed_on_overflow_or_invalid_existing_state() {
    assert_eq!(
        validate_payment_allocation(i64::MAX, i64::MAX, 1),
        Err(TransactionInvariantError::AmountOverflow)
    );
    assert_eq!(
        validate_refund(100, -1, 1),
        Err(TransactionInvariantError::NegativeExistingAmount)
    );
}

#[test]
fn returned_quantity_never_exceeds_fulfilled_quantity() {
    assert_eq!(
        validate_return_quantity(
            Decimal::from(10),
            Decimal::from(4),
            Decimal::from(6),
        ),
        Ok(())
    );
    assert_eq!(
        validate_return_quantity(
            Decimal::from(10),
            Decimal::from(4),
            Decimal::from(7),
        ),
        Err(TransactionInvariantError::ReturnExceedsFulfilled)
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
