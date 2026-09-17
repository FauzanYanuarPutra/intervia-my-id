# Lajukan Business OS V3 — Business Network OS for Indonesia

## Status
Proposed product and architecture design for the next major Lajukan evolution.

## Vision
Lajukan becomes a complete but approachable business platform for Indonesia: a user can discover business needs, sell products and services, operate a business, manage customers, collaborate with a team, understand financial performance, and grow through the same ecosystem.

The product must remain simple enough for a one-person or micro business while being structurally capable of supporting multi-branch merchants, suppliers, distributors, service providers, and larger teams.

Primary product promise:

> Cari kebutuhan usaha, jual produk dan jasa, kelola bisnis, dan tumbuh — dari satu Lajukan.

## Product Positioning
Lajukan V3 is not an ERP clone and not a marketplace with a merchant dashboard attached. It is a **Business Network OS** with four coordinated surfaces:

1. `www.lajukan.com` — discovery, storefront, local commerce, demand generation, and public transaction entry points.
2. `usaha.lajukan.com` — merchant operating system for daily business work.
3. CRM — lead, customer, pipeline, follow-up, relationship, and repeat-sales workflows.
4. CMS — Lajukan platform control for taxonomy, content, moderation, discovery configuration, trust, and operational administration.

All four surfaces sit on canonical shared business data and shared identity/authorization.

## Core Product Principles

### 1. Powerful behind, simple in front
A small merchant must not be forced to learn enterprise accounting or ERP vocabulary to record a sale or manage stock. Complexity is progressively revealed only when useful.

### 2. Jobs before modules
Navigation and workflows are organized around real merchant jobs: sell, fulfill, restock, collect payment, follow up, understand performance, and manage people.

### 3. One canonical source of truth
Products, business identity, customers, orders, stock, sales, roles, and other core domain state must not be independently duplicated across WWW, Usaha, CRM, and CMS.

### 4. Indonesia-first workflows
Phone number and WhatsApp-friendly sharing, QRIS-aware payment recording, local address/location discovery, lightweight cash and receivables, Indonesian business identity fields, and tax-ready records are first-class product considerations.

### 5. Network effects over isolated software
A Lajukan merchant should be able to buy from another Lajukan merchant, request quotations, become a customer or supplier, and have both sides receive correct operational records.

### 6. Real data only
No fake balances, fake transactions, placeholder KPIs, dead buttons, or decorative automation presented as functional product capability.

### 7. Mobile-first operations, dense desktop productivity
Daily merchant jobs must work well from a phone. Desktop should use available space efficiently for tables, filters, finance, reporting, and administration.

---

# Product Surfaces

## A. Usaha V3 — Merchant Operating System

Usaha is the primary daily-use application for business operators.

### A1. Beranda / Command Center
Dashboard answers five questions immediately:
- What happened today?
- What needs attention now?
- What is running low?
- What money is coming in or going out?
- What should I do next?

Core widgets:
- sales today / selected period;
- gross profit based on historical COGS snapshots;
- transaction count;
- average order value;
- orders needing action;
- unpaid/partially paid receivables;
- low/out-of-stock items;
- purchase/restock needs;
- lead follow-up alerts;
- business readiness / incomplete setup;
- quick actions.

All cards drill into real filtered records.

### A2. POS / Quick Sale
Fast sale flow optimized for touch and keyboard:
- product search;
- barcode/SKU readiness;
- variant selection;
- quantity;
- discounts;
- customer optional selection;
- payment method;
- paid / partial / unpaid;
- notes;
- receipt/invoice output;
- cancel/refund policy workflow;
- idempotent submission.

Payment recording model supports at minimum:
- cash;
- QRIS;
- transfer;
- card/other;
- credit/receivable;
- mixed payment where justified by implementation maturity.

A completed sale writes canonical sales state, payment state, immutable cost snapshots, and inventory movement where inventory tracking is enabled.

### A3. Sales & Orders
Unify operational views for:
- direct/POS sales;
- WWW orders or requests;
- quotation-originated orders;
- manual sales;
- status lifecycle;
- fulfillment;
- payment status;
- cancellation/refund;
- source attribution.

Important: order status, payment status, and fulfillment status are separate dimensions. Do not overload one status field for all three.

