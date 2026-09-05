# Explore Results Conversion Wave 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Explore result conversion with explicit card actions, conservative trust signals, and useful zero-result recovery paths.

**Architecture:** Keep the current search payload, ranking, and route ownership unchanged. Add small pure presentation helpers under `src/lib/discovery`, then consume them from existing result cards and `ExploreSearchResults` so behavior is testable without rewriting the search subsystem.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, existing Lajukan UI components and analytics.

**Spec:** `docs/superpowers/specs/2026-09-05-explore-results-conversion-wave5-design.md`

## Global Constraints
- No marketplace API or backend ranking changes.
- No payment or authentication behavior changes.
- Never infer verification, ratings, stock, response time, or seller quality.
- Keep public-reference provenance behavior unchanged.
- Indonesian and English action copy must stay aligned.

---

### Task 1: Result conversion helpers

**Files:**
- Create: `frontend/apps/www/src/lib/discovery/exploreResultConversion.ts`
- Test: `frontend/apps/www/src/lib/discovery/exploreResultConversion.test.ts`

**Interfaces:**
- Produces: `getExploreResultAction(kind, locale)` and `getZeroResultRecovery({ locale, searchSide, activeTab })`.

- [ ] **Step 1: Write the failing test** covering listing/business/need/profile action labels and supply/demand/reference zero-result recovery.
- [ ] **Step 2: Run** `npm test -- src/lib/discovery/exploreResultConversion.test.ts` from `frontend/apps/www`; expect failure because the helper does not exist yet.
- [ ] **Step 3: Implement minimal pure helpers** returning only labels, href intents, and analytics action names.
- [ ] **Step 4: Re-run the targeted test** and require zero failures before calling it green.
- [ ] **Step 5: Commit** helper and test together.

### Task 2: Explicit result-card actions and trust hierarchy

**Files:**
- Modify: `frontend/apps/www/src/components/explore/cards/ExploreListingCard.tsx`
- Modify: `frontend/apps/www/src/components/explore/cards/ExploreBusinessCard.tsx`
- Modify when required: `frontend/apps/www/src/components/search/result-cards/NeedSearchCard.tsx`
- Modify when required: `frontend/apps/www/src/components/search/result-cards/UserSearchCard.tsx`

**Interfaces:**
- Consumes: `getExploreResultAction(kind, locale)` from Task 1.
- Produces: explicit action text while preserving existing detail/profile destinations.

- [ ] **Step 1: Add/extend focused component tests if an existing card-test pattern is present; otherwise keep behavior covered by Task 1 helper tests and avoid introducing a new rendering harness.**
- [ ] **Step 2: Add explicit action labels** such as `Lihat detail`, `Lihat profil`, and `Lihat kebutuhan` inside the existing linked cards.
- [ ] **Step 3: Add visible verified text only when `item.verified === true`; keep owner and location as factual context.**
- [ ] **Step 4: Do not add ratings, stock, response-time, ranking, or direct-chat claims.**
- [ ] **Step 5: Run targeted tests plus lint for touched files before claiming success.**

### Task 3: Zero-result recovery

**Files:**
- Modify: `frontend/apps/www/src/components/explore/ExploreSearchResults.tsx`

**Interfaces:**
- Consumes: `getZeroResultRecovery({ locale, searchSide, activeTab })`.
- Preserves: reference-specific next-batch behavior and provenance language.

- [ ] **Step 1: Replace the single marketplace zero-result CTA with a compact recovery group.**
- [ ] **Step 2: Provide Explore/browse recovery plus post-need or post-offer action depending on search side.**
- [ ] **Step 3: Keep references non-transactional and exclude create CTAs from reference zero states.**
- [ ] **Step 4: Track each explicit recovery click with stable action names and no user identifiers.**
- [ ] **Step 5: Run the conversion-helper test and any existing ExploreSearchResults tests.**

### Task 4: Verification and branch completion

**Files:**
- Review all Wave 5 changes.

**Interfaces:**
- No new product interfaces.

- [ ] **Step 1: Run** `npm test -- src/lib/discovery/exploreResultConversion.test.ts`.
- [ ] **Step 2: Run repository-appropriate frontend lint/type/build commands available for `frontend/apps/www`.**
- [ ] **Step 3: Run** `python scripts/ci/check_repository_hygiene.py` from repository root.
- [ ] **Step 4: Inspect the final diff for accidental backend/auth/payment changes.**
- [ ] **Step 5: Open PR and merge only with truthful verification notes; if local/CI execution is unavailable, state that explicitly instead of claiming green status.**
