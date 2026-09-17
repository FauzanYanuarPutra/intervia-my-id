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

Implementation proceeds in the sequence defined in section 18. The first implementation checkpoint is product order creation and merchant receipt; RFQ/inquiry follows only after the order path is green and merged.

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

Preferred fallback routes when no existing category-specific route already owns the behavior:

- `POST /api/public/commerce/orders`
- `GET /api/public/commerce/orders/:id`
- `POST /api/public/commerce/rfqs`
- `POST /api/public/commerce/inquiries`
- `POST /api/public/commerce/requests`

Implementation must first search existing routes. If an equivalent public category-specific route already exists, characterize and extend it rather than introducing a duplicate. Otherwise use the fallback routes above. Existing externally observable routes must not be broken.

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

## Keep lifecycle dimensions separate
Do not overload one status field to represent commercial, payment, and fulfillment state.

### Existing base status is authoritative
Wave 2B must reuse the existing `OrderBaseStatus` state machine unless characterization proves a concrete business state cannot be represented safely.

Do not add `ACCEPTED` or `PENDING_CONFIRMATION` merely for naming preference. Public order creation uses the current category strategy's initial base/payment status. Merchant acceptance should use the existing `accepted_at` field plus an already-valid base transition when possible. A new base-status enum value requires a separately justified schema/state-machine expansion with migration and transition tests.

### Payment status
Existing payment status remains independent from base status. A merchant accepting an order must not imply payment unless payment has actually been confirmed by the supported payment/recording flow.

### Fulfillment status
Implementation must inventory the current schema before adding any fulfillment dimension. If fulfillment can be represented without corrupting base/payment semantics, preserve the current schema. If not, introduce an explicit fulfillment status by expand/backfill migration rather than encoding it into arbitrary metadata.

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

- buyer identity is derived from authentication when identity is required;
- product/service is public and orderable;
- owning business is active/publishable;
- requested quantity is positive and within supported numeric bounds;
- selected variant belongs to the selected product;
- authoritative price is resolved server-side;
- effective public availability is sufficient for the requested quantity;
- merchant attribution is canonical;
- idempotency key is unique within the appropriate buyer/action scope;
- no cross-tenant identifiers are accepted from the caller.

Wave 2B does not support implicit backorder in the first order implementation. If availability is insufficient, creation fails with a stable conflict/domain error and the client must refresh/retry intentionally.

No sale, inventory decrement, or revenue recognition happens merely because a buyer submits an order.

---

# 6. Reservation and Availability

Wave 2A provides safe public availability. Wave 2B must not immediately consume ingredient inventory when a buyer merely submits an order.

For Wave 2B.1 and 2B.2 the policy is explicit:

- **No inventory reservation and no hard inventory decrement on order submission.**
- Availability is revalidated at order creation and again at the business event that causes sale/inventory effects.
- A rejected, cancelled, or expired order produces no inventory consumption.

If later payment/acceptance behavior proves reservation is required, reservation becomes a separately reviewed sub-change because it alters the Wave 2A availability invariant. It must include durable reservation rows/uniqueness, expiry/release behavior, duplicate-retry safety, and end-to-end concurrency tests before it can ship.

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

Each row/card shows only actionable information:
- buyer/customer display identity allowed to merchant;
- source (`WWW`);
- product/service;
- quantity/value where known;
- current base/payment/fulfillment state as independently defined;
- received time/age;
- next permitted action.

Avoid fake unread counts or decorative KPIs.

## Merchant actions
Depending on record type and current lifecycle:
- accept/respond through the existing safe lifecycle;
- reject with reason;
- contact/respond;
- mark processing through permitted transition;
- initiate quotation for RFQ;
- record/confirm payment only through existing safe payment flow;
- fulfill/complete through permitted transition;
- cancel/refund only through permitted state transition.

Every merchant action is authorized against the target business and actor role server-side.

---

# 9. Conversion to Sale / Finance / Inventory

An inbound order must not create duplicate operational records as it progresses.

When existing business policy reaches the correct completion/payment event, the same canonical order drives downstream effects:

