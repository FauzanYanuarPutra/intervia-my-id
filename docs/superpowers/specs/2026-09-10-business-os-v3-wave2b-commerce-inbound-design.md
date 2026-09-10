# Lajukan Business OS V3 Wave 2B — WWW Commerce Inbound Design

## Status
Approved architectural continuation of Lajukan Business OS V3 Wave 2.

## Goal
Close the public-to-merchant commerce loop:

`WWW product/business detail -> buyer action -> canonical commerce record -> Usaha operational inbox -> merchant processing -> payment/fulfillment/sale/customer/reporting`

Wave 2A already made Usaha catalog and availability trustworthy on WWW. Wave 2B completes the reverse direction so public demand is no longer disconnected from merchant operations.

## Context
The repository already contains a generic Marketplace order engine with category, base-status, payment-status, idempotency, transition history, and outbox support. Its generic API is intentionally internal/operator-only because public callers must not be allowed to submit authoritative merchant IDs, actor IDs, prices, or monetary totals.

Therefore Wave 2B must not create another order engine. It introduces a public commerce boundary that resolves catalog ownership, public availability, buyer identity, merchant identity, and pricing server-side, then persists into the existing canonical commerce model and exposes merchant-safe operational views in Usaha.

## Approaches Considered

### 1. Reuse the generic order engine API directly from WWW
Rejected. The generic create-order shape accepts merchant, user, item name, unit price, and metadata from the caller. Even with authentication, exposing that shape publicly would create price/ownership tampering risk and violate the existing internal-only intent.

### 2. Create a second WWW-specific order/request subsystem
Rejected. It would duplicate order state, idempotency, merchant attribution, and lifecycle semantics, creating another source of truth that CRM, finance, reporting, and B2B would later have to reconcile.

### 3. Public commerce façade over the canonical Marketplace engine
Selected. WWW submits only buyer intent and public object references. Marketplace resolves authoritative product/service/business ownership, price, availability, and permitted action; then creates or links canonical commerce records. Usaha reads those same records through merchant-authorized endpoints.

This preserves one commerce core while keeping public and internal trust boundaries separate.

---

# 1. Scope

## In scope
Wave 2B covers four public intent types:

1. **Buy / Order** — immediate order intent for orderable products/services.
2. **Ask / Contact about item** — structured buyer interest linked to product/service/business context.
3. **Request Quotation (RFQ)** — buyer requests merchant quotation instead of immediate checkout.
4. **Demand / Need request** — structured requirement that can later be matched/responded to by suppliers, while still generating operational context when directed to a merchant.

The first implementation should prioritize the most mature current flow: canonical product order plus directed RFQ/request, while keeping the public API shape extensible to services and B2B later.

## Out of scope for Wave 2B
- Full marketplace payment settlement redesign.
- Full shipping-carrier integration.
- Custom CRM pipeline implementation.
- Cross-business purchase-order mirroring.
- Automated supplier matching.
- AI recommendation/lead scoring.
- Full configurable order-state workflow builder.

Those belong to later waves.

---

# 2. Canonical Domain Boundaries

## Marketplace owns commerce state
Canonical records remain in Marketplace-owned persistence. WWW and Usaha are clients of the same backend state.

Public requests must never write authoritative financial values directly.

## Identity owns actor identity
Authenticated buyer/user identity comes from verified auth claims, not request body fields. Merchant/organization ownership comes from canonical product/business records.

## Chat owns realtime messages
Wave 2B may link a commerce record to a chat/conversation identifier through documented API/event boundaries, but Marketplace must not query Chat storage directly.

## Customer projection
A buyer may become a business customer when enough real identity exists and a qualifying interaction/order occurs. Customer linkage should be created from the canonical interaction/transaction, not require duplicate manual entry.

---

# 3. Public Commerce API

Create a category-specific public boundary under Marketplace rather than enabling the generic order engine.

Suggested conceptual endpoints:

- `POST /api/public/commerce/orders`
- `POST /api/public/commerce/rfqs`
- `POST /api/public/commerce/inquiries`
- `POST /api/public/commerce/requests`
- `GET /api/public/commerce/orders/:id` for the authenticated buyer's safe view

Exact routes should follow current repository conventions discovered during implementation; externally observable existing routes must not be broken.

## Public create-order input
Caller may provide only intent-level fields such as:

- public product/service ID;
- quantity;
- selected public variant/SKU where supported;
- fulfillment preference from an allowed enum;
- buyer note;
- delivery/contact data only where required and privacy-safe;
- client-generated idempotency key.

Caller must not authoritatively provide:

