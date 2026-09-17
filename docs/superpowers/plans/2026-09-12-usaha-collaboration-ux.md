# Lajukan Usaha Collaboration UX Implementation Plan

**Goal:** Make invitations, membership, ownership, role visibility, and business switching understandable and reliable across Lajukan Usaha.

**Architecture:** Identity Service remains authoritative for organization members and invitations. Marketplace remains authoritative for business/store data. Usaha composes both sources and never maintains a parallel membership store.

**Spec:** `docs/superpowers/specs/2026-09-12-usaha-collaboration-ux-design.md`

## Constraints

- Pending invitations never grant access.
- Accept/reject is limited to the invitation recipient.
- Sent-invitation history is owner/admin/manager only.
- Relationship labels never grant permissions.
- Team canonical data comes from Identity, not Marketplace metadata.
- User copy stays simple: `Milik saya`, `Saya ikuti`, `Pemilik`, `Manager`, `Kasir`, `Pantau`.

## Task 1 — Identity invitation history

**Files**
- `services/identity_service/src/organizations/invitation_status.rs`
- `services/identity_service/src/organizations/invitations.rs`
- `services/identity_service/src/organizations/mod.rs`
- `services/identity_service/tests/organization_invitation_history_contract.rs`

- [x] Add a status contract for pending/accepted/rejected/expired invitations.
- [x] Preserve the existing recipient endpoint `GET /organization-invitations`.
- [x] Add authorized manager-history mode through `GET /organization-invitations?organization_id=<uuid>` instead of creating a duplicate route.
- [x] Require owner, `org_admin`, or `org_manager` for organization-scoped history.
- [x] Project expired pending rows to `expired` for display without changing membership.
- [x] Keep accept/reject invitee-scoped and unchanged.
- [x] Verify rustfmt.
- [x] Verify Clippy with warnings denied.
- [x] Verify full Identity tests.

## Task 2 — Shared Usaha collaboration model

**Files**
- `frontend/apps/usaha/src/lib/portal-types.ts`
- `frontend/apps/usaha/src/lib/business-collaboration.ts`
- `frontend/apps/usaha/src/lib/business-collaboration.test.ts`
- `frontend/apps/usaha/src/lib/business-collaboration-server.ts`

- [x] Add additive `BusinessRelationship` typing while keeping legacy fixture compatibility.
- [x] Add one shared owned/joined grouping helper.
- [x] Add normalized Indonesian role and invitation-status labels.
- [x] Add typed Identity member/invitation parsers.
- [x] Add server-only canonical Identity readers that resolve the current business and require `organizationId`.
- [x] Preserve `currentRole` as the authorization authority; relationship is presentation only.

## Task 3 — Global invitation awareness

**Files**
- `frontend/apps/usaha/src/lib/invitation-ui.ts`
- `frontend/apps/usaha/src/lib/invitation-ui.test.ts`
- `frontend/apps/usaha/src/components/portal/InvitationIndicator.tsx`
- `frontend/apps/usaha/src/components/portal/PendingOrganizationInvitations.tsx`
- `frontend/apps/usaha/src/components/portal/PortalShell.tsx`
- `frontend/apps/usaha/src/app/(portal)/access/page.tsx`

- [x] Prove RED with a missing `invitation-ui` module while all pre-existing suites stay green.
- [x] Parse pending Identity invitations through one shared helper.
- [x] Add global bell + numeric badge to every authenticated portal header.
- [x] Add compact invitation preview and `/access` navigation.
- [x] Add an account-level `Undangan & akses` page with accept/reject and empty state.
- [x] Add explicit acceptance/rejection feedback.
- [x] Synchronize the global badge immediately through `lajukan:invitations-changed`.
- [x] Refresh invitations on window focus and every 60 seconds while open.
- [x] Fail invitation UI inline without crashing the portal.

## Task 4 — Owned versus joined navigation

**Files**
- `frontend/apps/usaha/src/components/portal/BusinessSwitcher.tsx`
- `frontend/apps/usaha/src/components/portal/PortfolioPanel.tsx`

- [x] Group accessible businesses into `Milik saya` and `Saya ikuti` with one shared helper.
- [x] Display the normalized role on every business entry.
- [x] Keep the active-business indicator.
- [x] Rename creation CTA to `Buat usaha baru` so it is distinct from joining another business.
- [x] Make account `/access` portfolio use the same grouping model.

## Task 5 — Canonical Team page

**Files**
- `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/team/page.tsx`
- `frontend/apps/usaha/src/lib/business-collaboration-server.ts`

- [x] Stop using Marketplace metadata as the canonical Team directory.
- [x] Read active organization members from Identity.
- [x] Read sent invitation history from Identity using organization-scoped authorization.
- [x] Keep invite creation permission-gated.
- [x] Show human invitation status labels.
- [x] Show a synchronization-repair state instead of fake empty data when canonical reads fail.

## Task 6 — Verification and merge

- [x] PR #268 opened against `main` from isolated branch `feat/usaha-collaboration-ux`.
- [x] TDD RED observed for missing collaboration helper with old suites green.
- [x] TDD RED observed for missing invitation UI helper with old suites green.
- [x] Usaha tests pass: 77 tests on the verified implementation head before documentation sync.
- [x] Usaha typecheck passes.
- [x] Usaha production build passes.
- [x] Usaha Business OS contract and aggregate gate pass.
- [x] Identity rustfmt passes.
- [x] Identity Clippy passes with warnings denied.
- [x] Identity full tests pass.
- [ ] Verify all workflows on the final documentation-synchronized head.
- [ ] Mark PR ready and squash-merge with exact expected head SHA.
- [ ] Verify remote `main` contains the squash commit and report pull/build commands.

## Implementation notes

The initial design proposed a new `GET /organizations/{id}/invitations` route and extra Usaha proxy routes. During implementation, the smaller and safer architecture was chosen: the existing Identity invitation collection endpoint accepts an optional authorized `organization_id` scope, while the server-rendered Team page calls Identity through a server-only helper. This reduces public API surface and avoids duplicating invitation contracts without weakening authorization.
