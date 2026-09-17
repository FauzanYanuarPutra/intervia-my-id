# Lajukan Business OS V4 — Master Design

Date: 2026-09-17
Status: proposed implementation contract; requires user review before implementation planning
Scope: `frontend/apps/usaha`, `services/marketplace_service/src/businesses`, supporting identity/event/data boundaries, and future extractable business domains

## 1. Purpose

This document defines the target architecture for upgrading the existing Lajukan Usaha implementation into a complete, modular Business Operating System without rewriting the working foundations that already exist.

The product goal is deliberately ambitious: Lajukan Usaha should support a one-person microbusiness, a multi-employee outlet, a service business, a project business, a multi-branch operator, and eventually more complex companies without forcing every user to experience enterprise complexity.

The product principle is:

> Simple in front, disciplined behind.

A cashier should be able to press `Bayar`. A worker should be able to press `Masuk`. An owner should be able to see `Perlu perhatian`. Behind those actions, Lajukan must preserve correct state transitions, stock effects, financial effects, permissions, approvals, audit history, idempotency, and reversal history.

This design supersedes earlier Business OS planning where it conflicts with this document. Earlier documents remain useful historical records and compatibility references.

## 2. Current-state decisions that remain valid

The following decisions are retained:

1. `frontend/apps/www` is the public/discovery/consumer surface.
2. `frontend/apps/usaha` is the merchant and business operations surface.
3. `frontend/apps/crm` is an internal Lajukan command center, not the merchant CRM.
4. Identity and authentication remain owned by `identity_service`.
5. Canonical business state is persistent backend state, not `portal-store` or browser state.
6. Existing business profile, capability, governance, inventory, recipe, sales, settlement, finance-core, and audit work must be preserved unless a later migration explicitly replaces it.
7. Business-critical mutations use server-side authorization and database constraints; UI hiding is never considered authorization.
8. Applied database migrations are immutable. Fixes are new migrations.
9. Existing compatibility bridges may remain temporarily, but every bridge needs a documented retirement path.

## 3. Architectural strategy

### 3.1 Chosen approach

Use a domain-modular monolith for the Business OS inside the existing Rust backend boundary first, with explicit seams that allow later service extraction.

Do not immediately create a fleet of microservices. The current repository, deployment profile, and need for cross-domain transactional correctness favor a single deployable business backend with strong internal boundaries.

The target logical structure is:

```text
Lajukan ecosystem
|
+-- frontend/apps/www
|   +-- discovery
|   +-- marketplace/public storefront
|   +-- community/content
|   +-- consumer transactions
|
+-- frontend/apps/usaha
|   +-- Business OS shell
|   +-- POS mode
|   +-- owner/manager mode
|   +-- employee self-service mode
|   +-- field-service mode
|
+-- frontend/apps/crm
|   +-- internal Lajukan trust/KYC/moderation/support operations
|
+-- identity_service
|   +-- users
|   +-- sessions
|   +-- organizations
|   +-- identity-level membership
|
+-- marketplace_service
    +-- public marketplace domains
    +-- businesses/
        +-- core
        +-- parties
        +-- governance
        +-- catalog
        +-- sales
        +-- billing
        +-- payments
        +-- settlement
        +-- inventory
        +-- procurement
        +-- finance
        +-- workforce
        +-- cases
        +-- approvals
        +-- documents
        +-- projects
        +-- automation
        +-- advisor
```

The directory list is a target boundary, not a requirement to perform a big-bang file move before behavior is migrated.

### 3.2 Extraction rule

A business domain may become its own service only when one or more of these are true:

- it needs independent scaling;
- it has materially different availability/SLO needs;
- deployments are blocked by unrelated domains;
- a team can own it independently;
- its data ownership is already clean enough that extraction will not create distributed-transaction chaos.

Likely future extraction candidates are payments, accounting/finance, workforce/payroll, search, and automation. Extraction is not part of the first implementation wave.

## 4. Product surface and navigation

### 4.1 One business app, multiple modes

Do not create separate frontends for POS, HR, CRM merchant, accounting, or inventory.

`frontend/apps/usaha` remains the single Business OS frontend and can present role/capability-specific shells.

Examples:

```text
Owner/manager
  Hari Ini | Jual | Operasional | Stok | Uang | Relasi | Tim | Insight

Cashier
  POS | Pesanan | Shift Kas | Riwayat

Employee
  Hari Ini | Absensi | Jadwal | Cuti | Tugas | Expense | Slip Gaji

Field technician
  Hari Ini | Jadwal | Work Order | Parts | Customer | Expense
```

### 4.2 Progressive disclosure

Modules appear when the business needs them.

Examples:

- solo business: Hari Ini, Jual, Stok, Uang;
- first employee added: Tim appears;
- supplier workflow enabled: procurement appears;
- credit terms enabled: receivable/payable features appear;
- second branch added: branch views and inter-branch operations appear;
- advanced accounting enabled: journals and period controls become available to authorized users.

The backend always validates capability and permission even if the UI does not expose the feature.

### 4.3 Primary navigation

Default owner navigation:

1. Hari Ini
2. Jual
3. Operasional
4. Stok
5. Uang
6. Relasi
7. Tim
8. Insight
9. Pengaturan

Documents, cases, approvals, and automation are contextual surfaces and can also be reachable from a command palette/global search rather than permanently occupying top-level navigation for small businesses.

## 5. Organization, business, branch, and workspace model

These concepts are distinct and must never be conflated:

```text
Workspace / organization context
  -> Legal entity or operating organization
      -> Business / brand / operating unit
          -> Branch / location
              -> Warehouse / store / office / kiosk / service area
                  -> Register / department / team scope
```

A business record is the canonical tenant-level operating identity for Business OS data. Every business-critical row must be scoped by `organization_id` and `business_id`; branch/location scoped rows additionally use `location_id`.

