# Lajukan Integrated Business OS — Design

## Goal
Unify `www.lajukan.com` and `usaha.lajukan.com` into one coherent business platform powered by canonical backend data. WWW becomes the public discovery/storefront side; Usaha becomes the merchant operating system. Changes made in Usaha must be reflected through canonical APIs in WWW, while demand/orders originating from WWW must feed back into Usaha workflows.

## Product Shape
### WWW Lajukan
WWW is the public layer for discovery, search, business pages, products, local discovery, offers, and transaction/request entry points. It should feel simple at the surface even though the platform underneath is broad. Primary navigation and page hierarchy prioritize useful journeys rather than exposing every capability at once.

### Usaha Lajukan
Usaha is the merchant/business operating system. It organizes work around merchant jobs: dashboard, sales/orders, products and inventory, customers, operations, finance basics, team/access, reports, and settings. The UI stays information-dense but understandable on desktop and mobile.

## Canonical Architecture
Both apps consume the same canonical business state:

`WWW / Usaha -> server adapter -> Marketplace/Identity canonical APIs -> PostgreSQL`

Important business state must not be duplicated in arbitrary metadata JSON when a canonical model exists. Existing compatibility metadata may be read only where necessary for legacy migration, but new writes target canonical models.

Canonical areas in scope: business identity/profile, location/public availability, products, inventory, orders/requests where current architecture supports them, customer linkage derived from real interactions, and merchant roles/authorization.

Use existing outbox/event patterns where async delivery is necessary. No new microservice, database, queue technology, framework, or external ERP dependency without measured need.

## Core End-to-End Loops
1. Merchant creates/updates product in Usaha -> canonical persistence -> WWW reads updated public product.
2. Merchant adjusts inventory -> canonical inventory -> WWW availability changes consistently.
3. Merchant changes business profile/location/public settings -> canonical business data -> WWW updates.
4. User demand/order/request from WWW -> canonical backend -> merchant sees the corresponding operational item in Usaha where the current domain supports it.
5. Completed operational actions feed real dashboard/customer/reporting summaries rather than hard-coded presentation data.

## Usaha Information Architecture
Primary groups: Beranda; Penjualan/Pesanan; Produk & Stok; Pelanggan; Operasional; Keuangan; Tim & Akses; Laporan; Pengaturan.

Existing working flows and permissions remain authoritative. Navigation may be regrouped, but routes/contracts are not broken without deliberate migration. Dashboard emphasizes actionable state: orders needing attention, stock alerts, business readiness, real sales/operational summaries, and quick actions.

## WWW Information Architecture
Lead with discovery and intent: global search; products & suppliers; services; machines/equipment; places/business locations; nearby businesses. Secondary capabilities remain accessible without dominating the first-screen experience.

Business/product detail pages provide clear availability, business identity, location, action/transaction entry points, and trustworthy empty/error states.

## UX and Visual Direction
Use existing Lajukan brand and primitives rather than cloning Gojek, GoBiz, Odoo, or Mekari. Reference them only for product maturity: hierarchy, dependable merchant workflows, fast mobile operation, contextual actions, integrated data.

Requirements: mobile-first responsive behavior; strong desktop information density for Usaha; consistent loading/empty/error/disabled/success states; no dead controls or fake balances/transactions; accessible focus/semantics; reusable primitives; restrained motion/effects.

## Authorization and Tenant Safety
Every business mutation is authorized server-side against owning organization/business. Cross-tenant reads/writes fail closed. Public DTOs expose only public fields. Merchant-only finance, customer, operational, team, and security data never leaks through public endpoints.

## Reliability and Error Handling
Stable domain/API error codes; no silent fallback to in-memory or metadata-only state; transactional persistence for coupled canonical writes; idempotency where retries could duplicate state; actionable UI errors without sensitive internals.

## Priority
P0: build/runtime failures, tenant/auth leaks, canonical-data violations, critical security defects, destructive consistency issues.

P1: WWW <-> Usaha canonical integration for product, inventory, business profile/location, and the most mature order/request flow already supported.

P2: dashboard/actionability, WWW discovery/storefront hierarchy, responsive behavior, search/filter clarity, states, accessibility, performance, SEO.

P3: CRM, finance/reporting enhancements, automation and cleanup only where backed by real data and useful to P0-P2 loops.

## Non-Goals
No cloning competitor code/UI; no enterprise-accounting breadth before core loops work; no fake ERP modules; no unnecessary infrastructure; no broad unrelated rewrites; no wholesale architecture replacement.

## Testing
Behavior changes receive focused tests first where practical. Use targeted typecheck/lint/unit/integration tests during implementation and relevant builds/contract tests at checkpoints. Before merge, run applicable CI gates and fix meaningful failures in scope.

Critical contracts: tenant-scoped product mutations; public projection of canonical business/product data; inventory status boundaries; authorization failures; no stale metadata fallback when canonical data exists; WWW/Usaha adapter compatibility.

## Delivery
One implementation branch: `feat/lajukan-integrated-business-os`. Keep coherent commits inside it; no parallel feature branches/PRs. Once stable, open one PR to `main`, run Actions, fix meaningful failures in the same branch, merge, then delete branch.

## Success Criteria
Touched core workflows behave like one system rather than two disconnected apps: merchant changes persist canonically and reflect publicly, public demand reaches merchant operations where supported, no new duplicate source of truth, permission boundaries remain intact, responsive UX materially improves, and relevant tests/build checks are green.