### A4. Products & Catalog
Canonical merchant catalog:
- products;
- services where supported by shared commerce abstraction;
- variants;
- SKU;
- category/taxonomy mapping;
- price;
- sale price/promo period;
- cost references;
- stock-tracked toggle;
- unit;
- weight/dimensions where relevant;
- media;
- public/private/draft status;
- branch/location availability;
- product attributes driven by CMS taxonomy.

Product updates made in Usaha become public on WWW according to publication rules without duplicate manual entry.

### A5. Inventory
Inventory V3 supports:
- on-hand;
- reserved;
- available;
- low-stock threshold;
- stock movements;
- manual adjustments with reason;
- purchase receipt;
- sale consumption;
- returns;
- transfer between locations when multi-location is enabled;
- movement history/audit;
- optional batches/expiry as a later capability for businesses that need it.

Stock must be derived from durable movements or another well-defined canonical ledger, not mutable presentation metadata.

### A6. Purchasing & Suppliers
Procurement workflow:
`restock need -> supplier -> purchase order -> approval if needed -> goods receipt -> stock movement -> supplier payable/payment record`

Capabilities:
- suppliers;
- supplier contact;
- supplier product mapping;
- preferred supplier;
- last purchase price;
- purchase order;
- goods receipt;
- partial receipt;
- purchase return;
- purchase payment status;
- purchase history;
- restock suggestions based on thresholds and sales velocity later.

### A7. Customers
Customer 360 view:
- identity/contact;
- interaction/source;
- order history;
- sales history;
- lifetime value;
- outstanding receivable;
- notes/tags;
- last activity;
- linked CRM leads/opportunities;
- communication history where available;
- branch/business scope.

Customers should be created automatically from real transactions/interactions when enough identity is known, not require double entry.

### A8. Finance Basics
V3 is operational finance, not a full accounting suite initially.

Core:
- cash/bank accounts;
- money in/out;
- sales receipts;
- purchase expenses;
- operating expenses;
- receivables;
- payables;
- payment allocation;
- cash movement;
- basic category tagging;
- daily closing/reconciliation support;
- gross profit;
- cash flow summary;
- tax-ready exports/records.

Financial records linked to source transactions whenever possible. Manual entries remain possible with audit metadata.

Avoid hardcoding tax rules that may change. Keep tax configuration versionable and separated from the transaction core.

### A9. Team, Roles & Access
Business-scoped membership:
- owner;
- admin/manager;
- cashier;
- sales;
- inventory/warehouse;
- finance;
- CRM/salesperson;
- custom roles later.

Invite/search can use Lajukan username and other verified identity channels supported by Identity Service.

Authorization is server-side and tenant-safe. Frontend hiding is never the security boundary.

Fine-grained permissions should eventually cover:
- view/create/edit/delete products;
- sell/refund;
- inventory adjustments;
- purchasing;
- finance visibility;
- customer/CRM visibility;
- reports;
- team management;
- business settings.

### A10. Multi-Location / Branch
Progressive capability for growing merchants:
- branch/location registry;
- branch stock;
- branch-specific availability;
- branch sales;
- branch staff assignment;
- branch reports;
- stock transfer;
- consolidated business reporting.

A micro business with one location should not see unnecessary branch complexity.

### A11. Reports
Actionable reports:
- sales trend;
- gross profit;
- product performance;
- category performance;
- top/slow products;
- stock valuation where reliable;
- stock movements;
- purchase spend;
- supplier performance;
- receivable aging;
- customer repeat rate;
- lead conversion;
- branch comparison;
- payment method mix.

Every metric must have a documented definition and traceable data source.

---

## B. WWW V3 — Discovery & Commerce Network

WWW is Lajukan's public demand engine.

### B1. Intent-first Search
Global search targets user intent across:
- products;
- services;
- businesses;
- suppliers;
- machines/equipment;
- materials/business supplies;
- business places/property where domain support exists;
- needs/requests;
- opportunities;
- community/reference content when relevant.

Search capabilities:
- query intent;
- category;
- price range;
- location;
- radius;
- condition new/used where applicable;
- availability;
- verified business;
- sort by relevance/distance/latest/price where meaningful;
- typo tolerance/synonym strategy;
- empty-state recovery suggestions.