The existing business/location/governance kernel remains the base and is extended additively.

## 6. Universal Party model

### 6.1 Why

Customer, supplier, employee, contractor, partner, tenant, student, member, technician, and reseller are roles of a person or organization, not necessarily separate identities.

### 6.2 Target model

```text
party
  id
  party_type: person | organization
  display_name
  legal_name?
  primary_contact fields
  status
  metadata

party_relationship
  party_id
  business_id
  relationship_type
  effective_from
  effective_until
  metadata
```

A single party may hold multiple relationships simultaneously.

The current `business_relationships` table is retained as a compatibility and migration source, then evolved toward this normalized model without inventing legal or employment facts.

### 6.3 Privacy boundary

Generic party/contact data must not automatically expose HR, payroll, KYC, or sensitive internal records. Sensitive domain records have separate permissions.

## 7. Catalog and universal item model

The current product/ingredient/recipe work is preserved but generalized so F&B is a pack rather than the universal schema.

Target concept:

```text
CatalogItem
  product
  service
  raw_material
  packaging
  spare_part
  supply
  rentable_asset_reference
```

A catalog item may have:

- variants;
- UoM;
- barcode/SKU;
- sellable/purchasable/stockable flags;
- pricing rules;
- tax configuration;
- costing policy;
- modifiers/configuration;
- recipe/BOM versions;
- media;
- channel availability.

Historical transactions store snapshots of relevant catalog data so later master-data edits cannot rewrite history.

## 8. Transaction Kernel

This is the highest-priority new subsystem.

### 8.1 Principle

Never use one status field to represent commercial, financial, fulfillment, and reconciliation state.

A business transaction is represented by related aggregates:

```text
Quotation
  -> Order
      -> Fulfillment(s)
      -> Invoice(s)
          -> Payment Allocation(s)
      -> Settlement(s)

Exception flows:
  -> Cancellation Case
  -> Return
  -> Refund
  -> Credit Note / Reversal
  -> Dispute
  -> Correction
```

### 8.2 Order states

Canonical order lifecycle:

```text
DRAFT
CONFIRMED
IN_PROGRESS
COMPLETED
CANCELLED
```

Transitions are commands with explicit guards. Services must not accept arbitrary `status = ...` updates.

### 8.3 Invoice states

Commercial/document lifecycle and payment status are not collapsed.

Invoice lifecycle:

```text
DRAFT
POSTED
REVERSED
VOIDED only when legally/operationally valid before posting rules require reversal
```

Invoice settlement state:

```text
UNPAID
PARTIAL
PAID
OVERPAID/CREDIT_BALANCE where applicable
OVERDUE is derived from due date + outstanding balance
```

Once posted, the invoice body is immutable. Corrections use credit/reversal documents and, when needed, a replacement invoice.

