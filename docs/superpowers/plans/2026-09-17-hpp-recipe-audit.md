# HPP Recipe Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Modal Produk/HPP clearer while preserving every recipe change with accountable actor/PIC audit history.

**Architecture:** Marketplace owns recipe state and writes immutable audit events. The Usaha app proxies recipe save/delete/history calls and renders a simpler HPP workspace with explicit add/edit/delete flows, dirty-state saving, and visible audit history.

**Tech Stack:** Rust Axum + SQLx/Postgres migrations, Next.js app routes, React client component, Vitest/source contract tests.

**Spec:** `C:/Users/fauza/.codex/attachments/96d5d51a-9e21-4018-9a47-a821b1bc0a75/pasted-text.txt`

## Global Constraints

- Do not modify already-applied migrations; add new versioned migrations only.
- Preserve recipe/sales history; deleting an active recipe means retiring active projections and closing immutable version evidence.
- Every recipe publish/retire action must record actor/PIC through `business_audit_events.actor_user_id`.
- Keep frontend routes and existing product price ownership intact.

---

### Task 1: Recipe Retirement And Audit History

**Files:**
- Create: `services/marketplace_service/migrations/20260917130000_recipe_retirement_audit.up.sql`
- Create: `services/marketplace_service/migrations/20260917130000_recipe_retirement_audit.down.sql`
- Modify: `services/marketplace_service/src/businesses/recipes.rs`
- Modify: `services/marketplace_service/src/businesses/routes.rs`
- Test: `services/marketplace_service/src/businesses/recipe_versioning_persistence_tests.rs`

**Interfaces:**
- Produces: `RecipeRepository::retire_active(actor_id, business_id, organization_id, product_id, reason)`.
- Produces: `RecipeRepository::list_audit_history(actor_id, business_id, organization_id, product_id, limit)`.
- Consumes: existing `business_audit_events`, `business_recipe_versions`, `business_recipes`.

- [ ] Write failing Rust persistence test proving publish and retire write actor audit events and `get_recipe` returns none after retire.
- [ ] Run targeted Rust test and verify it fails because retire/history APIs do not exist.
- [ ] Add migration that permits `business_recipe_versions.status = 'retired'` with a closed effective window and no replacement version.
- [ ] Implement repository methods, route handlers, and error mapping.
- [ ] Run targeted Rust tests and formatting.

### Task 2: Usaha API Proxy

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-control-server.ts`
- Modify: `frontend/apps/usaha/src/app/api/businesses/[businessId]/products/[productId]/recipe/route.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/products/[productId]/recipe/route.test.ts`

**Interfaces:**
- Produces: `deleteControlRecipe(businessId, productId, reason)`.
- Produces: `listControlRecipeHistory(businessId, productId)`.
- Consumes: marketplace `DELETE /v1/businesses/{business_id}/products/{product_id}/recipe` and `GET /recipe/history`.

- [ ] Write failing route test for DELETE forwarding reason and returning marketplace payload.
- [ ] Add server helpers and Next route handlers.
- [ ] Run targeted Vitest if Node tooling is available.

### Task 3: Durable HPP Workspace Simplification

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/usaha-flow-final.contract.test.ts`

**Interfaces:**
- Consumes: `DELETE /api/businesses/{businessId}/products/{productId}/recipe`.
- Consumes: `GET /api/businesses/{businessId}/products/{productId}/recipe/history`.
- Produces: UI copy/controls for explicit add ingredient, edit, remove, retire recipe, calculation detail, save bar, and visible PIC history.

- [ ] Write failing source contract test for explicit ingredient picker, retire confirmation, history/PIC markers, and dirty-state save bar.
- [ ] Implement component state and UI changes.
- [ ] Run frontend tests if Node tooling is available.

### Task 4: Verification

**Files:**
- All touched files.

- [ ] Run `cargo fmt --check`.
- [ ] Run targeted marketplace Rust tests.
- [ ] Run frontend targeted Vitest/typecheck where available.
- [ ] Run `git diff --check`.
- [ ] Commit and push only after fresh verification evidence.
