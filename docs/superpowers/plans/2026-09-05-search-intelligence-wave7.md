# Search Intelligence Wave 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lajukan search more relevant and deterministic by making backend marketplace order authoritative, improving lexical ranking, and adding stable frontend dedupe without introducing opaque quality scoring.

**Architecture:** Keep PostgreSQL search as the source of truth. Add a focused Rust ranking helper module for query normalization/token coverage and use it to build deterministic marketplace relevance ordering, while the frontend stops reranking backend-ranked marketplace groups and only performs stable identity dedupe.

**Tech Stack:** Rust/Axum/SQLx/PostgreSQL, Next.js 16, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-search-intelligence-wave7-design.md`

## Global Constraints
- No new Meilisearch dependency or vector search.
- No personalization, paid placement, hidden seller-quality score, auth/payment/chat-service changes.
- Exact lexical relevance outranks freshness.
- Geo only affects ordering when explicitly requested.
- Dedupe only by explicit entity identity/canonical href, never fuzzy title similarity.
- Existing query parameters and response shapes remain backward compatible.

---

### Task 1: Frontend backend-order preservation and stable dedupe

**Files:**
- Modify: `frontend/apps/www/src/lib/search/globalSearch.ts`
- Create/Modify test: `frontend/apps/www/src/lib/search/globalSearch.test.ts`

**Interfaces:**
- Produces `dedupeGlobalSearchItems(items)` preserving first occurrence order.
- `rankGlobalSearchItems(items, query)` becomes a compatibility no-op for backend-ranked marketplace groups or is removed from those call sites.

- [ ] Write failing tests proving first-seen order survives dedupe and duplicate `kind + id` or canonical href entries collapse without fuzzy-title merging.
- [ ] Run targeted Vitest and observe RED when local execution is available.
- [ ] Implement stable identity dedupe.
- [ ] Update search aggregation call sites so backend marketplace ordering is preserved.
- [ ] Re-run targeted tests.

### Task 2: Backend ranking helper contract

**Files:**
- Create: `services/marketplace_service/src/search_ranking.rs`
- Modify: `services/marketplace_service/src/main.rs`

**Interfaces:**
- Produces query normalization/token helpers and SQL-order fragments used by marketplace content search.

- [ ] Write Rust unit tests first for normalization, token extraction, deterministic token coverage, and explicit sort-mode behavior.
- [ ] Run `cargo test search_ranking` and observe RED when local execution is available.
- [ ] Implement minimal helper module and register `mod search_ranking;`.
- [ ] Keep all existing content filters/status/side/category constraints unchanged.

### Task 3: Marketplace lexical relevance ordering

**Files:**
- Modify: `services/marketplace_service/src/main.rs`

**Interfaces:**
- Consumes normalized query/tokens from Task 2.

- [ ] Replace the current single-string additive ordering with deterministic layers: exact normalized title, token coverage, exact/prefix title tokens, tags/taxonomy, owner/company/brand, summary/search_text, location.
- [ ] Keep `updated_at`, `created_at`, and `id` strictly as tie-breakers for default relevance.
- [ ] Preserve explicit `latest` ordering if supported by the current endpoint contract.
- [ ] Preserve existing nearest/map ordering paths and never infer user coordinates.
- [ ] Add characterization tests around filters and ordering where existing test harness permits.

### Task 4: Synonym/taxonomy conservative expansion

**Files:**
- Modify: `services/marketplace_service/src/main.rs`

- [ ] Reuse existing marketplace categories/subcategories/industries/synonyms as additive match terms.
- [ ] Keep original query mandatory as a ranking signal; expansions may improve matching but never silently replace it.
- [ ] Bound expansion count and query length to avoid expensive SQL growth.

### Task 5: Verification and integration

- [ ] Run frontend targeted tests.
- [ ] Run marketplace-service Rust tests.
- [ ] Run frontend lint/type/build commands available in repo.
- [ ] Run `python scripts/ci/check_repository_hygiene.py`.
- [ ] Review diff for unrelated backend/auth/payment/chat changes.
- [ ] Open PR with truthful verification notes and merge only when GitHub reports mergeable.