### 8.4 Payment states

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
EXPIRED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
CHARGEBACK
```

Payment events are provider-agnostic. Provider references, callback ids, signatures, and idempotency keys are retained.

### 8.5 Multiple allocations

The kernel must support:

- one invoice paid by several payments;
- one payment allocated to several invoices;
- partial payment;
- overpayment/credit balance;
- refund of part of a payment;
- split tender at POS;
- cash + QRIS + transfer on one order.

### 8.6 Fulfillment states

A generic fulfillment aggregate supports retail/F&B delivery while vertical workflows can add detail.

```text
PENDING
PREPARING
READY
DISPATCHED
DELIVERED
RETURNED/PARTIALLY_RETURNED derived through return records
CANCELLED
```

Service businesses may use work orders/projects instead of physical fulfillment but still link to the originating order/invoice.

## 9. Transaction Integrity Engine

A cross-domain validation layer must enforce invariants before committing business effects.

Core invariants include:

- tenant/business/branch scope consistency;
- currency consistency;
- order line totals equal canonical computed totals;
- posted invoices are immutable;
- payment allocations do not exceed captured funds except explicit credit semantics;
- refunds do not exceed refundable captured amount;
- returned quantity does not exceed fulfilled quantity;
- credit notes reference a valid source invoice;
- stock mutation is valid for the selected location;
- locked periods reject unauthorized backdating;
- actor permission and approval requirements are satisfied;
- provider transaction/callback references are not duplicated;
- a command with an existing idempotency key and different request hash is rejected.

Critical invariants must exist in both application logic and database constraints where feasible.

## 10. Cancellation, return, refund, and reversal semantics

These terms are deliberately distinct:

- cancellation: stop the business transaction or remaining obligation;
- return: goods/service deliverable is returned/rejected;
- refund: money is returned;
- reversal: accounting/ledger effect is reversed;
- correction: an erroneous posted fact is neutralized and optionally replaced;
- dispute: an unresolved disagreement requiring case handling.

The UI may present one guided action, but the backend executes the necessary combination.

Example paid, delivered order cancellation after return approval:

```text
open cancellation/return case
-> approve return
-> receive returned stock
-> issue credit/reversal document
-> refund eligible captured payment
-> reverse COGS/revenue effects
-> update settlement
-> generate BA if policy requires
-> append audit events
```

No important historical transaction is hard-deleted.

## 11. Case Management Engine

All non-routine operational exceptions use one case engine.

Supported case types include:

- cancellation;
- return/refund;
- complaint;
- stock discrepancy;
- cash discrepancy;
- wrong transaction/payment;
- damaged/lost/expired goods;
- attendance correction;
- supplier dispute;
- customer dispute;
- delivery failure;
- quality incident;
- employee/internal incident;
- fraud suspicion;
- asset incident;
- maintenance incident.

Canonical lifecycle:

```text
OPEN
INVESTIGATING
WAITING_APPROVAL
APPROVED | REJECTED
EXECUTING
RESOLVED
CLOSED
```

A case contains evidence references, timeline, comments, assigned owner, financial impact, inventory impact, related entities, approval history, resolution, and generated documents.

The case engine records facts and workflow decisions. It does not infer legal liability, employee fault, theft, or debt from operational discrepancies.

## 12. Approval Engine

Approval is centralized rather than reimplemented per module.

A rule evaluates:

```text
action + amount/value + actor role + branch + category + risk/context -> approval path
```

Capabilities:

- sequential approvals;
- parallel approvals;
- amount thresholds;
- maker-checker separation;
- branch-scoped approvers;
- delegation with expiry;
- escalation;
- rejection reason;
- approval expiry;
- full audit.

Examples:

- refund above Rp1,000,000 -> manager/owner;
- stock adjustment above configured value -> inventory manager + owner;
- purchase above threshold -> manager + finance/owner;
- payroll run -> HR prepares, authorized approver approves;
- locked-period correction -> accountant/owner.

## 13. Document Engine

Business documents share a common metadata and versioning engine.

Document types include:

- quotation;
- sales order confirmation;
- invoice;
- receipt;
- credit note;
- payment receipt;
- purchase order;
- goods receipt/delivery note;
- work order;
- BA;
- payslip;
- contract/agreement;
- asset handover;
- customer acceptance.

Common fields:

```text
id
organization_id
business_id
location_id?
document_type
document_number
version
status
issued_at
effective_at
source_type
source_id
content_hash
generated_by
frozen_at?
```

Numbers are never reused after issuance. Frozen documents are immutable. A correction produces a new version/revision or a related corrective document, according to document type.

BA is an output of a case/workflow, not an isolated feature.

## 14. Document sequences

Each business can configure document prefixes while preserving uniqueness.

Examples:

```text
QT-2026-000001
SO-2026-000001
INV-2026-000001
PAY-2026-000001
RFD-2026-000001
CN-2026-000001
PO-2026-000001
GRN-2026-000001
BA-2026-000001
```

Sequence allocation occurs at the lifecycle point where a permanent external number is needed; drafts may use internal UUIDs until issuance/posting.

## 15. Inventory Kernel V4

The existing branch inventory kernel and append-only movement pattern remain authoritative principles.

### 15.1 Quantities

Expose at least:

```text
on_hand
reserved
available = on_hand - reserved
incoming
```

For supported domains, additional derived states may include in-transit and quality-hold quantities.

### 15.2 Movement types

Canonical movement families:

```text
PURCHASE_RECEIPT
SALE_CONSUMPTION
TRANSFER_OUT
TRANSFER_IN
RETURN_IN
RETURN_OUT
PRODUCTION_CONSUMPTION
PRODUCTION_OUTPUT
WASTE
DAMAGE
EXPIRY
LOSS
ADJUSTMENT
STOCKTAKE_ADJUSTMENT
```

Movements are append-only. Corrections use compensating movements.

### 15.3 Reservation

Orders can reserve stock without immediately reducing `on_hand`. Reservation release/consumption is transactionally connected to order/fulfillment state.

### 15.4 Negative stock policy

Business profile/capability policy controls behavior:

- deny;
- controlled override with permission/reason;
- allow only for explicitly configured business types.

Default remains fail closed.

### 15.5 Optional traceability

Lot, batch, serial, and expiry tracking are optional capabilities, not mandatory columns on every small-business flow.

## 16. F&B and recipe/BOM pack

The current recipe, versioning, modifier, COGS, sealed-BOM, and yield work is preserved.

Recipe/BOM version used by a sale is snapshotted/referenced immutably so historical COGS does not change when a recipe changes.

A configured product can consume ingredients and packaging. Modifiers can change ingredient consumption and price.

Waste is inventory movement, never a fake sale.

Yield observations remain operational evidence and can feed suggested costing; they do not rewrite historical consumption automatically.

The generic BOM/production model can later serve light manufacturing while F&B presents simpler terminology.

## 17. Procurement

Procurement completes the supplier-to-stock-to-payable flow.

Core objects:

```text
PurchaseRequest optional
RFQ optional
SupplierQuote optional
PurchaseOrder
PurchaseOrderLine
GoodsReceipt
GoodsReceiptLine
VendorBill / supplier invoice
Payable allocation/payment
SupplierReturn
```

Required behavior:

- partial receiving;
- short/over delivery handling;
- backorder/remaining quantity;
- purchase price snapshot;
- branch/warehouse destination;
- supplier return;
- payable linkage;
- three-way matching as an advanced capability: PO vs receipt vs vendor bill;
- idempotent receiving.

Receiving physical stock and recognizing a financial obligation are related but separate business facts.

## 18. POS

POS is a mode inside `apps/usaha`, not a separate product boundary.

Online-first V1 capabilities:

- touch-friendly product grid/search;
- barcode support where enabled;
- product modifiers;
- customer selection;
- hold/resume order;
- discount with permission policy;
- split tender;
- cash/QRIS/transfer/other configured methods;
- receipt;
- return/refund routed through the transaction/case engine;
- branch/register context;
- cash shift linkage.

Offline POS is a later capability after command idempotency and synchronization contracts are proven online.

## 19. Cash Shift and register control

The existing cash shift model is retained and expanded.

A register shift records:

- opening cash;
- cash sales;
- cash refunds;
- cash in/out;
- expected closing cash;
- actual counted cash;
- variance;
- opener/closer;
- branch/register;
- evidence/note.

A non-zero variance creates or can create a cash discrepancy case based on policy. The expected balance must never be edited merely to match the actual count.

## 20. Finance Core to Accounting Core

The existing Finance Core correction/reversal/idempotency model is retained as a strong operational-ledger foundation.

### 20.1 Separation of layers

```text
Operational subledgers
  sales
  payments
  inventory valuation
  receivable/payable
  payroll

Accounting projection
  chart of accounts
  journal entries
  general ledger
  trial balance
  financial statements