### B2. Local Discovery
Location is first-class:
- geocoded business locations;
- distance calculation;
- nearby business results;
- map/list interoperability where appropriate;
- operating hours;
- service area;
- location privacy rules.

### B3. Business Storefront
Public business page:
- verified identity/trust state;
- business description;
- categories;
- location/service area;
- opening hours;
- product/service catalog;
- availability;
- ratings/reviews when mature;
- chat/contact;
- request quotation;
- order/buy entry point;
- share;
- public policies/information.

Private finance/team/customer data must never be projected into public DTOs.

### B4. Product / Service Detail Funnel
Detail pages prioritize conversion and trust:
- clear title/media;
- price or quotation behavior;
- stock/availability;
- seller identity;
- seller location/distance;
- options/variants;
- clear CTA;
- chat/tanya stok;
- minta penawaran;
- buy/order when supported;
- related alternatives;
- report listing;
- meaningful loading/error/empty states.

### B5. Demand / Request Flow
Not all Indonesian B2B/local commerce should be forced into immediate checkout.

Support structured demand:
- request product/service;
- quantity;
- budget optional;
- location;
- deadline optional;
- description/media;
- visibility and privacy controls;
- supplier responses/quotes later.

A qualifying request can create CRM/merchant operational work instead of becoming an isolated post.

### B6. Trust Layer
Progressive trust system:
- account verification state;
- business verification;
- NIB/business information where voluntarily provided and allowed;
- seller age/activity;
- response behavior;
- review integrity;
- report/moderation tools;
- anti-spam/rate limits;
- suspicious activity handling.

Do not imply government validation unless validation actually occurred.

### B7. SEO & Performance
Public surfaces require:
- crawlable canonical routes;
- metadata/structured data where valid;
- sitemap strategy;
- canonical URLs;
- fast LCP and image handling;
- cache strategy compatible with freshness;
- share previews;
- location/category landing pages driven by real taxonomy/data, not thin spam pages.

---

## C. CRM V3 — Relationship & Revenue Engine

CRM should be useful without requiring merchants to manually reconstruct what already happened in Lajukan.

### C1. Automatic Lead Capture
Lead sources include:
- WWW chat/contact;
- request quotation;
- demand response;
- manual entry;
- imported data later;
- campaign/form integrations later.

Lead stores source attribution and linked context such as product/service/business interaction.

### C2. Pipeline
Default lightweight pipeline:
`New -> Contacted -> Interested/Qualified -> Quotation -> Negotiation -> Won/Lost`

Businesses may customize stages later, but defaults must work immediately.

### C3. Activities & Follow-up
- task;
- call/meeting note;
- WhatsApp-friendly action/share;
- follow-up due date;
- reminder;
- owner/assignee;
- overdue state;
- activity timeline.

### C4. Quotation
Quotation bridges CRM and commerce:
- customer;
- items/services;
- quantity;
- price;
- discount;
- terms;
- expiry;
- notes;
- shareable representation;
- accepted/rejected/expired status;
- conversion to canonical order/sale.

No duplicate sale should be created if retries occur.

### C5. Customer Segmentation
Useful segments driven by real behavior:
- new customer;
- repeat;
- high-value;
- inactive;
- unpaid balance;
- lead source;
- product interest;
- tags.

### C6. CRM Insights
Action-oriented, not vanity dashboards:
- leads needing response;
- overdue follow-ups;
- pipeline value;
- conversion rate;
- lost reason;
- lead source performance;
- inactive customers;
- repeat purchase indicators.

---

## D. CMS V3 — Platform Control Center

CMS controls Lajukan platform content/configuration without becoming an unrestricted database editor.

### D1. Taxonomy Engine
Canonical platform taxonomy:
- category tree;
- category status;
- slug;
- attributes/schema;
- units;
- allowed listing types;
- search synonyms;
- filters;
- icon/media references;
- SEO metadata;
- ordering/featured state.

Taxonomy feeds Create Listing, WWW search/filter, public landing pages, analytics grouping, and recommendation surfaces.

### D2. Content Management
- pages;
- homepage sections;
- banners;
- campaigns;
- announcements;
- editorial/reference content;
- publish scheduling;
- draft/preview;
- version history where practical.

### D3. Moderation
Unified queues for:
- listings;
- media;
- business profile reports;
- reviews;
- abuse reports;
- suspicious content;
- appeals/status history later.

