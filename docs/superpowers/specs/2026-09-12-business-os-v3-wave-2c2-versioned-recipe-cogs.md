# Business OS V3 Wave 2C.2 — Versioned Recipe/BOM + COGS Kernel

Date: 2026-09-12
Status: implementation specification

## Goal

Make recipe/BOM definitions historical, effective-dated, immutable after publication, and authoritative for both COGS and ingredient consumption. Preserve the existing Business OS API contract while removing mutable-in-place recipe history.

## Rights-by-design constraints

1. Never fabricate a historical recipe version from legacy mutable rows. Existing `business_recipes` / `business_recipe_items` remain legacy compatibility data until an accountable actor explicitly writes a versioned recipe.
2. A published recipe version is evidence and is immutable. Correction happens by publishing another version, never by rewriting the old version.
3. Publication records actor, effective window, source/reason metadata, and immutable audit evidence.
4. Sales must preserve the exact recipe version and ingredient quantities used at posting time so later recipe or purchase-price changes cannot rewrite historical COGS or inventory evidence.
5. Technical authorization remains distinct from legal relationships. `recipe.view` and `recipe.manage` are application permissions only.
6. Tenant and branch boundaries fail closed. Recipe writes and reads are scoped to exact `(organization_id, business_id)` and any future location scope must not leak across businesses.

## Compatibility

- Existing `GET /v1/businesses/{business_id}/products/{product_id}/recipe` remains available.
- Existing `PUT /v1/businesses/{business_id}/products/{product_id}/recipe` remains available, but becomes an explicit publish operation rather than an in-place mutation.
- Legacy mutable recipe rows are kept for compatibility with existing availability/read paths during this wave.
- New publication projects the newly published version into the legacy current recipe tables in the same transaction. This projection is not the historical source of truth.
- Existing recipes are not automatically copied into version history by migration. Until explicitly republished, legacy recipes continue to work through the compatibility path and sales fallback.

## Version model

Add `business_recipe_versions` with at least:

- `id`
- `organization_id`
- `business_id`
- `product_id`
- monotonically increasing `version_number`
- `name`
- `servings`
- `status` (`published`, `superseded`)
- `effective_from`
- optional `effective_until`
- `published_by_user_id`
- optional `superseded_by_version_id`
- `reason`
- metadata
- timestamps

Add `business_recipe_version_items` containing the immutable ingredient definition for the version.

Published effective windows for one `(business, product)` may not overlap. Superseding a currently open version closes its `effective_until` immediately before the new version begins and points to the replacement.

## Publication semantics

Publication is one database transaction:

1. authorize `recipe.manage` for the actor and exact business/organization;
2. validate product belongs to exact business/organization;
3. validate every ingredient belongs to exact business/organization and is active;
4. validate name, servings, quantities and waste overrides;
5. serialize publication for the product using an advisory/product row lock;
6. choose next monotonically increasing version number;
7. close/supersede any currently open published version whose window precedes the new effective time;
8. reject effective-window overlap or retroactive rewrite of an already published interval;
9. assemble all immutable `business_recipe_version_items` first using a deferred parent FK, then insert the parent `business_recipe_versions` row last as the atomic publication/seal point;
10. reject publication when the immutable BOM is empty, and reject any item INSERT/UPDATE/DELETE after the parent version is published;
11. project the published definition into legacy `business_recipes` / `business_recipe_items` for compatibility;
12. append `recipe.published` audit evidence;
13. commit, where the deferred FK validates that every assembled item belongs to the published parent version.

The public legacy PUT defaults `effective_from` to the current transaction time and records source `legacy_recipe_put`. The parent-last publication protocol is an implementation invariant: a published version cannot exist with an incomplete or later-extendable BOM.

## Read semantics

The legacy GET returns the currently effective published version when one exists. If no versioned recipe exists, it returns the existing legacy recipe. Versioned reads require `recipe.view` when exposed through governance-aware endpoints.

## Sales / COGS semantics

For each sale line, resolve recipe at the sale's effective timestamp/date boundary. For a sale posted on the database's current date, use one database `NOW()` value captured for the whole sale transaction. For a backdated sale, retain date-granular historical resolution at the start of that UTC date. Prefer a versioned recipe whose effective range contains that resolved timestamp. If immutable history exists but no interval matches, fail closed instead of falling back to mutable legacy data; legacy fallback is only valid before immutable history exists.

The resolved definition is loaded once and becomes the single source for:

- ingredient quantities consumed;
- COGS calculation;
- sale line `cost_snapshot`;
- recipe evidence references.

The snapshot includes stable recipe/version identifiers and the exact ingredient quantity/cost calculation. A sale cannot resolve one version for COGS and another for stock consumption, and every line in one sale uses the same captured effective timestamp.

When a versioned recipe is used, persist `recipe_version_id` on the sale line as an indexed FK. Legacy-fallback sales leave it NULL but still retain their existing immutable JSON snapshot.

## Governance

Seed:

- `recipe.view`
- `recipe.manage`

Backfill both permissions to existing system owner roles. New businesses already grant system owner roles all permissions dynamically and therefore inherit them.

Publication appends immutable `business_audit_events` with:

- actor
- `recipe.published`
- subject type `recipe_version`
- version id
- product id, version number, effective range and source in metadata.

## Database invariants

- exact composite tenant/product/ingredient FKs where possible;
- unique `(business_id, product_id, version_number)`;
- immutable published version/header and item rows via mutation-rejection triggers;
- immutable BOM items must be assembled before the parent version is published;
- a published parent version requires at least one BOM item;
- after publication, item INSERT/UPDATE/DELETE is rejected;
- transaction advisory locks serialize BOM assembly and publication for the version id so a concurrent late insert cannot race the seal point;
- positive servings and item quantities;
- valid waste overrides;
- nonempty name;
- effective-until strictly after effective-from;
- published windows cannot overlap for same business/product;
- sale-line recipe-version FK uses `ON DELETE RESTRICT`;
- no migration backfill from legacy recipes into version history.

## Tests

Minimum RED/GREEN coverage:

1. migrations create version tables and permissions but do not fabricate versions from a legacy recipe;
2. published versions/items reject UPDATE and DELETE, and a published BOM rejects late item INSERT;
3. publishing an empty BOM is rejected and valid publication seals a nonempty child-first aggregate;
4. publishing a second version supersedes the first without rewriting it and produces non-overlapping windows;
5. legacy GET/PUT remain compatible;
6. exact organization/business scope rejects foreign products/ingredients;
7. sale resolves the effective recipe version, persists version reference/snapshot, and consumes quantities from that same version;
8. current-day sales use posting time while backdated sales retain historical date semantics;
9. later recipe publication and ingredient price changes do not mutate historical sale COGS/snapshot;
10. sale idempotency, insufficient-stock rollback, branch-balance projection and append-only movements remain green.

## Out of scope

- recipe approval workflow beyond publish/supersede;
- batch/lot costing, FIFO/LIFO/weighted-average valuation;
- branch-specific recipes;
- purchasing/procurement workflows;
- UI redesign;
- retroactively reconstructing unknown historical recipes.
