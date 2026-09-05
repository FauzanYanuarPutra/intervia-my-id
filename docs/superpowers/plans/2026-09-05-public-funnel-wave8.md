# Public Funnel Stabilization Wave 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize Explore, public SEO/trust metadata, legacy UMKM map compatibility, and public detail/profile conversion contracts without widening product scope.

**Architecture:** Keep existing public surfaces and helpers, but make routing and metadata contracts explicit and deterministic. Favor small shared helpers over page-local conditionals, preserve backend search ordering from Wave 7, and defer deep backend SQL/chat changes unless an existing safe route is verified.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, existing Lajukan analytics/SEO helpers.

**Spec:** `docs/superpowers/specs/2026-09-05-public-funnel-wave8-design.md`

## Global Constraints

- `side=supply` means offerings/providers; `side=demand` means buyer needs/requests.
- New URLs emit only canonical `supply`/`demand` values; legacy aliases are accepted only at parsing boundaries.
- Preserve backend result ordering and explicit-identity dedupe from Wave 7.
- Keep `/umkm` functional, `noindex,follow`, out of sitemap, and canonical to Explore businesses until map/deep-link parity exists.
- Do not invent chat routes, ratings, stock, trust scores, response speed, or seller quality.
- Do not substantially alter marketplace backend ranking SQL in Wave 8.
- Do not alter payment flows, auth architecture, or DB schema.
- Do not aggressively compact/minify touched files.
- PR merge is not blocked on separate test execution per user workflow; no green claim is allowed without actual verification.

---

### Task 1: Canonical Explore Supply/Demand URL Contract

**Files:**
- Modify: `frontend/apps/www/src/lib/discovery/exploreHubRoutes.ts`
- Modify: `frontend/apps/www/src/lib/discovery/exploreHubRoutes.test.ts`
- Inspect/modify call sites in the existing Explore hub/search client only where they emit these links.

**Interfaces:**
- Consumes: `buildExploreHubSearchHref(locale, intent, query)`
- Produces: canonical Explore URLs that explicitly encode `side=supply` for supply intent and `side=demand&tab=needs` for demand intent.

- [ ] **Step 1: Update the regression contract**

```ts
it('emits canonical supply intent explicitly', () => {
  expect(buildExploreHubSearchHref('id', 'supply', ' supplier kemasan ')).toBe(
    '/id/explore?q=supplier+kemasan&side=supply',
  );
});

it('routes demand searches directly to buyer needs', () => {
  expect(buildExploreHubSearchHref('en', 'demand', 'design service')).toBe(
    '/en/explore?q=design+service&side=demand&tab=needs',
  );
});
```

- [ ] **Step 2: Run the focused test when a runner is available**

Run:
`npx vitest run src/lib/discovery/exploreHubRoutes.test.ts`

Expected before implementation: the supply test fails because the current helper omits `side=supply`.

- [ ] **Step 3: Implement the minimal canonical emitter**

```ts
if (clean) params.set('q', clean);
params.set('side', intent);
if (intent === 'demand') params.set('tab', 'needs');
```

- [ ] **Step 4: Re-run the focused test when available**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/www/src/lib/discovery/exploreHubRoutes.ts frontend/apps/www/src/lib/discovery/exploreHubRoutes.test.ts
git commit -m "fix: canonicalize Explore supply and demand URLs"
```

### Task 2: Explore Search Presentation Stabilization

**Files:**
- Modify only as needed: existing `ExploreHubPage.tsx`
- Modify only as needed: existing `ExploreSearchResults.tsx`
- Modify only as needed: existing Explore result helpers/tests

**Interfaces:**
- Consumes: canonical URL helpers from Task 1; Wave 7 `rankGlobalSearchItems`/dedupe contract.
- Produces: readable Explore presentation code that preserves server/backend order and truthful sort labels.

- [ ] **Step 1: Inspect the current files and identify compacted blocks**

Reject any refactor that changes visible behavior without a Wave 8 requirement.

- [ ] **Step 2: Add/adjust a regression test around result ordering only if the presentation layer can reorder items**

```ts
expect(renderedIds).toEqual(['backend-first', 'backend-second']);
```

- [ ] **Step 3: Remove any presentation-layer sort/rerank that competes with backend order**

Keep only explicit stable dedupe by identity/href. Do not fuzzy-dedupe equal titles.

- [ ] **Step 4: Expand aggressively compacted JSX/logic into reviewable blocks**

Use named local constants/functions only where they improve one clear responsibility. Do not redesign layout.

- [ ] **Step 5: Commit**

```bash
git add frontend/apps/www/src
git commit -m "refactor: stabilize Explore result presentation"
```

### Task 3: Complete Public Static/Trust Metadata Parity

**Files:**
- Inspect existing shared metadata helper under `frontend/apps/www/src/lib/seo/`.
- Modify existing Trust/Cookie/Refund/Terms/Privacy/Support/Contact page metadata only where parity is missing.
- Add/update focused metadata helper tests if the helper supports these pages.

**Interfaces:**
- Consumes: existing `publicStaticPageMetadata`-style helper and locale routing convention.
- Produces: locale-correct canonical, hreflang, OG/Twitter, and robots contracts without page-local language drift.

- [ ] **Step 1: Inventory all remaining static/trust pages against helper usage**

For each page, record: localized title/description, canonical path, indexability, and whether metadata comes from the shared helper.

- [ ] **Step 2: Add focused contract tests for missing cases**

```ts
expect(metadata.alternates?.canonical).toContain('/id/refund-policy');
expect(metadata.alternates?.languages).toMatchObject({ id: expect.any(String), en: expect.any(String), 'x-default': expect.any(String) });
```

- [ ] **Step 3: Move page-local metadata onto the existing shared helper**

Do not rewrite legal/policy body copy except current product terminology mismatches already established in prior waves.

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/www/src/app frontend/apps/www/src/lib/seo
git commit -m "fix: complete public trust metadata parity"
```

