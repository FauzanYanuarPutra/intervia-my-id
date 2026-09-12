# Lajukan Usaha Collaboration UX Design

## Goal

Make collaboration in Lajukan Usaha obvious and reliable: one account can own businesses, join businesses owned by other people, receive invitations from anywhere in the portal, accept or reject them, and always understand its role and access boundary.

## Product principles

1. One Lajukan account may own multiple businesses and join multiple businesses owned by other people.
2. A pending invitation never grants access. Membership starts only after acceptance.
3. Identity Service is the source of truth for organization membership, roles, and invitations.
4. Marketplace Service remains the source of truth for canonical business/store data.
5. Usaha composes those sources for presentation; it does not create a second member/invitation store in Marketplace metadata.
6. Users see human language such as `Milik saya`, `Saya ikuti`, `Pemilik`, `Manager`, `Kasir`, and `Pantau`, not organization/tenant implementation details.
7. Relationship labels are presentation only. Authorization continues to use the canonical normalized role and permission map.
8. Failures in invitation UI must not crash normal portal navigation.

## Canonical model

### Business relationship

Presentation helpers classify each accessible business as:

- `owned`: the authenticated actor is the owner; normalized `currentRole` is `owner`.
- `joined`: the actor has active access through organization membership but does not own the business.

`BusinessRecord.relationship` is additive for typed callers; legacy records safely fall back to the normalized role so existing fixtures and older payloads remain compatible.

### Invitation states

Identity remains authoritative for invitation lifecycle. Recipient-facing reads return pending, unexpired invitations. Manager-facing history exposes existing statuses and projects an expired pending invitation as `expired` for display.

UI labels are:

- `pending` → `Menunggu`
- `accepted` → `Diterima`
- `rejected`/`declined` → `Ditolak`
- `expired` → `Kedaluwarsa`

### Membership and invitation ownership

- Identity stores organization users and organization invitations.
- Usaha Team reads canonical members from `GET /organizations/{id}/members`.
- Usaha Team reads canonical invitation history from the existing invitation collection endpoint using an authorized organization scope.
- Marketplace metadata is no longer treated as the canonical Team directory.

## User experience

### Global invitation awareness

Every authenticated `PortalShell` shows an invitation bell. It reads `/api/team/invitations`, displays a numeric badge, and previews pending invitations with business name, role, and expiry.

The indicator refreshes:

- on initial mount;
- when the browser window regains focus;
- every 60 seconds while the page remains open;
- immediately after an invitation is accepted or rejected through the shared `lajukan:invitations-changed` browser event.

An invitation endpoint failure stays inside the indicator and does not block the portal.

### Dedicated `Undangan & akses` page

`/access` is account-scoped rather than business-scoped. It shows pending invitations with `Terima & ikut usaha` and `Tolak`, explains that pending invitations do not grant access, and shows the account's currently accessible businesses.

After accept/reject the local invitation disappears, the global badge refreshes immediately, and `router.refresh()` asks the server for the latest accessible-business portfolio. If downstream business projection is not immediate, the success message explicitly says access may appear after synchronization instead of inventing a business URL.

### Business switcher and portfolio

Both components use the same grouping helper and present two sections:

- `Milik saya`
- `Saya ikuti`

Each business displays a normalized role badge. Creation uses the wording `Buat usaha baru` so creating a business is not confused with joining someone else's business.

### Team page

The Team page keeps invite creation permission-gated, but member and invitation display comes from Identity canonical data. It shows:

- active-member count;
- pending-invitation count;
- canonical member identity and role;
- sent-invitation history with human status labels;
- a repair-oriented synchronization error instead of a fabricated empty directory when Identity/linkage is unavailable.

## Identity API

Existing recipient endpoints remain unchanged:

- `GET /organization-invitations`
- `POST /organization-invitations/{id}/accept`
- `POST /organization-invitations/{id}/reject`

The existing list endpoint also supports manager history mode:

`GET /organization-invitations?organization_id=<uuid>`

When `organization_id` is present, Identity requires an active organization member who is the owner, `org_admin`, or `org_manager`. Unauthorized roles receive 403. The query returns invitation history for that organization only and converts pending rows past their expiry to the display status `expired`.

This reuses one invitation collection contract instead of adding a duplicate organization-invitation route.

## Usaha server layer

`business-collaboration-server.ts` first resolves the business for the authenticated actor, requires a canonical `organizationId`, forwards the current bearer token to Identity with `no-store`, and parses typed member/invitation responses.

The browser continues to use the existing same-origin invitation proxy for the current user's incoming invitations and accept/reject actions. No Identity bearer token is exposed to client code.

## Security and rights

- Accept/reject remains limited to the invitation's `invitee_user_id`.
- Organization invitation history is limited to owner/admin/manager in Identity.
- Team page remains hidden from cashier/viewer by the Usaha permission map, while Identity still enforces its own boundary.
- Relationship labels never grant permissions.
- Membership remains scoped by organization id.
- Pending invitations never appear in the accessible-business switcher.
- No Marketplace metadata field can independently grant Team access.

## Error handling

- Expired/already-processed invitation: display the upstream failure and refresh on the next normal invitation load.
- Invitation list unavailable: show an inline notification error, not a portal crash.
- Missing business/organization link: canonical Team reader fails closed and the Team page renders a synchronization-repair state.
- Business projection lag after acceptance: report successful acceptance and synchronization delay honestly.

## Verification requirements

### Identity

- invitation status contract covers pending, accepted, rejected, and expired projection;
- `cargo fmt --check` passes;
- Clippy passes with warnings denied;
- full Identity tests pass.

### Usaha

- collaboration grouping and Indonesian labels are unit-tested;
- invitation parsing, badge counting, and expiry presentation are unit-tested;
- all existing Usaha tests remain green;
- TypeScript typecheck passes;
- production build passes;
- Business OS architecture/gate passes.

## Rollout

Implement on `feat/usaha-collaboration-ux`, review the exact PR head, reconcile if `main` moves, and squash-merge to `main`. Known infrastructure-only workflow failures may be handled separately only if feature-specific Identity/Usaha checks remain green and the repository owner explicitly authorizes merging despite the unrelated gate.