`order -> accepted/paid/fulfilled according to policy -> sale -> historical COGS -> inventory movement -> finance/customer/reporting`

The existing Business OS sale aggregate remains distinct unless repository inspection proves it is already the same aggregate. If distinct, conversion is explicit and idempotent with durable relational source linkage:

- sale stores a canonical source-order relationship;
- source-order uniqueness prevents a second sale for the same conversion event;
- retry returns/reuses the existing conversion result;
- historical COGS uses Wave 1 rules;
- inventory consumption occurs once at the designated sale/completion event;
- finance effects remain source-linked and transactional;
- rejected/cancelled/expired orders cannot produce sale effects.

Do not copy source links only into unrelated metadata when a relational key can be added safely.

---

# 10. Customer Attribution

Qualifying WWW actions progressively create/link customer identity for the merchant.

Priority order:
1. successfully converted order/sale;
2. RFQ with identifiable buyer;
3. meaningful inquiry/chat interaction where enough identity is known.

Customer creation/linking must be idempotent and scoped to the merchant/business. The same platform user may be a customer of many businesses without those businesses seeing each other's private relationship data.

Customer data exposed to the merchant follows privacy rules and verified identity boundaries.

---

# 11. Security and Abuse Controls

Required:
- derive buyer identity from auth claims;
- derive seller/business from canonical target object;
- resolve price server-side;
- tenant authorization on every merchant operation;
- ownership checks on buyer-side reads/cancellations;
- rate limits for inquiry/RFQ/order creation;
- stable anti-enumeration behavior where relevant;
- bounded text lengths and numeric ranges;
- no internal IDs or private data in public error payloads;
- no authorization/JWT/contact-sensitive payload logging;
- public DTO allowlists.

High-risk actions fail closed.

---

# 12. Idempotency and Concurrency

Every create/convert action that can be retried must be idempotent.

At minimum:
- public order create;
- RFQ create;
- order-to-sale conversion;
- payment callback processing;
- future quotation-to-order conversion;
- future reservation/release if reservation is approved later.

Idempotency is enforced by durable uniqueness, not only application-memory checks.

Concurrent merchant transitions use row/version locking or the existing optimistic-concurrency mechanism. Illegal or stale transitions return stable conflict errors instead of silently overwriting state.

---

# 13. Eventing and Observability

Use transactional outbox semantics for events coupled to DB state.

Candidate events:
- `order.created`;
- `order.accepted` only if acceptance is an actual canonical event in the implemented lifecycle;
- `order.rejected`;
- `order.payment_changed`;
- `order.fulfillment_changed` only if a canonical fulfillment dimension exists;
- `order.completed`;
- `rfq.created`;
- `inquiry.created`.

Consumers are idempotent.

Structured telemetry includes non-sensitive fields such as:
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
- rejection/completion rate where definitions are stable;
- transition conflicts;
- idempotent replay count;
- failed public commerce requests by stable reason;
- order-to-sale conversion success/failure.

---

# 14. Frontend WWW

WWW detail surfaces expose only actions supported by the backend for that item/business.

CTA priority:
- `Pesan` / `Beli` when directly orderable;
- `Minta Penawaran` for quotation-oriented products/services;
- `Tanya` as low-friction fallback.

Requirements:
- loading, validation, success, retry, and conflict states;
- prevent duplicate button submission while still relying on backend idempotency;
- clear confirmation with buyer-visible reference;
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
- no duplicate order and sale views that disagree about source or lifecycle.

---

# 16. Testing Strategy

Use TDD for behavior changes.

## Backend characterization first
Before modifying the existing engine, lock current behavior for:
- idempotency;
- allowed transitions;
- outbox uniqueness;
- operator-only generic order boundary;
- any existing category-specific public order behavior discovered during implementation.

## Public commerce tests
Must prove:
- caller cannot authoritatively submit merchant/organization/seller identity;
- caller-supplied monetary fields are absent/ignored by contract and cannot override canonical price;
- unpublished/unavailable product fails correctly;
- insufficient quantity fails without side effects;
- quantity validation;
- variant ownership validation where variants are supported;
- duplicate idempotency key returns/reuses one canonical record;
- buyer cannot read/cancel another buyer's order;
- no sale/inventory/finance effect occurs on order creation.