### Task 4: Preserve and Document UMKM Map Compatibility

**Files:**
- Inspect existing `/umkm` page/layout/metadata files.
- Modify only if current behavior violates the Wave 8 contract.
- Modify `frontend/apps/www/src/lib/discovery/exploreHubRoutes.test.ts` only if an additional map compatibility assertion is useful.

**Interfaces:**
- Consumes: `buildNearbyBusinessesHref()` returning `/umkm?view=map`.
- Produces: functional legacy map compatibility while Explore remains canonical discovery.

- [ ] **Step 1: Verify current route behavior**

The route must remain functional and must not redirect to Explore.

- [ ] **Step 2: Verify SEO contract in code**

Required state: `noindex,follow`, canonical to Explore businesses, excluded from sitemap.

- [ ] **Step 3: Make only the minimal correction if any of those assertions are false**

Do not remove map/deep-link query handling.

- [ ] **Step 4: Commit if changed**

```bash
git add frontend/apps/www/src
git commit -m "fix: preserve UMKM map compatibility contract"
```

### Task 5: Public Detail/Profile CTA Safety Audit

**Files:**
- Inspect existing listing detail page/components.
- Inspect existing need detail page/components.
- Inspect existing business profile page/components.
- Inspect existing user profile page/components.
- Inspect existing chat/contact route definitions before adding any direct CTA.

**Interfaces:**
- Consumes: existing route/auth contracts only.
- Produces: clear next actions without dead links or invented chat URLs.

- [ ] **Step 1: Inventory current primary CTA per surface**

Record destination and auth requirement for listing, need, business profile, and user profile.

- [ ] **Step 2: Search repository for an existing public-safe chat/contact route**

A valid route must have an existing implementation and permission/auth handling. Route-name similarity alone is insufficient.

- [ ] **Step 3: If safe chat cannot be proven, preserve existing safe actions and defer direct chat to Wave 9**

Do not add a speculative `/chat/...` link.

- [ ] **Step 4: If an obvious dead end exists, route to the nearest existing safe action**

Examples allowed only if already implemented: profile, auth boundary, create need/offer, or existing contact flow.

- [ ] **Step 5: Commit if changed**

```bash
git add frontend/apps/www/src
git commit -m "fix: harden public detail and profile actions"
```

### Task 6: Funnel Analytics Deduplication and Naming Audit

**Files:**
- Inspect existing public Explore/detail analytics helpers and call sites.
- Modify only duplicated or inconsistent event call sites.

**Interfaces:**
- Consumes: existing analytics infrastructure.
- Produces: one event per user action with stable non-sensitive fields.

- [ ] **Step 1: Inventory existing events for search, result click, zero-result recovery, primary CTA, create need/offer**

- [ ] **Step 2: Remove duplicate emission paths for the same click where found**

- [ ] **Step 3: Normalize action names only when existing code already has conflicting names for the same action**

Never log credentials, messages, identity documents, or sensitive payloads.

- [ ] **Step 4: Commit if changed**

```bash
git add frontend/apps/www/src
git commit -m "fix: normalize public funnel analytics"
```

### Task 7: Integration Review, PR, and Merge

**Files:**
- All Wave 8 changed files.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: reviewable Wave 8 PR merged to `main` under the user-requested workflow.

- [ ] **Step 1: Compare branch against `main`**

Verify the diff contains only Wave 8 stabilization work and docs.

- [ ] **Step 2: Inspect changed files for accidental compaction, invented routes, unsupported claims, or scope expansion**

- [ ] **Step 3: Check GitHub mergeability/status if available**

Do not equate mergeable with test-green.

- [ ] **Step 4: Open PR with explicit verification caveat**

State that separate tests/build did not block merge by user request and that no green claim is being made.

- [ ] **Step 5: Merge directly to `main` if GitHub accepts the PR**

- [ ] **Step 6: User local quality gate after merge**

```powershell
cd D:\LAJUKAN\intervia-my-id
git checkout main
git pull origin main
.\up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build
```

If that command fails, debug the concrete failure before claiming Wave 8 verified.
