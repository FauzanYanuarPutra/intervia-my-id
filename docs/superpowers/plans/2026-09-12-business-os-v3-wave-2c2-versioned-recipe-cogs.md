# Business OS V3 Wave 2C.2 — Versioned Recipe/BOM + COGS Kernel Implementation Plan

> Execute with TDD. Do not merge until fresh PR gates and review are green.

## Task 1 — RED migration/domain contract

Files:
- create `services/marketplace_service/src/businesses/recipe_versioning_persistence_tests.rs`
- modify `services/marketplace_service/src/businesses/mod.rs`

Add failing tests proving the expected tables, permissions and no-fabricated-backfill rule. Run marketplace tests in CI and confirm failure is specifically caused by the absent Wave 2C.2 schema.

## Task 2 — Version schema + governance permissions

Files:
- create `services/marketplace_service/migrations/20260912001000_versioned_recipe_cogs_kernel.up.sql`
- create matching down migration

Implement immutable recipe-version tables/items, exact scoped FKs, effective-window exclusion, publication evidence constraints, sale-line version reference, `recipe.view/manage`, owner-role permission backfill, and no legacy recipe backfill.

Re-run RED schema tests to GREEN.

## Task 3 — Recipe kernel repository

Files:
- create `services/marketplace_service/src/businesses/recipes.rs`
- create unit/persistence tests
- modify module registry

Implement validation, publish/supersede, effective-date resolution, version/item loading and legacy projection. Publication must be transactional and auditable.

Tests first:
- second publication supersedes but cannot mutate first;
- overlapping/retroactive effective window rejected;
- foreign product/ingredient rejected;
- audit event appended;
- legacy projection equals new published recipe.

## Task 4 — Legacy API compatibility + RBAC

Files:
- modify `control.rs` / `routes.rs` or isolate new recipe routes depending on smallest safe diff
- modify governance constants if needed
- tests

Preserve legacy GET/PUT shape. GET prefers effective version; PUT publishes a new immutable version. Enforce `recipe.view/manage` in addition to existing organization-management boundary without weakening current auth.

## Task 5 — Sales / COGS / inventory unification

Files:
- modify `sales.rs`
- modify `sales_persistence_tests.rs`

Refactor sale preparation so one resolved recipe definition supplies both COGS snapshot and ingredient-consumption quantities. Persist `recipe_version_id` when versioned data was used. Keep legacy fallback for pre-2C.2 recipes.

Tests first:
- sale chooses effective version;
- snapshot records stable version id/number;
- movement quantity comes from the same version;
- publishing a later version cannot rewrite historical sale evidence;
- existing idempotency/rollback/branch-balance tests remain green.

## Task 6 — Contract/docs cleanup

Run formatting and targeted tests. Update docs if implementation details differ from the spec for compatibility reasons; never silently change rights/evidence semantics.

## Task 7 — Review and verification

Fresh evidence required:
- `cargo fmt --check`
- marketplace clippy/tests per repository CI
- migration contract
- Business OS/control backend gates
- Security/build/runtime gates already configured for PR

Request code review after implementation, resolve substantive findings, then re-run affected checks.

## Task 8 — Finish branch

When all required PR workflows are completed/success and review has no unresolved blocker:

1. ensure branch still derives cleanly from current `main` or reconcile new upstream commits;
2. update PR body with final implementation and exact verification evidence;
3. squash merge using the final expected head SHA;
4. verify PR merged and `main` points to the returned merge commit;
5. report post-merge workflow status only from fresh observed data.
