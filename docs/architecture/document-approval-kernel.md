# Commercial Document and Approval Kernel V1

This kernel makes commercial documents explicit instead of treating every business
event as an editable transaction row.

## Document lifecycle

Supported document types cover sales, purchasing and service workflows:

- quotation, sales order, delivery, invoice and credit note;
- purchase requisition, RFQ, purchase order, goods receipt, vendor bill and debit note;
- service order and work order.

A document starts as `draft`. State transitions are explicit:

`draft -> issued -> posted`

Draft or issued documents may be voided with a reason. Posted documents are never
deleted or edited into another meaning; they are reversed through an explicit
reversal transition and compensating business document/link in later accounting
flows.

Document lines snapshot description, quantity, price, discount, tax and line total.
The document total is checked against subtotal - discount + tax. Links express
commercial lineage such as quote -> sales order -> delivery -> invoice and
purchase order -> goods receipt -> vendor bill.

## Approval policy

When a Business Profile uses `role_based` approval, issue/post/void/reverse actions
must consume an approved request. Rules match document type, action and minimum
amount, then snapshot the required role and approval count into the request.

Approvers cannot approve their own request. Decisions are append-only. A rejection
ends the request. Once the required number of distinct approvals is reached, the
request becomes approved and can be consumed exactly once by the matching document
transition.

For `owner_managed` profiles, authorized owner/manager roles can transition without
creating an approval request.

## Evidence and integration

Document links and approval decisions are append-only evidence. All commands are
tenant-scoped. Creation and approval-request commands are idempotent and request-hash
protected. Successful state transitions emit Business OS outbox events in the same
transaction.

This kernel is deliberately separate from tax calculation and double-entry general
ledger posting. Those domains can consume posted documents without making document
history mutable.