Actions require reason, actor, timestamp, and auditable status transitions.

### D4. Business & User Administration
Safe operational administration:
- lookup user/business;
- verification state;
- account/business flags;
- support context;
- moderation actions;
- audit trail;
- no direct arbitrary password handling;
- sensitive actions protected by strong admin permissions and MFA policy.

### D5. Discovery Configuration
Controlled configuration for:
- featured categories;
- curated collections;
- homepage modules;
- campaign placements;
- search synonyms;
- recommendation overrides only where clearly labelled/admin-managed.

Never allow CMS configuration to silently bypass core trust or tenant authorization.

### D6. Audit & Approval
For sensitive actions:
- who;
- what;
- when;
- before/after summary where feasible;
- reason;
- approval requirement for high-impact operations later.

---

# E. Lajukan Network — B2B Graph

This is the strategic V3 differentiator.

A business can act as buyer, seller, supplier, service provider, or customer depending on the transaction.

Canonical network loop:

`Buyer need -> discover supplier -> chat/RFQ -> quotation -> buyer accepts -> buyer Purchase Order -> seller Sales Order -> fulfillment -> goods receipt -> inventory/finance effects`

Where both parties are on Lajukan, one agreed commercial relationship should generate correctly linked records for each side rather than forcing re-entry.

Core relationship types:
- customer;
- supplier;
- buyer;
- seller;
- lead;
- business contact.

Network linkage must respect privacy. A merchant cannot inspect another merchant's private inventory, customer list, finances, or internal pricing unless explicitly exposed by a supported sharing workflow.

---

# F. Canonical Domain Architecture

## F1. Identity & Organization
Canonical:
- user;
- username/profile;
- organization/business membership;
- roles;
- permissions;
- verified contact channels;
- security/authentication state.

## F2. Business Identity
Canonical:
- business ID;
- display/legal information;
- categories;
- public profile;
- locations;
- service area;
- contact/public settings;
- verification state;
- publication status.

## F3. Catalog
Canonical:
- product/service/listing entities according to domain separation;
- variant;
- taxonomy;
- price;
- media;
- availability/publication.

## F4. Inventory Ledger
Canonical inventory movements and availability calculations. Public stock projection exposes only safe availability information.

## F5. Commerce
Canonical records for:
- quotation;
- order;
- sale;
- line items;
- payment state;
- fulfillment state;
- returns/refunds;
- source attribution;
- immutable historical pricing/cost snapshots where required.

## F6. Customer/CRM Linkage
CRM relationship references canonical identities/interactions where available while allowing external contacts that do not yet have Lajukan accounts.

## F7. Finance
Finance entries must link to source transactions when generated from sales/purchases. Separate operational ledger concepts clearly enough to avoid double counting.

## F8. Content & Taxonomy
CMS-owned public configuration has canonical schemas and controlled APIs. No direct frontend dependency on arbitrary metadata blobs when a typed model exists.

---

# G. Events and Cross-Surface Synchronization

Prefer synchronous canonical writes for state that must be immediately consistent. Use the existing outbox/event patterns for async projections and notifications.

Representative events:
- business.updated;
- product.published;
- product.updated;
- inventory.changed;
- order.created;
- order.status_changed;
- sale.completed;
- payment.recorded;
- customer.created/linked;
- lead.created;
- quotation.accepted;
- purchase_order.received;
- moderation.actioned.

Rules:
- events have stable versioned payloads;
- consumers are idempotent;
- retries cannot duplicate money, stock, order, or CRM state;
- event failure is observable;
- no hidden in-memory source of truth.

---

# H. Indonesia-First Product Layer

## H1. Contact & Messaging
- phone-first contacts;
- WhatsApp-friendly share/deep-link behavior where legally and technically appropriate;
- email remains supported;
- communication consent/preferences when messaging automation is introduced.

## H2. Payments
Payment method model must represent Indonesian merchant reality, including cash, QRIS, transfer, and receivable recording. Provider-specific online payment integrations remain adapters around canonical payment/order state.

## H3. Address & Geography
Use structured Indonesian geography plus coordinates where available:
- province;
- regency/city;
- district;
- village/subdistrict where supported;
- postal code;
- coordinates;
- service radius/area.