- merchant ID;
- organization ID;
- seller user ID;
- unit price;
- subtotal/total;
- payment state;
- fulfillment state;
- COGS;
- inventory values;
- internal customer ID;
- privileged metadata.

## Server-side resolution
Marketplace resolves inside one trusted flow:

1. authenticated buyer identity;
2. canonical public product/service;
3. owning business/merchant/organization;
4. publication status;
5. current effective public availability;
6. authoritative current price and currency;
7. quantity/variant validity;
8. allowed fulfillment/payment initiation mode;
9. duplicate/idempotent request detection.

If any critical input cannot be resolved safely, fail closed with a stable domain/API error.

---

# 4. Commerce Record Semantics

## Separate lifecycle dimensions
Do not overload a single status.

### Order status
Represents commercial acceptance/progress, e.g.:
`PENDING_CONFIRMATION -> ACCEPTED -> PROCESSING -> COMPLETED`
with terminal alternatives such as `REJECTED`, `CANCELLED`, `EXPIRED`.

Where existing `OrderBaseStatus` names already cover the behavior, preserve them rather than introducing parallel semantics.

### Payment status
Independent values such as:
`UNPAID`, `PENDING`, `PAID`, `FAILED`, `REFUNDED`, etc.

### Fulfillment status
If current schema does not yet provide a dedicated dimension, Wave 2B should introduce one only if required to avoid abusing base status. Preferred progression:
`UNFULFILLED -> PREPARING -> READY -> SHIPPED/IN_SERVICE -> DELIVERED -> FULFILLED`

The implementation plan must first inventory the existing schema/migrations and choose expand/backfill rather than destructive replacement.

## Source attribution
Every inbound record must retain durable attribution:

- `source = www`;
- entry surface/detail page;
- public product/service/business reference;
- campaign/referrer identifiers when already supported and privacy-safe;
- linked inquiry/RFQ/chat identifier when applicable.

Do not store arbitrary frontend blobs as the canonical contract.

---

# 5. Order Creation Invariants

A public order is valid only when all of the following hold atomically:

- buyer is authenticated when the flow requires identity;
- product/service is public and orderable;
- owning business is active/publishable;
- requested quantity is positive and within supported numeric bounds;
- selected variant belongs to the selected product;
- authoritative price is resolved server-side;
- availability is sufficient or the flow explicitly supports merchant confirmation/backorder;
- merchant attribution is canonical;
- idempotency key is unique within the appropriate buyer/action scope;
- no cross-tenant identifiers are accepted from the caller.

No sale, inventory decrement, or revenue recognition should happen merely because a buyer created an unaccepted/unpaid order unless the existing commerce policy explicitly requires reservation.

---

# 6. Reservation and Availability

Wave 2A provides safe public availability. Wave 2B must not immediately consume ingredient inventory when a buyer merely submits an order.

Recommended policy for the first implementation:

- **No hard inventory decrement on order submission.**
- Add or use a reservation mechanism only where a payment/acceptance flow truly requires it.
- If reservation is introduced, `available = on_hand/capacity - active_reservations` must become a documented canonical invariant.
- Reservation must expire/release safely on cancellation, rejection, or timeout.
- Duplicate retries must not reserve twice.

Because reservation semantics affect Wave 2A availability, procurement, and POS concurrency, implementation must not add a partial reservation field without end-to-end tests.

---

# 7. RFQ and Inquiry Semantics

## Inquiry
A lightweight structured interaction for "Tanya produk", "Tanya stok", or seller contact.

Required context:
- buyer identity if authenticated;
- target business;
- optional product/service;
- source surface;
- message/intent category;
- created timestamp;
- status such as `OPEN`, `RESPONDED`, `CLOSED` where useful.

An inquiry may link to Chat, but the commerce/CRM-relevant context must remain queryable without reading Chat's database.

## RFQ
A commercial request distinct from an order.

Minimum canonical fields:
- buyer;
- seller/business;
- item/service references where available;
- requested quantity;
- notes/specification;
- optional target date/location;
- status;
- source attribution;
- idempotency key;
- later quotation linkage.

RFQ must not fabricate a price/order before the merchant responds.

---

# 8. Usaha Operational Inbox

Usaha receives inbound commerce through merchant-authorized Marketplace APIs.

Primary navigation remains under **Penjualan / Pesanan** with filters/tabs rather than a disconnected new app.

Recommended views:

- **Perlu tindakan** — new orders/RFQs/inquiries requiring response;
- **Pesanan** — canonical orders;
- **Permintaan penawaran** — RFQs;
- **Pertanyaan** — inquiries where useful;
- **Selesai** — completed/closed records.