```

Users who do not need accounting terminology see simplified money views. The backend still maintains consistent postings when accounting mode is enabled.

### 20.2 Double entry

Posted accounting entries are balanced and immutable. Corrections use reversal and replacement entries.

Examples:

```text
Cash sale
Dr Cash
Cr Sales Revenue

COGS recognition
Dr COGS
Cr Inventory
```

Exact postings depend on configured accounting policy and are not embedded in UI code.

### 20.3 Period control

Accounting periods support:

```text
OPEN
SOFT_LOCKED
HARD_LOCKED
```

Backdated postings into locked periods require explicit authority/workflow. Unlock actions are temporary, scoped, reasoned, and audited.

### 20.4 Reconciliation

Support reconciliation for:

- payment to invoice;
- bank/cash statement to recorded transactions where connectors/imports exist;
- receivable/payable balances;
- marketplace settlement to underlying orders/fees/refunds.

## 21. Workforce and HR operations

Workforce is a new Business OS domain built on party/business relationships and governance; it does not create a second user identity system.

Core objects:

```text
EmployeeProfile
Employment
Position
Team/Department
ShiftTemplate
ShiftAssignment
AttendanceEvent
AttendanceCorrectionCase
LeaveType
LeaveBalance
LeaveRequest
OvertimeRecord
Timesheet
CommissionRecord
ExpenseClaim
EmployeeLoan/Advance optional
PayrollComponent
PayrollRun
Payslip
CompanyAssetAssignment
```

Sensitive records use separate permissions from generic party/contact access.

## 22. Attendance

Attendance is event-based.

Canonical events:

```text
CLOCK_IN
BREAK_START
BREAK_END
CLOCK_OUT
```

Optional channels:

- web/mobile;
- kiosk PIN;
- QR;
- managed device;
- optional location/photo evidence according to business policy and applicable privacy requirements.

Shift evaluation derives late arrival, early departure, working duration, and overtime candidates. Derived results are not silently rewritten when raw events are corrected.

Attendance corrections are cases/requests with reason, original event, approved replacement/adjustment, actor, approver, and audit.

Attendance and timesheets remain separate: attendance proves presence/time boundary; timesheet records time spent on work/project activities.

## 23. Leave, overtime, payroll, commission, reimbursement

### Leave

Supports configured leave types, balances, accrual/manual grant policies, requests, approvals, attachments, and calendar effects.

### Overtime

Overtime can be derived/proposed from attendance but requires the configured approval/policy before payroll impact.

### Payroll

Payroll lifecycle:

```text
DRAFT
CALCULATED
REVIEWED
APPROVED
PAID
LOCKED
```

Components can include salary, allowances, overtime, commission, bonus, deductions, loans/advances, reimbursement, tax, and statutory/localization components.

Country-specific payroll/tax rules are localization modules and must not be hardwired into the universal kernel.

### Expense/reimbursement

```text
employee submits expense
-> evidence/receipt
-> manager approval
-> finance approval when required
-> reimbursement payment
-> finance/accounting effect
```

A reimbursed expense must not be manually entered again into finance as a duplicate cost.

## 24. Merchant CRM and relationship management

Merchant CRM belongs inside `apps/usaha`, separate from internal Lajukan CRM.

Core flow:

```text
Lead
-> Opportunity
-> Quotation
-> Order
-> Customer
-> Support/Case
-> Retention/Repeat
```

Party timeline unifies relevant interactions:

- notes;
- tasks;
- quotations;
- orders;
- invoices;
- payments;
- complaints/cases;
- messages/connectors where available;
- tags/segments;
- consent/preferences.

Supplier relationship views can expose price history, delivery performance, quality/return rates, and payment terms.

## 25. Projects and service operations

### Project pack

Core objects:

```text
Project
Milestone
Task
Assignment
Timesheet
Expense
CustomerApproval
MilestoneBilling
```

### Field service pack

```text
Appointment
WorkOrder
TechnicianAssignment
Travel/arrival status optional
PartsUsed
WorkLog
CustomerAcceptance
Warranty
Invoice
BA
```

### Laundry/service workflow pack

Vertical packs may define additional workflow states but must link to universal order, party, payment, document, and case primitives rather than reinventing them.

## 26. Asset and rental management

Assets support:

- acquisition/reference cost;
- business/branch ownership;
- assignment/custodian;
- condition;
- maintenance schedule;
- repair history;
- warranty;
- transfer;
- retirement/disposal.

Rental capability adds reservation, checkout, deposit, return condition, extension, late charge, damage case, and deposit refund.

Accounting depreciation is optional and belongs to accounting/localization policy.

## 27. Subscription and recurring business

Subscription capability supports:

- plan;
- billing interval;
- start/end;
- trial;
- renewal;
- pause;
- upgrade/downgrade;
- proration policy;
- recurring invoices;
- failed-payment handling;
- suspension/cancellation/expiry.

Recurring billing always creates normal invoice/payment records; it does not maintain a hidden parallel money model.

## 28. Quality and maintenance

Optional capabilities:

### Quality

- inspection plans/checks;
- pass/fail;
- nonconformance case;
- hold/release;
- rework/reject;
- supplier quality evidence.

### Maintenance

- preventive schedule;
- corrective work order;
- downtime;
- parts consumption;
- cost;
- asset linkage.

## 29. Universal Task and Timeline engines

Tasks are reusable across domains.

Examples:

- follow up customer;
- count stock;
- collect overdue invoice;
- approve leave;
- repair freezer;
- renew contract;
- perform maintenance;
- review refund.

A timeline component renders business events, comments, documents, cases, and tasks for supported entities without duplicating timeline logic in every module.

## 30. Automation Engine

Automation is event-driven and permission-aware.

Model:

```text
Trigger
+ Conditions
+ Actions
+ Execution policy
+ Audit
```

Examples:

- low available stock -> create purchase suggestion + notify responsible role;
- invoice overdue 7 days -> create collection task;
- employee late 3 times in configured window -> notify supervisor, not auto-punish;
- contract nearing expiry -> renewal task;
- failed integration -> action alert.

Automation actions run through normal domain commands. Automation cannot bypass authorization, invariants, or approval requirements.

Execution requires idempotency, retry limits, backoff, dead-letter/error visibility, and run history.

## 31. Notification and Action Inbox

Notification severities:

```text
INFO
ACTION
WARNING
CRITICAL
```

The owner experience prioritizes an action inbox rather than a flood of raw notifications.

Examples:

```text
Perlu perhatian
- 3 invoice overdue
- 1 refund waiting approval
- 2 products near stockout
- 1 cash shift variance
- 2 employees missing clock-out
- 1 failed marketplace settlement reconciliation
```

Channels can later include in-app, email, WhatsApp/SMS connectors, but channel delivery is separate from the source domain fact.

## 32. Search and command palette

Provide global search over authorized business records such as parties, orders, invoices, products, suppliers, cases, documents, projects, and employees.

Desktop command palette (for example `Ctrl/Cmd + K`) can expose safe quick actions:

- create sale;
- open POS;
- add customer;
- create PO;
- find invoice;
- submit expense;
- clock in when allowed.

Search results and commands always respect business/branch/role permissions.

## 33. Business templates and capabilities

Templates configure defaults; capabilities control functionality.

Target packs include:

- General;
- F&B;
- Retail/Mart;
- Wholesale/Distribution;
- Laundry;
- Field Service/AC;
- Workshop/Automotive;
- Salon/Appointment Service;
- Agency/Professional Service;
- Project/Contractor;
- Rental;
- Property/Tenant;
- Subscription;
- Membership/Gym;
- Education/Course;
- Light Manufacturing;
- Agriculture/Batch Production;
- Logistics;
- Event;
- Digital Product;
- Franchise;
- Consignment.

Templates never fork the product into separate codebases. They enable capabilities, terminology, defaults, workflow presets, reports, and document templates.

## 34. Integration Hub

External integrations use a consistent connector model.

Potential categories:

- payment gateways/QRIS;
- banks/imported statements;
- GoFood/GrabFood/ShopeeFood or other marketplaces where supported;
- messaging;
- shipping/courier;
- tax/e-invoicing localization;
- accounting export/import;
- webhooks/API clients.

Each connection tracks:

```text
provider
business scope
credentials reference
mode: sandbox | production
status
last_success_at
last_failure_at
sync cursor
webhook verification config
```

Secrets are not stored in normal business metadata or frontend state.

Inbound webhooks require signature verification where supported, idempotency, replay protection, durable processing, retry/error visibility, and raw-reference retention according to security policy.

## 35. Environment separation

Development, staging/sandbox, and production are separate operational environments.

Do not rely on an `is_test` flag as the primary isolation mechanism.

Sandbox must prevent real side effects by default:

- use test payment credentials;
- sink or clearly label external messaging;
- never mutate production stock/finance;
- never create real payouts.

If test data is accidentally created in production, it is corrected/reversed with an explicit reason such as `TEST_DATA_CREATED_IN_PRODUCTION`; important posted history is not silently deleted.

## 36. Idempotency and concurrency

All financially or operationally material commands that may be retried require idempotency.

Required areas include:

- order submission where client/network retries are possible;
- payment callbacks/capture/refund;
- finance corrections;
- stock mutations;
- purchase receiving;
- payroll payout commands;
- automation actions;
- offline synchronization later.

Pattern:

```text
business_id + idempotency_key + canonical request hash
```

Same key + same request returns the original result. Same key + materially different request returns conflict.

Use database locking/version checks to prevent lost updates. Existing version columns and row-locking patterns should be extended rather than bypassed.

## 37. Event and outbox architecture

Important mutations commit domain state and outbox event in the same database transaction.

```text
begin transaction
  validate command
  write domain state
  write audit
  write outbox event
