# Public Detail Funnel Wave 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden public listing/profile detail SEO and trust contracts while preserving the existing Explore → detail funnel.

**Architecture:** Add focused pure SEO helpers for explicit availability and public profile metadata, then consume them from the existing listing/profile routes. Remove the Terms page-level metadata override so the localized layout remains authoritative.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-public-detail-funnel-wave6-design.md`

## Global Constraints
- No backend ranking, auth, payment, database, or chat-service changes.
- Never infer stock, ratings, response time, seller quality, or verification.
- Preserve current canonical content/profile routes.
- Missing/unavailable public records are `noindex,follow`.

---

### Task 1: Explicit public-detail SEO helpers

**Files:**
- Create: `frontend/apps/www/src/lib/seo/publicDetailSeo.ts`
- Test: `frontend/apps/www/src/lib/seo/publicDetailSeo.test.ts`

**Interfaces:**
- Produces `schemaAvailabilityFromMetadata(metadata)` and `buildPublicProfileMetadata(input)`.

- [ ] Write failing tests proving unknown/missing stock returns no schema availability, explicit in-stock/out-of-stock/preorder states map correctly, and profile metadata includes canonical/hreflang/OG/Twitter/robots.
- [ ] Run targeted Vitest and confirm RED before implementation when a local runner is available.
- [ ] Implement the minimal pure helpers.
- [ ] Re-run targeted Vitest and require zero failures before claiming green.

### Task 2: Listing schema truthfulness

**Files:**
- Modify: `frontend/apps/www/src/app/[locale]/(shared)/content/[id]/layout.tsx`

**Interfaces:**
- Consumes `schemaAvailabilityFromMetadata`.

- [ ] Keep Offer price/currency generation for explicit positive prices.
- [ ] Remove unconditional `https://schema.org/InStock`.
- [ ] Add `availability` only when the helper recognizes an explicit availability/stock metadata value.
- [ ] Localize the fallback listing description instead of always emitting Indonesian copy on English pages.

### Task 3: Public profile social metadata parity

**Files:**
- Modify: `frontend/apps/www/src/app/[locale]/(shared)/profile/[slug]/page.tsx`

**Interfaces:**
- Consumes `buildPublicProfileMetadata`.

- [ ] Keep canonical slug resolution and permanent redirect behavior unchanged.
- [ ] Generate localized canonical/hreflang/robots plus Open Graph and Twitter metadata through the helper.
- [ ] Preserve noindex/follow for missing/unavailable profiles.

### Task 4: Terms localized metadata ownership

**Files:**
- Modify: `frontend/apps/www/src/app/[locale]/(shared)/terms/page.tsx`

- [ ] Remove the static Indonesian `metadata` export and unused Metadata import.
- [ ] Let the existing localized Terms layout/helper remain the single metadata owner.

### Task 5: Verification and integration

- [ ] Run targeted tests for `publicDetailSeo.test.ts`.
- [ ] Run frontend lint/type/build commands available for `frontend/apps/www`.
- [ ] Run `python scripts/ci/check_repository_hygiene.py`.
- [ ] Review the final diff for backend/auth/payment/chat-service changes.
- [ ] Open a PR with truthful verification notes and merge only if GitHub reports it mergeable; do not claim local commands passed unless they were actually executed.