Each row/card should show only actionable information:
- buyer/customer display identity allowed to merchant;
- source (`WWW`);
- product/service;
- quantity/value where known;
- order/payment/fulfillment state;
- age/received time;
- next required action.

Avoid fake unread counts or decorative KPIs.

## Merchant actions
Depending on type and current lifecycle:
- accept;
- reject with reason;
- contact/respond;
- mark processing;
- initiate quotation;
- record/confirm payment through existing safe payment flow;
- fulfill/complete;
- cancel/refund only through permitted state transition.

Every merchant action is authorized against the target business and actor role server-side.

---

# 9. Conversion to Sale / Finance / Inventory

An inbound order must not create duplicate operational records as it progresses.

When policy conditions are met, the same canonical order should drive downstream effects:

`order -> payment/acceptance -> fulfillment -> sale/COGS/inventory/customer/reporting`

If the existing Business OS sale model remains a distinct aggregate, conversion must be explicit and idempotent with durable source linkage:

- `business_sale.source_type = order` (or equivalent canonical relationship);
- `source_order_id` unique where one order maps to one sale;
- retry cannot produce a second sale;
- historical COGS uses the same rules already established in Wave 1;
- inventory consumption occurs once at the correct business event;
- finance effects remain source-linked and transactional.

Do not copy values into unrelated metadata when a relational source link exists or can be added safely.

---

# 10. Customer Attribution

Qualifying WWW actions should progressively create/link customer identity for the merchant.

Priority order:
1. completed/accepted order;
2. RFQ with identifiable buyer;
3. meaningful inquiry/chat interaction where enough identity is known.

Customer creation/linking must be idempotent and scoped to the merchant/business. The same platform user may be a customer of many businesses without those businesses seeing each other's private relationship data.

Customer data exposed to the merchant must follow privacy rules and verified identity boundaries.

---

# 11. Security and Abuse Controls

Required:
- derive buyer identity from auth claims;
- derive seller/business from canonical target object;
- server-side price resolution;
- tenant authorization on every merchant operation;
- ownership checks on buyer-side reads/cancellations;
- rate limits for inquiry/RFQ/order creation;
- stable anti-enumeration behavior where relevant;
- bounded text lengths and numeric ranges;
- no internal IDs or private data in public error payloads;
- no authorization/JWT/contact-sensitive payload logging;
- public DTO allowlists.

High-risk actions must fail closed.

---

# 12. Idempotency and Concurrency

Every create/convert action that can be retried must be idempotent.

At minimum:
- public order create;
- RFQ create;
- quotation-to-order conversion later;
- order-to-sale conversion;
- payment callback processing;
- inventory reservation/release if introduced.

Idempotency must be enforced by durable uniqueness, not only application-memory checks.

Concurrent merchant transitions use row/version locking or an existing optimistic-concurrency mechanism. Illegal or stale transitions return stable conflict errors instead of silently overwriting state.

---

# 13. Eventing and Observability

Use transactional outbox semantics for events coupled to DB state.

Candidate events:
- `order.created`;
- `order.accepted`;
- `order.rejected`;
- `order.payment_changed`;
- `order.fulfillment_changed`;
- `order.completed`;
- `rfq.created`;
- `inquiry.created`.

Consumers must be idempotent.

Structured telemetry should include non-sensitive fields such as:
- request/correlation ID;
- aggregate ID;
- business ID when safe for internal logs;
- source surface;
- transition;
- latency;
- result/error code.

Never log free-form buyer messages, auth headers, tokens, or sensitive contact data by default.

Useful metrics:
- inbound order count;
- RFQ/inquiry count;
- merchant response latency;
- acceptance/rejection rate;
- transition conflicts;
- idempotent replay count;
- failed public commerce requests by stable reason;
- order-to-sale conversion success/failure.

---

# 14. Frontend WWW

WWW detail surfaces should expose only actions supported by the backend for that item/business.

Recommended CTA priority:
- `Pesan` / `Beli` when directly orderable;
- `Minta Penawaran` for quotation-oriented products/services;
- `Tanya` as low-friction fallback.

Requirements:
- loading, validation, success, retry, and conflict states;
- prevent duplicate submission while still relying on backend idempotency;
- clear confirmation with a buyer-visible reference;
- authenticated-user return path after login;
- mobile-first forms;
- price/availability revalidation on submit;
- no client-authoritative totals.

---

# 15. Frontend Usaha

Usaha consumes merchant-safe DTOs from Marketplace.

