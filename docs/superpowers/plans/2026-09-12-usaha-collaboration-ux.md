# Lajukan Usaha Collaboration UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make business invitations, membership, ownership, role visibility, and switching understandable and reliable across Lajukan Usaha.

**Architecture:** Identity Service remains authoritative for organization members and invitations; Marketplace remains authoritative for business/store data. Usaha adds typed collaboration adapters and presentation helpers, then surfaces pending invitations globally, adds an account-level access page, groups businesses by ownership relationship, and switches Team to canonical Identity-backed member/invitation data.

**Tech Stack:** Rust/Axum/SQLx, Next.js 16, React 19, TypeScript 5.9, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-usaha-collaboration-ux-design.md`

## Global Constraints

- Pending invitations never grant business access.
- Identity Service is the source of truth for organization membership, roles, and invitations.
- Marketplace Service remains the source of truth for canonical business/store data.
- Relationship labels are presentation only and never grant permissions.
- No parallel invitation/member store may be introduced in Marketplace metadata.
- All invitation and membership reads are tenant-scoped and authorized.
- User-facing copy uses Indonesian terms such as `Milik saya`, `Saya ikuti`, `Pemilik`, `Menunggu`, `Diterima`, `Ditolak`, and `Kedaluwarsa`.

---

### Task 1: Canonical organization invitation history in Identity

**Files:**
- Modify: `services/identity_service/src/organizations/domain.rs`
- Modify: `services/identity_service/src/organizations/invitations.rs`
- Modify: `services/identity_service/src/main.rs`
- Create: `services/identity_service/tests/organization_invitation_history_contract.rs`

**Interfaces:**
- Produces: `GET /organizations/{organization_id}/invitations`
- Produces: invitation view with `responded_at` and display status that converts expired pending rows to `expired`.

- [ ] **Step 1: Write failing contract tests** for manager-authorized listing, viewer rejection, and expired status projection.
- [ ] **Step 2: Run Identity focused tests** with `cargo test organization_invitation --manifest-path services/identity_service/Cargo.toml` and confirm the new test fails because the organization-scoped listing API/helper does not exist yet.
- [ ] **Step 3: Extend `OrganizationInvitationView`** with `responded_at: Option<DateTime<Utc>>`.
- [ ] **Step 4: Implement organization-scoped invitation listing** in `invitations.rs`, authorizing owner/`org_admin`/`org_manager`, selecting all invitation states for that organization, and projecting expired pending rows as `expired`.
- [ ] **Step 5: Register `GET /organizations/{id}/invitations`** beside the existing POST route in `main.rs`.
- [ ] **Step 6: Re-run focused Identity tests** and then `cargo fmt --check --manifest-path services/identity_service/Cargo.toml` plus `cargo clippy --manifest-path services/identity_service/Cargo.toml --all-targets -- -D warnings`.
- [ ] **Step 7: Commit** with `feat(identity): expose organization invitation history`.

### Task 2: Typed Usaha collaboration model and adapters

**Files:**
- Modify: `frontend/apps/usaha/src/lib/portal-types.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.test.ts`
- Create: `frontend/apps/usaha/src/lib/business-collaboration.ts`
- Create: `frontend/apps/usaha/src/lib/business-collaboration.test.ts`
- Create: `frontend/apps/usaha/src/lib/business-collaboration-server.ts`

**Interfaces:**
- Produces: `BusinessRelationship = 'owned' | 'joined'` and `BusinessRecord.relationship`.
- Produces: typed `OrganizationMember`, `OrganizationInvitation`, parsing/grouping/role/status helpers.
- Produces: server helpers `listOrganizationMembersForBusiness(...)` and `listOrganizationInvitationsForBusiness(...)`.

- [ ] **Step 1: Write failing Vitest cases** proving owner versus joined relationship derivation, invitation status/role labels, and Identity payload mapping.
- [ ] **Step 2: Run focused tests** from `frontend/apps/usaha` with `npm test -- src/lib/business-server.test.ts src/lib/business-collaboration.test.ts` and confirm failures are for missing relationship/helpers.
- [ ] **Step 3: Add typed collaboration models and pure helpers** in `business-collaboration.ts`.
- [ ] **Step 4: Derive `BusinessRecord.relationship`** from Identity organization ownership in `business-server.ts`, keeping `currentRole` authoritative for permissions.
- [ ] **Step 5: Add server-only Identity readers** that forward the bearer token and return canonical members/invitations without Marketplace metadata fallback.
- [ ] **Step 6: Re-run focused Vitest tests** until green.
- [ ] **Step 7: Commit** with `feat(usaha): add canonical collaboration adapters`.

### Task 3: Global invitation awareness and account access page

**Files:**
- Create: `frontend/apps/usaha/src/components/portal/InvitationIndicator.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/PendingOrganizationInvitations.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/PortalShell.tsx`
- Create: `frontend/apps/usaha/src/app/(portal)/access/page.tsx`
- Modify: `frontend/apps/usaha/src/lib/portal-types.ts`
- Modify: `frontend/apps/usaha/src/components/portal/SidebarNav.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/MobileNav.tsx`
- Create: `frontend/apps/usaha/src/lib/invitation-ui.test.ts`

**Interfaces:**
- Consumes: existing `/api/team/invitations` GET and POST response route.
- Produces: global badge/dropdown linking to `/access`.
- Produces: account-level access page with accept/reject and friendly success/error states.

- [ ] **Step 1: Write failing pure UI-helper tests** for invitation count, Indonesian role labels, expiry formatting/status, and response-state removal.
- [ ] **Step 2: Run focused Vitest test** and confirm failure for missing helpers.
- [ ] **Step 3: Implement `InvitationIndicator`** as a non-blocking client component that fetches pending invitations and shows a numeric badge plus compact preview.
- [ ] **Step 4: Mount it in `PortalShell`** for authenticated users on desktop and mobile header surfaces.
- [ ] **Step 5: Add account-level `/access` page** and extend portal section typing/header copy without adding it to business permission-gated navigation.
- [ ] **Step 6: Improve `PendingOrganizationInvitations`** so accept/reject gives explicit feedback and refreshes accessible businesses after acceptance.
- [ ] **Step 7: Re-run focused tests and Usaha typecheck** with `npm test -- src/lib/invitation-ui.test.ts` and `npm run typecheck`.
- [ ] **Step 8: Commit** with `feat(usaha): surface invitations across the portal`.

### Task 4: Owned versus joined business navigation

**Files:**
- Modify: `frontend/apps/usaha/src/components/portal/BusinessSwitcher.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/PortfolioPanel.tsx`
- Modify: `frontend/apps/usaha/src/app/page.tsx`
- Modify: `frontend/apps/usaha/src/lib/business-collaboration.ts`
- Modify: `frontend/apps/usaha/src/lib/business-collaboration.test.ts`

**Interfaces:**
- Consumes: `BusinessRecord.relationship` and `currentRole`.
- Produces: stable grouping function used by both switcher and portfolio.

- [ ] **Step 1: Add failing grouping/order tests** for mixed owned/joined businesses and role labels.
- [ ] **Step 2: Run focused Vitest test** and confirm the new grouping expectations fail.
- [ ] **Step 3: Implement shared grouping/order helper** and use it from both UI components.
- [ ] **Step 4: Render `Milik saya` and `Saya ikuti` sections**, role badges, and rename the creation CTA to `Buat usaha baru`.
- [ ] **Step 5: Rename home portfolio title to `Usaha saya`** and keep active business clearly marked.
- [ ] **Step 6: Re-run focused tests, lint, and typecheck**.
- [ ] **Step 7: Commit** with `feat(usaha): distinguish owned and joined businesses`.

### Task 5: Canonical Team page members and sent invitations

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/team/page.tsx`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/team/members/route.ts`
- Create: `frontend/apps/usaha/src/app/api/businesses/[businessId]/team/invitations/route.ts`
- Modify: `frontend/apps/usaha/src/lib/business-collaboration-server.ts`
- Modify: `frontend/apps/usaha/src/lib/business-collaboration.test.ts`

**Interfaces:**
- Consumes: canonical Identity organization members and invitation history.
- Produces: Team UI that no longer depends on `business.teamMembers` / `business.invites` metadata for canonical collaboration state.

- [ ] **Step 1: Add failing adapter tests** for member mapping and invitation status mapping, including `expired`.
- [ ] **Step 2: Run focused tests** and verify failure.
- [ ] **Step 3: Add business-scoped Usaha proxy routes** that resolve the current actor business first, require `organizationId`, then call Identity.
- [ ] **Step 4: Update Team page** to fetch canonical data and display active members, access role, and sent invitation history with Indonesian states.
- [ ] **Step 5: Show a repair-oriented state** when organization linkage is missing instead of fake empty data.
- [ ] **Step 6: Re-run focused tests and Usaha typecheck/build**.
- [ ] **Step 7: Commit** with `feat(usaha): use canonical team membership data`.

### Task 6: Integration verification, PR, and main merge

**Files:**
- Review all files changed on `feat/usaha-collaboration-ux`.

**Interfaces:**
- Produces: one reviewable PR and a verified merge result.

- [ ] **Step 1: Run Identity verification**: format, clippy, focused/full tests as CI permits.
- [ ] **Step 2: Run Usaha verification**: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` through the repository CI environment.
- [ ] **Step 3: Open PR to `main`** and inspect exact-head workflows.
- [ ] **Step 4: Diagnose any new failure from logs**; do not bypass a gate or suppress a lint without root cause.
- [ ] **Step 5: Rebase/reconcile with newer `main` if needed** and re-run exact-head checks.
- [ ] **Step 6: Squash-merge with expected head SHA** after verification or, if the repository retains the already-known unrelated runtime-smoke red condition, document it explicitly before the owner-authorized merge.
- [ ] **Step 7: Verify remote `main` contains the squash commit and report exact pull commands.**