## H4. Business Legality
Business profile may support NIB and relevant business classification/document metadata. Lajukan must distinguish self-declared, uploaded, and actually verified data.

## H5. Tax-Ready, Not Tax-Fragile
Generate reliable turnover, sales, purchase, expense, and transaction records/export. Tax calculations/configuration must be versionable and maintainable rather than embedded permanently in commerce logic.

---

# I. AI & Automation — After Reliable Data

AI is an assistant over trusted data, not a replacement for core business logic.

Useful later capabilities:
- explain sales changes;
- low-stock/restock suggestion;
- product description assistance;
- search query understanding;
- customer follow-up suggestions;
- lead prioritization;
- anomaly detection;
- report summaries;
- "Tanya Bisnis Saya" natural-language business questions.

Guardrails:
- never invent financial transactions;
- show source period/data behind material insights;
- deterministic server logic remains authoritative for totals, permissions, stock, and money;
- AI actions that mutate business state require explicit user confirmation unless a safe approved automation model is later designed.

---

# J. Security, Privacy, and Reliability

## J1. Tenant Isolation
Every merchant read/write is authorized server-side against the business/organization context. Cross-tenant access fails closed.

## J2. Public Projection
WWW receives explicit public DTOs. Never serialize internal business models directly to public clients.

## J3. Admin Security
CMS/CRM administrative access requires strong RBAC, audit logging, and MFA-compatible policy. Sensitive actions need re-authentication/step-up where appropriate later.

## J4. Money & Stock Integrity
Use transactions/locking/idempotency appropriate to the operation. Never silently succeed after partial financial or inventory mutation.

## J5. Audit
Important mutations retain actor, source, timestamp, business scope, and reason/context where applicable.

## J6. Errors
Stable error codes and safe actionable messages. UI may show human guidance but must not expose secrets/internal stack traces.

---

# K. UX System

Shared Lajukan primitives across applications:
- navigation;
- buttons;
- forms;
- combobox/search selectors;
- tables;
- mobile list cards;
- drawers/modals;
- status badges;
- filters;
- date ranges;
- money/quantity input;
- empty/loading/error/success states;
- permission-denied state;
- destructive confirmation.

Rules:
- responsive by default;
- touch targets usable on phones;
- keyboard-efficient desktop workflows;
- Indonesian copy first where target user is Indonesian;
- accessible focus and semantic labels;
- no horizontal mobile overflow for primary operations;
- no dead controls;
- optimistic UI only when rollback/reconciliation is safe.

---

# L. Priority Model

## P0 — Integrity & Safety
Must be correct before feature breadth:
- builds/runtime healthy;
- login/auth/session correctness across surfaces;
- tenant isolation;
- canonical business identity;
- canonical product/catalog writes;
- canonical sales/order state;
- historical COGS correctness;
- no duplicate writes on retry;
- secure public/private projections;
- remove fake/dead production behavior;
- critical audit/security gaps.

## P1 — Daily Business Loop
Make Lajukan useful every day:
- Usaha command center;
- POS/Quick Sale;
- sales/orders;
- inventory consumption and movements;
- product/variant management;
- customer linkage;
- payment recording;
- expenses/basic cash;
- WWW storefront synchronization;
- WWW conversion entry points;
- basic roles/permissions;
- responsive usability.

## P2 — Growth & Procurement
Make merchants more productive and connected:
- suppliers;
- purchase orders;
- goods receipt;
- receivable/payable basics;
- CRM automatic lead capture;
- pipeline/activity/quotation;
- taxonomy engine;
- richer search/filter/location;
- business storefront maturity;
- trust/moderation;
- reporting depth;
- multi-location foundation.

## P3 — Network, Automation & Scale
Build compounding advantages:
- buyer/supplier linked B2B transactions;
- RFQ marketplace;
- customer segmentation;
- campaign automation;
- AI business assistant;
- forecasting/restock suggestions;
- configurable CRM stages/workflows;
- approval workflows;
- deeper multi-branch operations;
- integrations/import/export ecosystem;
- advanced reporting.

---

# M. Delivery Strategy

Do not implement V3 as one giant unreviewable commit.

Use coherent waves while preserving one architectural direction:

### Wave 0 — V3 Integrity Audit
Map current main against this design: implemented, partial, missing, duplicated, insecure, dead/fake. Fix P0 regressions first.