commit

relay
  publish event
  mark delivered/retry
```

External network side effects must not occur before source-of-truth commit.

Canonical event naming examples:

```text
business.created
sales.order.confirmed
billing.invoice.posted
payments.payment.captured
payments.refund.completed
inventory.stock.reserved
inventory.movement.posted
procurement.po.issued
procurement.receipt.posted
finance.entry.posted
cases.case.opened
approvals.request.approved
workforce.attendance.clocked_in
workforce.leave.approved
payroll.run.approved
documents.document.frozen
```

Events include event id, schema version, occurred time, actor, tenant scope, entity identifiers, correlation/request id, and minimal domain payload/reference.

## 38. Audit architecture

Business audit remains append-only.

Material events record as applicable:

```text
actor_user_id
organization_id
business_id
location_id
request_id/correlation_id
event_key
subject_type
subject_id
reason
metadata
timestamp
```

Audit is not a substitute for domain ledgers. Finance has a finance ledger/corrections; inventory has movements; attendance has events. Audit records who/what/why across those domain facts.

An entity/case should eventually be exportable as an audit trace bundle for support/compliance investigation.

## 39. Data type rules

### Money

Use integer minor units where currency precision permits or exact decimal where multi-currency precision requires it. Never use binary floating point for money.

All money records include currency. Exchange rates, when implemented, are effective-dated and snapshotted for transactions.

### Quantity

Use exact numeric/decimal types with explicit UoM. Conversions are versioned/configured and never depend on display strings.

### Time

Persist instants as timezone-aware timestamps/UTC-equivalent database values and store business/location timezone configuration separately. Distinguish:

- created_at;
- occurred_at/effective_at;
- posted_at;
- due_at;
- business date where required.

## 40. Snapshots and historical truth

Transaction lines retain relevant snapshots:

- item/product/service name;
- SKU/barcode where relevant;
- UoM;
- unit price;
- discounts;
- tax/service-charge configuration;
- cost/COGS source/version where applicable;
- modifier/configuration;
- recipe/BOM version;
- customer/supplier display identity when legally/operationally needed.

Master-data changes do not rewrite historical transaction meaning.

## 41. Security and authorization

### Authentication

Continue using Identity-backed sessions. Frontend routes never trust actor ids from request bodies.

### Authorization

Use role + permission + scope.

Examples:

```text
inventory.view @ branch Ciputat
inventory.manage @ branch Ciputat
refund.request @ business
refund.approve with configured threshold
payroll.view @ authorized HR role
finance.manage @ business
```

Permissions are enforced server-side.

### Sensitive action controls

High-risk operations require combinations of:

- re-authentication/step-up in future where justified;
- mandatory reason;
- maker-checker;
- approval;
- immutable audit;
- amount/value threshold;
- branch scope.

### Privacy

Payroll, employee documents, sensitive customer data, KYC, and legal records are not exposed through generic business roles without explicit permission.

## 42. AI Business Advisor

AI is an intelligence layer, not a source of truth.

Advisor inputs can include authorized read models for:

- sales/margin;
- inventory health;
- procurement;
- finance/cashflow;
- receivable/payable;
- customer behavior;
- workforce operations;
- branch comparisons.

Example outputs:

- `Mangga diperkirakan habis dalam 2 hari.`
- `Margin Jus Alpukat turun karena biaya bahan naik.`
- `Cabang Bintaro mengalami tiga cash variance minggu ini.`
- `Invoice Rp4,2 juta jatuh tempo besok.`

AI may explain, summarize, forecast, suggest, or draft safe actions. It must not directly post journal entries, move stock, issue payroll, refund money, change roles, or approve sensitive actions. Those go through normal domain commands and approvals.

Every consequential AI suggestion/action request should carry model/policy version and reason/context sufficient for audit/debugging.

## 43. Analytics and KPI semantic layer

Dashboards should read optimized read models rather than repeatedly running expensive ad-hoc OLTP joins.

Initial read models can include:

- daily_sales;
- product_performance;
- branch_performance;
- cash_position;
- receivable_aging;
- payable_aging;
- inventory_health;
- supplier_performance;
- employee_attendance_summary;
- pending_approvals;
- unresolved_cases.

Metric definitions are centralized. At minimum distinguish:

```text
Gross Sales
Cancelled Sales
Returns
Discounts
Net Sales
Invoiced Amount
Cash Collected
Outstanding Receivable
Refunds
COGS
Gross Profit
Operating Expense
Cash Movement
```

The word `omzet` in user-facing UI must map to a documented metric definition.

## 44. Reliability and observability

Every backend request/command should be traceable with identifiers such as:

- request/correlation id;
- actor;
- business;
- branch;
- operation;
- duration;
- outcome/error code.

Operational monitoring should cover:

- 5xx/error rate;
- slow queries;
- outbox backlog/failures;
- webhook failures;
- payment reconciliation mismatches;
- unclosed cash shifts;
- automation failures;
- inventory anomalies;
- failed migration/startup checks.

Retries must be bounded and visible; poison work goes to a dead-letter/error state rather than retrying forever.

## 45. Database integrity

Business integrity is enforced with PostgreSQL constraints and transactions wherever practical:

- foreign keys for tenant/entity relationships;
- unique constraints for sequence/idempotency/reference uniqueness;
- checks for valid state/data ranges;
- append-only triggers for ledgers/audits where appropriate;
- version fields/optimistic concurrency for mutable aggregates;
- row locks for contested balance/state updates;
- no cascade behavior that can erase material financial/audit history without explicit design.

`ON DELETE CASCADE` is acceptable for clearly disposable configuration children but must be reviewed for any table representing issued documents, finance, payment, inventory movement, payroll, case, or audit history.

## 46. Migration discipline and schema evolution

Applied migration files are immutable.

Rules:

1. Never modify a migration already applied in any shared environment.
2. Fixes use a later migration.
3. Additive/backfill/compatibility phases precede destructive cleanup.
4. Every compatibility bridge has a removal criterion.
5. Data backfills are idempotent or guarded.
6. High-risk down migrations fail closed rather than erase truthful history.
7. Empty-database migration tests remain mandatory.
8. CI checks migration immutability.

The previously observed development migration drift around the finance migration is treated as a process failure to prevent, not a normal workflow.

## 47. Legacy cleanup strategy

### 47.1 `portal-store`

No new production business feature may depend on the in-memory `portal-store`.

Before removal:

- identify every import/caller;
- map each caller to canonical Identity/Marketplace/Business API;
- migrate route-by-route;
- preserve demo fixtures separately if demos are still required;
- remove the source only after no production path depends on it.

### 47.2 Stale frontend documentation

`docs/frontend-usaha-reference.md` documents an earlier demo-first state and should be regenerated after the canonical-data migration is complete. It must not be treated as the current source of truth where it conflicts with code or this design.

### 47.3 Compatibility columns/tables

Legacy store metadata, primary-stock projections, legacy owner fields, and compatibility routes are retired only after current callers and production data have migrated and contract tests prove equivalence.

## 48. Testing strategy

Every new domain must have the appropriate layers:

- pure domain/state-machine unit tests;
- authorization tests;
- idempotency tests;
- persistence/integration tests against PostgreSQL;
- migration tests;
- API contract tests;
- cross-domain workflow tests;
- frontend behavior/e2e tests for critical flows.

### 48.1 Transaction matrix

At minimum test:

- unpaid order cancellation;
- partial payment;
- multiple payments;
- overpayment/credit;
- paid order cancellation/refund;
- partial refund;
- shipped/delivered return;
- partial return;
- duplicate provider webhook;
- conflicting idempotency reuse;
- locked-period correction;
- unauthorized branch action;
- concurrent payment/stock actions.

### 48.2 Invariant/property tests

Good candidates:

- total refund never exceeds refundable captured amount;
- returned quantity never exceeds fulfilled quantity;
- inventory available = on_hand - reserved under defined projection rules;
- a correction never destroys the original finance/document fact;
- balanced accounting postings remain balanced;
- same idempotent command never creates a second business effect.

## 49. Frontend architecture rules

`apps/usaha` uses server-backed data adapters and domain-oriented feature modules.

Rules:

- no business-critical truth in localStorage/globalThis;
- route components do not implement finance/inventory state transitions directly;
- shared tables/forms use typed domain contracts;
- capability visibility is centralized;
- authorization errors are handled explicitly, not converted into empty-state success;
- destructive-looking actions call guided corrective workflows;
- important forms show preview/impact before irreversible posting/reversal;
- mobile/employee/POS shells share domain clients rather than duplicate business logic.

The frontend may maintain optimistic UI only when the command contract safely supports it.

## 50. Error handling and UX semantics

Errors use stable machine codes plus localized human text.

Examples:

```text
AUTH_REQUIRED
PERMISSION_DENIED
BUSINESS_NOT_FOUND
BRANCH_SCOPE_DENIED
INVALID_STATE_TRANSITION
IDEMPOTENCY_CONFLICT
PERIOD_LOCKED
INSUFFICIENT_AVAILABLE_STOCK
REFUND_EXCEEDS_CAPTURED_AMOUNT
VERSION_CONFLICT
APPROVAL_REQUIRED
```

The UI distinguishes:

- validation issue the user can fix;
- approval required;
- conflict/stale data requiring refresh;
- provider/network temporary failure;
- internal system failure.

No generic `something went wrong` should replace actionable domain errors on core business operations.

## 51. Offline and synchronization future design

Offline POS/field operations are explicitly deferred until online commands are idempotent and branch state contracts are stable.

When enabled, offline clients use:

- device identity;
- local durable queue;
- client-generated command ids/idempotency keys;
- server conflict rules;
- sync status visible to user;
- no local authority to rewrite posted server history.

Offline capability starts with narrow POS sale capture, not arbitrary offline ERP mutation.

## 52. Localization architecture

Country-specific requirements are localization packs around the universal kernel.

Examples:

- tax rules;
- statutory payroll;
- BPJS-like components;
- e-invoice/fiscal documents;
- local holidays;
- legal document templates.

Localization modules may configure rules and generated documents but do not fork core transaction semantics.

## 53. Data export, retention, and recovery

Business customers need durable ownership/portability controls.

Target capabilities:

- scoped export of business master data and transaction history;
- document export;
- audit trace export for authorized roles;
- backup/PITR for PostgreSQL production;
- object/document backup;
- tested restore procedure;
- configurable/legal retention policy where necessary.

Deletion requests for master/personal data must distinguish deletable personal/configuration data from legally/financially required immutable transaction records.

## 54. Vertical-pack mapping

### F&B

POS, products, recipes/BOM, ingredients, modifiers, yield, waste, stock, supplier, purchase, cash shift, attendance.

### Retail/Mart

POS, barcode, variants, stock, batch/expiry optional, supplier, purchase, return, cash shift.

### Wholesale/Distribution

quotation, tier/pricelist, sales order, reservation, warehouse, delivery, receivable, supplier, procurement, backorder.

### Laundry

customer intake, item/weight, processing workflow, ready/pickup/delivery, payments, complaints/cases.

### Field Service/AC

CRM, appointment, work order, technician, route/location, parts, customer acceptance, BA, warranty, invoice/payment.

### Workshop

customer/vehicle asset, booking, job card/work order, mechanic, parts, service history, invoice, warranty.

### Salon/Appointment

customer, booking, resource/staff calendar, service catalog, commission, POS/payment.

### Agency/Professional Service

lead, quotation, project, task, timesheet, retainer/milestone, expense, invoice/payment.

### Contractor

project, milestone, BOQ/reference items, procurement, progress acceptance, progress billing, retention rules as configured.

### Rental

asset, reservation, deposit, checkout condition, extension, late fee, return condition, damage case, deposit refund.

### Property/Tenant

property/unit, tenant party, contract, recurring billing, receivable, maintenance cases.

### Subscription/Membership

plan, member/customer, recurring billing, renewal, pause, upgrade/downgrade, access status.

### Education/Course

student party, class, schedule, attendance variant, billing, instructor relationship.

### Light Manufacturing

BOM, material inventory, production order, consumption/output, QC, waste, costing.

### Agriculture

production batch/cycle, inputs, harvest/yield, inventory, supplier/buyer, costing.

### Logistics

shipment/work order, driver relationship, route/status, POD, COD settlement, expense.

### Event

event, capacity, ticket/order, check-in, vendor/expense, settlement.

### Digital Product

catalog item, order/payment, entitlement/license, subscription optional; no physical stock.

### Franchise

multi-business/branch governance, central catalog/policy, royalty/fee rules, central procurement optional.

### Consignment

party ownership of stock, consignment inventory, sales attribution, settlement/payable to consignor.

## 55. Implementation decomposition

This master design is too large for one implementation plan. Implementation must be decomposed into independently reviewable specs/plans while preserving this architecture.

Mandatory order:

### Wave 0 — Foundation hardening

- map and remove production dependency on in-memory `portal-store`;
- document canonical source of truth;
- clean business module boundaries without behavior rewrite;
- enforce migration immutability/drift checks;
- standardize command/idempotency/audit helpers;
- establish shared money/time/tenant conventions;
- define Party migration design.

### Wave 1 — Transaction Kernel

- order state machine normalization;
- invoices;
- payment records and allocations;
- settlement semantics;
- returns/refunds/corrections;
- transaction integrity rules;
- snapshots and sequences;
- compatibility with current sales/public commerce.

### Wave 2 — Case, Approval, Document engines

- generic case model;
- approval policies and maker-checker;
- universal document metadata/numbering;
- BA templates and frozen document output;
- correction/cancellation workflows.

### Wave 3 — Universal Inventory + Procurement

- generic item/material compatibility;
- reservations;
- purchase order/receiving/vendor bill;
- transfers;
- supplier returns;
- optional lot/serial/expiry foundation.

### Wave 4 — Accounting Core

- chart of accounts;
- posting rules;
- journal/general ledger;
- period lock;
- reconciliation;
- financial statements/read models;
- migration from operational finance semantics without destroying history.

### Wave 5 — Workforce

- employee/employment;
- shifts;
- attendance;
- leave/overtime;
- expenses/commission;
- payroll and payslips;
- employee self-service shell.

### Wave 6 — Merchant CRM + Project/Service

- Party-based customer/supplier CRM;
- lead/opportunity;
- tasks/timeline;
- project/timesheet;
- work order/field service;
- customer acceptance/warranty.

### Wave 7 — Vertical packs

- F&B polish;
- retail;
- laundry;
- field service;
- agency/project;
- rental/subscription;
- other packs based on validated demand.

### Wave 8 — Automation + AI

- automation rules/runtime;
- action inbox;
- read models/KPI layer;
- AI advisor with strict command guardrails.

### Wave 9 — Scale/advanced capability

- offline POS;
- richer integrations;
- selective service extraction;
- advanced warehouse/manufacturing/localization.

Each wave receives its own implementation plan, test matrix, migration strategy, and completion gate. No wave is allowed to bypass invariants merely to ship faster.

## 56. Rollout and compatibility policy

Prefer expand-and-contract migrations:

```text
add new schema/API
-> dual-read or compatibility projection where needed
-> backfill
-> switch canonical callers
-> verify parity/invariants
-> stop legacy writes
-> remove bridge in later migration
```

Avoid flag days and destructive rewrites.

Existing public marketplace order flows must continue working while Business OS transaction semantics evolve. Adapter layers may map legacy public commerce events into the new kernel until consumers migrate.

## 57. Definition of done for the Business OS architecture

The architecture is considered successfully established when all of these are true:

1. `apps/usaha` is the only merchant Business OS frontend and no production flow depends on in-memory business truth.
2. Business data has clear tenant/branch ownership.
3. Order, invoice, payment, fulfillment, settlement, return/refund, and correction have explicit independent lifecycles.
4. Posted finance/documents/inventory history cannot be silently rewritten.
5. Every retryable material command is idempotent.
6. Case/approval/document engines are reused across domains rather than copied.
7. Employee attendance/payroll and merchant CRM reuse Party/governance instead of inventing separate identities.
8. Accounting can project operational facts without corrupting existing finance history.
9. Business packs activate capabilities without forking the product.
10. Critical workflows have database constraints, authorization tests, persistence tests, and cross-domain integration tests.
11. Audit, events, and observability allow a material business action to be traced end-to-end.
12. The default UI remains usable by a small non-accountant/non-technical business owner.

## 58. Explicit non-goals for the first implementation cycle

To prevent the total redesign from becoming an unsafe big-bang rewrite, the first cycle will not:

- split Business OS into many microservices;
- rewrite all working recipe/inventory/finance code just to rename concepts;
- implement every vertical pack at once;
- implement offline POS before online command contracts are stable;
- auto-execute high-risk AI actions;
- replace Identity with a second merchant account system;
- delete old production data or historical migrations to make schemas look cleaner;
- expose full accounting complexity to every user.

These are constraints on sequencing, not reductions of the final product ambition.

## 59. Key risks and mitigations

### Risk: marketplace_service becomes a god service

Mitigation: hard internal domain boundaries now; extraction seams later; no new Business OS logic in giant generic handlers/main.rs.

### Risk: existing F&B implementation overfits universal design

Mitigation: keep F&B adapters/packs while adding generic Party/Item/Transaction primitives incrementally.

### Risk: finance/accounting rewrite corrupts historical meaning

Mitigation: retain append-only finance history; project/migrate additively; use explicit reversal/reclassification instead of history rewrite.

### Risk: too many features make UI unusable

Mitigation: progressive disclosure, role-based shells, capability packs, action-first dashboard, global search/command palette.

### Risk: authorization gaps during modular growth

Mitigation: shared tenant/permission guard helpers, branch-scoped persistence tests, deny-by-default sensitive permissions.

### Risk: migration drift

Mitigation: migration immutability CI, fresh-database tests, shared-environment checks, forward-only fixes.

### Risk: integrations create duplicate effects

Mitigation: verified webhooks, idempotency keys, request hashes, inbox/outbox patterns, replay-safe commands.

### Risk: total overhaul causes prolonged unstable main

Mitigation: implementation waves are additive and independently green; every commit/merge to main must keep defined CI/runtime contracts green. The target is a total architectural upgrade, not a single destructive rewrite commit.

## 60. Final architecture decision

Proceed with `frontend/apps/usaha` as the permanent Lajukan Business OS frontend.

Preserve and evolve the working canonical business, governance, inventory, recipe/COGS, sales, settlement, finance-core, and audit foundations.

Build the next architecture around a universal Party model, Transaction Kernel, Case Engine, Approval Engine, Document Engine, universal inventory/procurement, Accounting Core, Workforce, merchant CRM, projects/services, business capability packs, automation, analytics, and guarded AI advisor.

Keep the backend deployable as a modular monolith first, with future service extraction based on proven operational need.

The implementation sequence starts with Foundation Hardening and Transaction Kernel. All later domains depend on those contracts.