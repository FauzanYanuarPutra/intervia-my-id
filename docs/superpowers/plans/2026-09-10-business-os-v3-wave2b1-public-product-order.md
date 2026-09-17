# Business OS V3 Wave 2B.1 Public Product Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace WWW runtime/in-memory online UMKM order creation with a server-authoritative, idempotent canonical Marketplace order path while preserving unrelated offline/table ordering behavior.

**Architecture:** Add a dedicated public-commerce boundary in `marketplace_service` over the existing `orders` / `order_items` / transition / outbox model. The public request contains buyer intent only. Marketplace derives buyer identity from auth claims and resolves product, store, canonical business, merchant owner, price, publication/availability, and totals server-side. WWW `/api/super-app/umkm/orders` remains the server adapter and routes only `channel=online` to the canonical Marketplace path; offline/table behavior remains on the existing local/runtime path for this sub-wave.

**Trust boundary:** Public callers never authoritatively submit merchant/business IDs, item names, prices, totals, payment state, COGS, inventory, or privileged metadata.

---

## Task 1 — Characterize current contracts

**Inspect:**
- `services/marketplace_service/src/order_engine.rs`
- `services/marketplace_service/migrations/20260604090000_orders_engine.up.sql`
- `services/marketplace_service/migrations/20260310150000_umkm_qr_online_offline_commerce.up.sql`
- `services/marketplace_service/src/businesses/products.rs`
- `frontend/apps/www/src/app/api/super-app/umkm/orders/route.ts`
- `frontend/apps/www/src/lib/super-app/umkm-commerce.service.ts`

**Lock decisions:**
- `orders.user_id` = authenticated buyer user UUID.
- Existing `orders.merchant_id` remains compatible and is populated from authoritative `umkm_stores.owner_user_id` for this public UMKM path.
- Add nullable `orders.business_id` for canonical business/tenant attribution; public canonical orders require it.
- Add explicit structured source columns if current schema lacks a durable source contract; do not rely on arbitrary caller metadata.
- Reuse `(user_id, idempotency_key)` durable idempotency.
- No reservation, inventory decrement, sale, or revenue recognition on order creation.

## Task 2 — Backend public-order RED tests

**Create:** `services/marketplace_service/src/public_commerce_tests.rs` (or colocated module following service convention).

Write PostgreSQL integration tests first proving the missing behavior:
1. authenticated buyer can create an online product order using only product IDs/quantities/idempotency key;
2. server resolves `merchant_id`, canonical `business_id`, item name and current price from `umkm_products` / `umkm_stores` / `business_store_links`;
3. unavailable/inactive/online-disabled target fails closed;
4. zero/negative/excessive quantity fails validation;
5. mixed-store cart is rejected;
6. insufficient known public stock is rejected;
7. retry with the same `(buyer,idempotency_key)` returns the same order and does not duplicate items/outbox;
8. creation does not change `business_inventory`, `business_ingredients`, or public stock;
9. unauthenticated create fails.

Run focused tests and record a substantive RED before production implementation.

## Task 3 — Expand canonical order attribution

**Create migration:** a new timestamped `*.up.sql` / `*.down.sql` pair after current migrations.

Expand `orders` without rewriting history:
- nullable `business_id UUID` for canonical Business OS attribution;
- durable `source_type TEXT` (for example `www` / `internal`) with a conservative compatibility default or nullable legacy behavior;
- durable `source_surface TEXT` where useful for storefront attribution;
- indexes for `(business_id, created_at DESC)` and source/business operational filtering.

Do not backfill guessed business IDs for legacy generic orders. New public canonical orders must populate them authoritatively.

Rollback removes only the new indexes/columns and leaves existing generic order data untouched.

## Task 4 — Public commerce module GREEN

**Create:** `services/marketplace_service/src/public_commerce.rs`.

Responsibilities:
- request/response DTOs and stable public error mapping;
- authenticate buyer from verified claims;
- validate bounded idempotency key, note, fulfillment enum, item count and quantities;
- load all requested public products in one tenant-safe query/transaction;
- require active store and `online_order_enabled`;
- require available products and sufficient known projected stock;
- require all products belong to one store/business;
- resolve `owner_user_id` as legacy-compatible `merchant_id` and `business_store_links.business_id` as canonical `business_id`;
- resolve names/prices/currency server-side;
- insert one `orders` record, authoritative `order_items`, initial transition, and transactional outbox event;
- replay existing order on duplicate idempotency key without new side effects;
- never decrement/reserve stock in this sub-wave;
- public response allowlists buyer-safe order fields only.

Prefer extracting small reusable persistence primitives from `order_engine.rs` only when doing so preserves existing generic behavior; do not expose the generic `CreateOrderRequest` publicly.

## Task 5 — Minimal Marketplace route wiring

**Touch:** `services/marketplace_service/src/main.rs` only for module declaration and route composition.

Preferred route when no established public-commerce convention conflicts:
- `POST /v1/public/commerce/orders`
- `GET /v1/public/commerce/orders/{order_id}` for buyer-owned safe view if implemented in this wave.

Do not enable `ORDER_ENGINE_API_ENABLED` for public traffic.

Add route/auth tests proving the generic internal endpoint remains protected and the new endpoint rejects missing/invalid buyer auth.

## Task 6 — WWW online-order adapter RED/GREEN

**Touch:** `frontend/apps/www/src/app/api/super-app/umkm/orders/route.ts` and the smallest supporting adapter/type files.

For `channel=online`:
- require authenticated user/session using existing strict identity/auth forwarding patterns;
- create/reuse a client idempotency key;
- forward only product ID, quantity, allowed fulfillment/note fields and idempotency key;
- do not forward client price/name/store as authoritative commerce values;
- map Marketplace stable errors to safe WWW responses;
- no silent runtime/in-memory fallback on Marketplace failure.

For `channel=offline` / table paths:
- preserve current behavior unchanged in 2B.1.

Write frontend tests proving client-supplied price/store/name cannot affect the backend request and online failure does not silently create a local order.

## Task 7 — Storefront CTA integration

Use existing `toko/[slug]` / canonical UMKM storefront composition. Add the smallest working online-order action only where the existing UI has enough product context.

Requirements:
- respect `online_order_enabled` and product availability;
- loading/disabled/error/success states;
- prevent accidental duplicate submission while backend idempotency remains authoritative;
- mobile-first;
- show buyer-visible order reference on success;
- do not duplicate product/detail routes.

If the current storefront has a cart/order interaction already, strengthen that path instead of creating a parallel UI.

## Task 8 — Verification and review

Focused verification during implementation:
```bash
cargo fmt -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```
and WWW tests/typecheck/build relevant to touched files.

Before merge run repository-required CI: Marketplace/PostgreSQL integration, WWW build, Quality Gates, Security, Frontend Runtime, Build Images, KYC/runtime contracts as triggered.

Review the final diff for:
- price/merchant tampering;
- buyer impersonation;
- cross-store/cross-business cart leakage;
- missing business attribution;
- duplicate orders/items/outbox on retry;
- stock side effects on create;
- private metadata/contact leakage;
- accidental changes to offline/table flows;
- `main.rs` responsibility creep;
- migration rollback safety.

Open implementation PR as draft during RED/GREEN work. Mark ready only after fresh CI on final head is fully green, then squash merge with expected-head SHA and verify `main` moved to the merge commit.
