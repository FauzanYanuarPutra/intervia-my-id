# Counterparty Linkage V1

This layer connects the Party master to commercial documents.

Rules:

- receivable sales require an active customer/both Party;
- payable purchases require an active supplier/both Party;
- cash/card sales and immediately-paid purchases may still carry an optional Party;
- AR/AP projections expose the Party ID so outstanding balances are explainable by counterparty;
- payment allocation currency and direction must match the target document;
- when a document has a Party, the payment must resolve to the same Party;
- Party role changes and archiving are guarded by runtime checks when historical/open documents depend on the role.

The database triggers are a last-line invariant. Application code must validate earlier
and return stable API errors rather than depending on trigger exceptions.
