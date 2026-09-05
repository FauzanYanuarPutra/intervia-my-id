# Detail to Chat Conversion Wave 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing public detail/profile → direct-chat funnel so authentication context, peer identity, self-contact prevention, and public lead context are consistent and safe.

**Architecture:** Reuse the already implemented Google `callbackUrl` flow and the existing authenticated `POST /api/chat/dm` contract. Keep the large public detail/profile clients intact where they already create direct rooms correctly; strengthen the shared DM boundary so every existing caller inherits the same identity and context rules, and add focused pure helpers/tests for the contract.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, existing `requireAuth`, `authFetch`, chat service, marketplace CRM lead endpoint.

**Spec:** `docs/superpowers/specs/2026-09-05-detail-chat-conversion-wave9-design.md`

## Global Constraints

- Existing direct-message route is `POST /api/chat/dm` with `peer_user_id`.
- Existing login continuation uses `/${locale}/login?callbackUrl=...` and Google auth forwards `callbackUrl`.
- Public content detail and public profile already call the DM endpoint; do not invent a new chat route.
- Never allow self-contact at the shared server boundary.
- Forward only allowlisted public lead metadata; never pass arbitrary nested user data through the chat boundary.
- Preserve `content_id` only when UUID-like.
- Do not change auth architecture, chat subsystem, database schema, payments, backend search ranking, or `/umkm`.
- No test/build-green claim without actual execution.

---

### Task 1: Define Direct-Message Contract Helpers

**Files:**
- Create: `frontend/apps/www/src/lib/chat/dmContract.test.ts`
- Create: `frontend/apps/www/src/lib/chat/dmContract.ts`

**Interfaces:**
- Produces `isUuidLike(value)`, `isSelfDm(currentUserId, peerUserId)`, and `sanitizeDmLeadInput(input)`.
- `sanitizeDmLeadInput` returns only public/operational CRM fields accepted by the current route.

- [ ] **Step 1: Write contract tests first**

Test UUID validation, case-insensitive self-DM detection, metadata allowlisting, nested/private metadata stripping, and valid `content_id` retention.

- [ ] **Step 2: Run focused test when a runner is available**

`npx vitest run src/lib/chat/dmContract.test.ts`

Expected before implementation: module/exports missing.

- [ ] **Step 3: Implement the minimal pure helpers**

Allow lead fields: `name`, `sector`, `source`, `stage`, `currency`, `chat_room_id`, `value_cents`, valid UUID `content_id`, and a strictly allowlisted `metadata` subset (`listing_side`, `market_side`, `fulfillment_mode`, `content_type`, `category`, `source_surface`).

- [ ] **Step 4: Commit**

`git commit -m "feat: define safe public DM contract"`

### Task 2: Harden the Shared DM API Boundary

**Files:**
- Modify: `frontend/apps/www/src/app/api/chat/dm/route.ts`

**Interfaces:**
- Consumes Task 1 helpers.
- Keeps request shape backward-compatible: `{ peer_user_id, lead?, skip_lead? }`.
- Keeps success response `{ room_id }`.

- [ ] **Step 1: Replace local UUID parsing with the shared helper**

- [ ] **Step 2: Reject `peer_user_id === authenticated user id` before calling chat service**

Return HTTP 400 with `Cannot create a direct message with yourself`.

- [ ] **Step 3: Sanitize CRM lead input before constructing the final lead**

Do not forward arbitrary metadata objects.

- [ ] **Step 4: Preserve existing rate limits, chat service call, fire-and-forget CRM lead creation, and service-unavailable behavior**

- [ ] **Step 5: Commit**

`git commit -m "fix: harden public direct-message boundary"`

### Task 3: Confirm Existing Funnel Contracts Stay Truthful

**Files:**
- Inspect only unless a small correction is necessary:
  - `frontend/apps/www/src/app/[locale]/(shared)/content/[id]/ContentDetailClient.tsx`
  - `frontend/apps/www/src/app/[locale]/(shared)/profile/[slug]/PublicProfileClient.tsx`
  - `frontend/apps/www/src/app/[locale]/(auth)/GoogleAuthOnlyClient.tsx`
  - `frontend/apps/www/src/lib/authRoutes.ts`

**Verified contracts to preserve:**
- content/profile direct-chat callers use `/api/chat/dm`;
- content detail uses login `callbackUrl` when unauthenticated;
- Google auth forwards `callbackUrl`;
- auth route helper preserves query state.

- [ ] **Step 1: Do not add duplicate CTA UI where the existing clients already expose contact/chat actions**

- [ ] **Step 2: Do not change large client files solely for stylistic consistency**

- [ ] **Step 3: Document any deferred UI consolidation in the PR**

### Task 4: Review, PR, Merge

**Files:** all Wave 9 changes.

- [ ] **Step 1: Compare branch against `main` and reject unrelated changes**

- [ ] **Step 2: Open PR with explicit verification caveat**

- [ ] **Step 3: Merge directly to `main` if GitHub reports mergeable, per user workflow**

- [ ] **Step 4: Post-merge local quality gate**

```powershell
cd D:\LAJUKAN\intervia-my-id
git checkout main
git pull origin main
.\up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build
```
