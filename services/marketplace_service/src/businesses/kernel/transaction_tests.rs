use super::transaction::{
    validate_payment_allocation, validate_refund, InvoiceLifecycle, OrderLifecycle, PaymentLifecycle,
    TransactionInvariantError,
};

#[test]
fn order_lifecycle_rejects_skips_and_terminal_mutation() {
    assert!(OrderLifecycle::Draft.can_transition_to(OrderLifecycle::Confirmed));
    assert!(!OrderLifecycle::Draft.can_transition_to(OrderLifecycle::Completed));
    assert!(OrderLifecycle::Confirmed.can_transition_to(OrderLifecycle::InProgress));
    assert!(OrderLifecycle::InProgress.can_transition_to(OrderLifecycle::Completed));
    assert!(OrderLifecycle::Completed.is_terminal());
    assert!(OrderLifecycle::Cancelled.is_terminal());
    assert!(!OrderLifecycle::Completed.can_transition_to(OrderLifecycle::Cancelled));
}

#[test]
fn invoice_body_is_immutable_after_posting() {
    assert!(InvoiceLifecycle::Draft.body_is_mutable());
    assert!(InvoiceLifecycle::Draft.can_transition_to(InvoiceLifecycle::Posted));
    assert!(!InvoiceLifecycle::Posted.body_is_mutable());
    assert!(InvoiceLifecycle::Posted.can_transition_to(InvoiceLifecycle::Reversed));
    assert!(!InvoiceLifecycle::Reversed.can_transition_to(InvoiceLifecycle::Draft));
}

#[test]
fn payment_lifecycle_supports_capture_refund_and_chargeback_without_arbitrary_reopen() {
    assert!(PaymentLifecycle::Pending.can_transition_to(PaymentLifecycle::Captured));
    assert!(PaymentLifecycle::Captured.can_transition_to(PaymentLifecycle::PartiallyRefunded));
    assert!(PaymentLifecycle::PartiallyRefunded.can_transition_to(PaymentLifecycle::Refunded));
    assert!(PaymentLifecycle::Captured.can_transition_to(PaymentLifecycle::Chargeback));
    assert!(!PaymentLifecycle::Refunded.can_transition_to(PaymentLifecycle::Captured));
}

#[test]
fn payment_allocation_never_exceeds_captured_funds() {
    assert_eq!(validate_payment_allocation(100_000, 25_000, 75_000).unwrap(), 100_000);
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
    assert_eq!(validate_refund(100_000, 20_000, 80_000).unwrap(), 100_000);
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
