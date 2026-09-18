#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TransactionStateError {
    InvalidTransition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
