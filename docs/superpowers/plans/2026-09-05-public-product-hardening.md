# Public Product Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lajukan's public web surface crawlable, coherent, canonical, and consistent with the current product/auth architecture.

**Architecture:** Keep the current Next.js app boundaries. Add a server-rendered homepage intro around the existing client marketplace, consolidate legacy search at the Next config edge, centralize system-profile filtering in the server profile resolver, and tighten robots/sitemap policy. Keep `usaha` as a separate non-indexed Business OS.

**Tech Stack:** Next.js 16, React 19, TypeScript, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-public-product-hardening-design.md`

## Global Constraints
- Preserve current public contracts except the explicitly approved `/search` -> `/explore` consolidation.
- Do not activate payments or add product verticals.
- Do not migrate normal public profile slugs in this pass.
- Keep `usaha` separate from marketplace discovery.

---

### Task 1: Crawlable homepage proposition
**Files:** modify home page/layout; add focused regression test if practical.
- [ ] Add semantic localized H1/copy/CTAs in the server component.
- [ ] Preserve existing `HomeContentSimple` below the intro.
- [ ] Align metadata with the same canonical proposition.
- [ ] Run affected tests/type checks.

### Task 2: Canonical search routing and index policy
**Files:** modify `next.config.mjs`, `robots.ts`, `sitemap.ts`; add config/policy tests where practical.
- [ ] Redirect locale `/search` to locale `/explore` permanently and preserve query string.
- [ ] Add search to robots disallow list.
- [ ] Remove legacy `/umkm` from sitemap while keeping route compatibility outside this task.
- [ ] Confirm no arbitrary search URL is emitted by sitemap.

### Task 3: System-profile public guard
**Files:** modify `src/lib/server/publicProfile.ts` and tests.
- [ ] Add deterministic `isSystemPublicProfileIdentity` guard for all-zero UUID and super-admin seed slugs/records.
- [ ] Return `not_found` before public rendering/discovery matching.
- [ ] Add unit coverage for normal vs system identities.

### Task 4: Authentication/support copy alignment
**Files:** modify support and refund-policy pages.
- [ ] Replace OTP/password/phone-login wording with Google-first account/session wording.
- [ ] Replace phone-number evidence requirement with account email/account identifier.
- [ ] Keep support contact phone/WhatsApp unchanged because those are contact channels, not login identifiers.

### Task 5: Lajukan Usaha identity check
**Files:** modify `frontend/apps/usaha/src/app/layout.tsx` only if needed.
- [ ] Use `Lajukan Usaha` as canonical product name.
- [ ] Keep robots noindex/nofollow until a separate public Business OS landing strategy is approved.
- [ ] Keep description focused on operating a business, not marketplace discovery.

### Task 6: Verification and handoff
- [ ] Inspect branch diff against `main`.
- [ ] Run/inspect available CI status for the branch/PR; do not claim local build evidence if no runner was executed.
- [ ] Open PR to `main` so GitHub Actions runs the repository's normal gates.
- [ ] Provide exact fetch/merge commands and rollback commands to the user.