### Wave 1 — Canonical Daily Sale
Close the full loop:
`Usaha sale -> payment -> historical COGS -> inventory movement -> customer -> dashboard/report`

### Wave 2 — WWW ↔ Usaha Commerce
Close:
`Usaha catalog/stock -> WWW public view -> user action/order/request -> Usaha operational item`

### Wave 3 — Procurement
Close:
`low stock -> supplier -> PO -> receipt -> inventory + finance linkage`

### Wave 4 — CRM Revenue Loop
Close:
`WWW interaction -> lead -> activity -> quotation -> order/sale -> customer`

### Wave 5 — CMS/Taxonomy/Trust
Make content, categories, moderation, verification, and discovery configuration operationally manageable.

### Wave 6 — B2B Network
Link buyer and seller records safely across Lajukan businesses.

### Wave 7 — Intelligence
Only after trustworthy data coverage: insights, recommendation, forecasting, and AI assistant.

Each wave receives:
- targeted design delta if needed;
- tests first for changed behavior where practical;
- implementation;
- typecheck/lint/unit/integration/contract checks relevant to touched code;
- build validation;
- security/tenant review;
- focused PR with migration/rollback notes when applicable.

---

# N. Migration Rules

- No destructive rewrite solely to match V3 terminology.
- Existing routes/contracts remain compatible until deliberate migration is ready.
- Legacy metadata may be read during transition but new writes use canonical models once available.
- Backfills are explicit, repeatable/idempotent, and observable.
- Database migrations are forward-safe and reviewed for lock/data-loss risk.
- Feature flags may protect incomplete cross-surface launches.

---

# O. Testing Contract

Critical automated coverage must include:
- tenant-scoped authorization;
- role permission boundaries;
- sale idempotency;
- payment allocation;
- historical COGS snapshot immutability;
- inventory movement correctness;
- no negative/invalid stock where policy forbids it;
- public product/business projection;
- WWW-to-Usaha order/request linkage;
- customer auto-linking behavior;
- quotation-to-order conversion idempotency;
- procurement receipt effects;
- finance source linkage/no double count;
- taxonomy compatibility;
- moderation/admin authorization;
- responsive critical flows via suitable frontend tests;
- error/loading/empty states.

Performance checks prioritize search, public detail pages, dashboards, and high-frequency POS operations.

---

# P. Observability

V3 must expose enough telemetry to know when workflows fail:
- request/error rates;
- latency by critical endpoint;
- failed outbox/event deliveries;
- auth failures by safe category;
- order/sale write failures;
- payment reconciliation failures;
- inventory inconsistencies;
- search zero-result rate;
- WWW conversion events;
- CRM follow-up backlog;
- migration/backfill status.

Never put secrets or unnecessary personal data in logs.

---

# Q. Non-Goals for Initial V3 Waves

- Full double-entry enterprise accounting replacement.
- Payroll/HRIS suite.
- Manufacturing/MRP breadth before core commerce works.
- Copying competitor UI/code.
- New databases, queues, frameworks, or microservices without measured need.
- AI-generated authoritative financial numbers.
- Hardcoded government/tax policy embedded in transaction core.
- Building every possible industry vertical before shared primitives are proven.

---

# R. Success Criteria

V3 is succeeding when:

1. A merchant can onboard and complete a real sale from mobile without training.
2. The sale updates real operational and financial summaries without manual duplicate entry.
3. Product/business updates in Usaha reliably project to WWW.
4. Demand originating on WWW becomes actionable merchant work rather than an isolated page event.
5. Stock movement, money, customer, and historical COGS remain consistent under retries and failures.
6. A merchant can understand what requires attention from one command center.
7. CRM begins from real interactions automatically.
8. CMS controls taxonomy/content/moderation without code deployment for routine operations.
9. Roles and tenant boundaries remain safe across all surfaces.
10. Growing merchants can progressively enable supplier, purchasing, CRM, branch, and network functionality without making the smallest merchants suffer the complexity.

## Final Product Rule
Whenever a new V3 feature is proposed, ask:

> Does this make an Indonesian business easier to start, operate, sell, buy, understand, or grow — using trusted shared data?

If the answer is no, it is not a V3 priority.