Requirements:
- real counts only;
- filters by action/status/source/date;
- mobile card view and dense desktop table;
- direct next-action controls;
- optimistic UI only where rollback/error state is reliable;
- consistent permission-disabled states;
- customer/context drill-through without exposing platform-internal secrets;
- no duplicate order and sale views that disagree about status.

---

# 16. Testing Strategy

Use TDD for behavior changes.

## Backend characterization first
Before modifying the existing engine, lock current behavior for:
- idempotency;
- allowed transitions;
- outbox uniqueness;
- buyer/operator authorization boundary;
- server-authoritative catalog price/merchant resolution on category-specific public paths.

## Public commerce tests
Must prove:
- caller-supplied merchant/price cannot override canonical values;
- unpublished/unavailable product fails correctly;
- quantity validation;
- variant ownership validation;
- duplicate idempotency key returns/reuses one canonical record;
- buyer cannot read/cancel another buyer's order;
- cross-tenant merchant mutation fails closed.

## Merchant operational tests
Must prove:
- inbound WWW record appears only for its owning business;
- merchant transitions obey role and lifecycle;
- payment state remains independent from base/fulfillment state;
- rejected/cancelled records do not create sale/inventory effects;
- qualifying completion/conversion produces at most one sale;
- sale uses historical COGS/inventory behavior already proven in Wave 1;
- customer linkage is idempotent and business-scoped.

## Frontend tests
WWW and Usaha must cover:
- supported CTA rendering;
- validation/error states;
- submission replay protection;
- order/RFQ inbox states;
- permission handling;
- responsive critical paths.

## Full verification before merge
At minimum use relevant repository gates for:
- Rust format/clippy/tests;
- PostgreSQL migrations and integration tests;
- WWW and Usaha lint/test/typecheck/build;
- repository hygiene;
- runtime smoke;
- security;
- image/build workflows required by the repository.

---

# 17. Migration Strategy

Prefer expand/backfill/switch/verify/contract.

Implementation must inventory the current `orders`, `order_items`, state transition, payment, source metadata, and Business OS sales/customer schemas before introducing columns/tables.

Rules:
- never rewrite applied migrations;
- new schema in versioned migration;
- indexes for buyer, merchant/business, status, source, and idempotency lookup as justified by query shape;
- durable unique constraints for idempotency/source conversions;
- rollback/recovery documented for risky DDL;
- no giant metadata JSON as substitute for relational lifecycle state.

---

# 18. Delivery Decomposition

Wave 2B is too important for one unreviewable code dump. Deliver as coherent implementation PRs only when boundaries justify it, while keeping one canonical target architecture.

Recommended implementation sequence:

### 2B.1 — Public Order Boundary
- server-authoritative product/merchant/price resolution;
- buyer auth;
- idempotent canonical order create;
- safe buyer order read;
- source attribution;
- tests.

### 2B.2 — Usaha Inbound Orders
- merchant-scoped list/detail;
- actionable status transitions;
- WWW source visibility;
- role/tenant authorization;
- Usaha UI states.

### 2B.3 — Order → Sale/Customer Loop
- explicit idempotent source linkage;
- customer linkage;
- sale/COGS/inventory/finance effects at correct lifecycle event;
- reporting/dashboard source consistency.

### 2B.4 — RFQ / Inquiry
- canonical directed RFQ/inquiry;
- Usaha inbox;
- chat/context link where supported;
- future quotation/CRM hooks without implementing full Wave 4 CRM.

### 2B.5 — Hardening
- abuse/rate-limit controls;
- observability;
- stale transition/concurrency tests;
- runtime and security gates;
- docs/contracts cleanup.

If repository inspection during implementation shows an existing category-specific public order flow already covers part of these responsibilities, extend and characterize it rather than duplicating it.

---

# 19. Success Criteria

Wave 2B is complete when a real WWW buyer action can reach a merchant's Usaha workspace through one canonical commerce record and remain trustworthy through completion.

Specifically:
- WWW never authors authoritative price or merchant identity;
- one buyer submission creates at most one canonical record;
- the owning merchant sees the inbound work without manual copying;
- another merchant cannot see or mutate it;
- lifecycle, payment, and fulfillment semantics do not conflict;
- accepted/completed commerce can reach sale/customer/reporting without duplicate transactions;
- unavailable/rejected/cancelled flows do not produce accidental inventory/finance effects;
- public/private data boundaries remain intact;
- all affected CI/runtime/security gates are green before merge.

## Follow-on
After Wave 2B, proceed to Wave 3 Procurement:

`low stock -> supplier -> PO -> goods receipt -> inventory movement -> payable/payment linkage`

Then Wave 4 CRM can consume trustworthy WWW interaction/order/RFQ/customer data rather than inventing parallel CRM records.