## Merchant operational tests
Must prove:
- inbound WWW record appears only for its owning business;
- cross-tenant merchant access fails closed;
- merchant transitions obey role and lifecycle;
- payment state remains independent from base/fulfillment state;
- rejected/cancelled/expired records do not create sale/inventory effects;
- qualifying conversion produces at most one sale;
- sale uses historical COGS/inventory behavior already proven in Wave 1;
- customer linkage is idempotent and business-scoped.

## Frontend tests
WWW and Usaha cover:
- supported CTA rendering;
- validation/error/conflict states;
- duplicate-submit UX protection;
- buyer confirmation/reference;
- merchant order/RFQ inbox states;
- permission handling;
- responsive critical paths.

## Full verification before merge
Use relevant repository gates for:
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

Implementation inventories the current `orders`, `order_items`, state-transition, payment, outbox, source-attribution, Business OS sales, customer, and merchant-membership schemas before introducing columns/tables.

Rules:
- never rewrite applied migrations;
- new schema in versioned migration;
- indexes for actual buyer/merchant/status/source/idempotency query shapes;
- durable unique constraints for idempotency and source conversions;
- rollback/recovery documented for risky DDL;
- no giant metadata JSON as substitute for relational lifecycle state.

---

# 18. Delivery Decomposition

Wave 2B is an umbrella commerce loop and is delivered sequentially. Each checkpoint is independently testable and mergeable; the next checkpoint starts from updated `main`.

### 2B.1 — Public Product Order Boundary
- characterize existing order engine/public routes;
- server-authoritative product/merchant/price resolution;
- buyer auth;
- effective availability validation;
- idempotent canonical order create;
- safe buyer order read;
- `WWW` source attribution;
- no order-creation inventory/finance side effects;
- backend tests and WWW order-submit UI.

### 2B.2 — Usaha Inbound Orders
- merchant-scoped list/detail;
- actionable existing lifecycle transitions;
- WWW source visibility;
- role/tenant authorization;
- Usaha responsive inbox UI and states.

### 2B.3 — Order → Sale/Customer Loop
- explicit idempotent source linkage;
- customer linkage;
- conversion at the defined lifecycle event;
- sale/COGS/inventory/finance effects exactly once;
- reporting/dashboard source consistency.

### 2B.4 — RFQ / Inquiry
- canonical directed RFQ/inquiry;
- Usaha inbox integration;
- chat/context link through supported boundary where available;
- future quotation/CRM hooks without implementing full Wave 4 CRM.

### 2B.5 — Commerce Hardening
- rate/abuse controls;
- observability/metrics;
- stale transition/concurrency tests;
- runtime/security gates;
- docs/contracts cleanup.

If repository inspection shows an existing category-specific public flow already covers a checkpoint, extend and characterize it rather than duplicating it.

---

# 19. Success Criteria

Wave 2B is complete when a real WWW buyer action can reach a merchant's Usaha workspace through one canonical commerce record and remain trustworthy through completion.

Specifically:
- WWW never authors authoritative price or merchant identity;
- one buyer submission creates at most one canonical record;
- the owning merchant sees inbound work without manual copying;
- another merchant cannot see or mutate it;
- base/payment/fulfillment semantics do not conflict;
- order creation alone causes no sale/inventory/finance effect;
- qualifying commerce can reach sale/customer/reporting without duplicate transactions;
- unavailable/rejected/cancelled/expired flows do not produce accidental inventory/finance effects;
- public/private data boundaries remain intact;
- all affected CI/runtime/security gates are green before merge.

## Follow-on
After Wave 2B, proceed to Wave 3 Procurement:

`low stock -> supplier -> PO -> goods receipt -> inventory movement -> payable/payment linkage`

Then Wave 4 CRM consumes trustworthy WWW interaction/order/RFQ/customer data rather than inventing parallel CRM records.
