#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TransactionStateError {
    InvalidTransition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OrderState {
    Draft,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
}

impl OrderState {
    pub(crate) const fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Draft, Self::Confirmed)
                | (Self::Draft, Self::Cancelled)
                | (Self::Confirmed, Self::InProgress)
                | (Self::Confirmed, Self::Completed)
                | (Self::Confirmed, Self::Cancelled)
                | (Self::InProgress, Self::Completed)
                | (Self::InProgress, Self::Cancelled)
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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
