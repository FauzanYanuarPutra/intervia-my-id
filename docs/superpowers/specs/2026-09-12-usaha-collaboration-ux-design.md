# Lajukan Usaha Collaboration UX Design

## Goal

Make collaboration in Lajukan Usaha obvious and reliable: a user can own businesses, join other people's businesses, receive invitations from anywhere in the portal, accept or reject them, and always understand which business they own versus which business they joined and what role they hold.

## Product principles

1. One Lajukan account may own multiple businesses and join multiple businesses owned by other people.
2. Pending invitations never grant business access. Access starts only after acceptance.
3. Identity Service is the source of truth for organization membership, roles, and invitations.
4. Marketplace Service remains the source of truth for canonical business/store data.
5. Usaha combines those sources for presentation; it must not maintain a second membership or invitation store in Marketplace metadata.
6. Users should not need to understand technical terms such as organization, tenant, or workspace.
7. All permission-sensitive menus and actions continue to derive from the user's canonical role.
8. The feature must work across desktop and mobile portal layouts and remain understandable with one or many businesses.

## Current gaps

- Identity already supports creating, listing received, accepting, and rejecting organization invitations, but the recipient invitation UI is only surfaced on the home page.
- PortalShell has no global invitation indicator, so recipients can navigate elsewhere without seeing an invitation.
- BusinessSwitcher and PortfolioPanel flatten all accessible businesses into one list, making ownership versus membership ambiguous.
- Team page reads `teamMembers` and `invites` from Marketplace metadata, which can be empty or stale even when Identity has canonical membership/invitation records.
- There is no dedicated account-level place to inspect pending collaboration access.

## Canonical model

### Business relationship

Expose a presentation-safe relationship on each `BusinessRecord`:

- `owned`: the authenticated actor is the organization owner.
- `joined`: the actor has active organization membership but is not the owner.

`currentRole` remains the authority for feature permissions (`owner`, `manager`, `cashier`, `viewer`). Relationship is for user comprehension, not authorization.

### Invitation states

Use canonical Identity invitation states. The recipient-facing API exposes pending invitations that have not expired. Team-facing organization invitation history exposes `pending`, `accepted`, `rejected`, and `expired` for display. UI copy maps them to Indonesian labels: `Menunggu`, `Diterima`, `Ditolak`, `Kedaluwarsa`.

### Membership and invitation ownership

- Identity Service stores and returns organization members and organization invitations.
- Usaha Team page queries Identity through Usaha server/API helpers using `business.organizationId` after checking the current actor can view the business.
- No new Marketplace metadata fields are added for team membership or invitations.

## User experience

### Global invitation awareness

Every authenticated PortalShell shows an invitation button using a bell/mail icon. It fetches pending invitations from `/api/team/invitations` and displays a numeric badge when count > 0. Opening it shows a compact list of pending invitations with business name, role, expiry, and a link to the dedicated access page.

The control must not block normal navigation if the invitation endpoint temporarily fails. Errors appear inside the invitation surface, not as a portal-wide crash.

### Dedicated `Undangan & akses` page

Add `/access` as an account-level page, not business-scoped. It shows:

- pending invitations with business name, role, expiry, `Terima` and `Tolak` actions;
- a short explanation that an accepted business will appear automatically in the user's business list;
- after acceptance, refresh business data and offer `Buka usaha` when the newly accessible business can be resolved;
- empty state when there is no pending invitation.

The existing home invitation component may be replaced by a compact callout or reuse the same invitation list logic to avoid duplicate behavior.

### Business switcher

BusinessSwitcher groups accessible businesses into:

- `Milik saya`
- `Saya ikuti`

Each business item shows its role badge. Owned businesses show `Pemilik`; joined businesses show the normalized role (`Manager`, `Kasir`, `Pantau`). The create CTA is renamed to `Buat usaha baru` so it is not confused with joining an existing business.

### Portfolio / home

Rename `Usaha yang kamu kelola` to `Usaha saya`. Group cards under `Milik saya` and `Saya ikuti`. Preserve the active-business indicator and role information.

### Team page

Team page displays canonical Identity members and sent invitation history for the active business organization. Owner/manager permissions remain enforced by backend and portal permission checks. The page distinguishes active members from invitation history and uses human-readable invitation states.

## Backend/API changes

### Identity Service

Extend organization invitation routes with a manager-authorized organization-scoped listing endpoint:

`GET /organizations/{organization_id}/invitations`

Response fields include invitation id, organization id/name, invitee user id/username, role, status, expires_at, created_at, and responded_at where available. Expired pending rows are exposed as `expired` in the view without granting access.

Authorization: organization owner, `org_admin`, or `org_manager` may list invitations for that organization. Other members receive 403.

Existing recipient endpoints remain:

- `GET /organization-invitations`
- `POST /organization-invitations/{id}/accept`
- `POST /organization-invitations/{id}/reject`

### Usaha API/server layer

Add typed helpers/proxies for:

- current user's pending invitations;
- organization members;
- organization invitation history.

All proxies forward the existing bearer token and use `no-store`. Business-scoped Team APIs first resolve the business for the current actor and require its canonical `organizationId` before contacting Identity.

## Error handling

- Invalid/expired invitation response: surface a friendly message and refresh the pending list.
- Invitation endpoint unavailable: show a localized inline error; do not hide existing businesses or crash PortalShell.
- Business has no organization linkage: Team page shows a repair-oriented state instead of fake empty members.
- Accepted invitation whose business projection is not immediately available: show acceptance success and advise refresh; do not fabricate a business URL.

## Security and rights

- Accept/reject operations remain limited to the invitation's invitee user id.
- Sent-invitation history requires owner/admin/manager authorization in Identity.
- Relationship labels never grant permissions.
- Business membership remains tenant-scoped by organization id.
- No user may see another organization's invitation history without canonical membership and management rights.
- Pending invitations never appear in the business switcher.

## Testing

### Identity

- authorized owner/admin/manager can list organization invitations;
- cashier/viewer cannot list organization invitation history;
- expired pending invitations render as expired;
- accept creates/activates organization membership and updates invitation status;
- reject does not create membership.

### Usaha

- relationship derivation returns `owned` for owner and `joined` for non-owner member;
- BusinessSwitcher separates owned and joined businesses;
- PortfolioPanel separates owned and joined businesses;
- invitation badge/list parses pending invitation payloads and role labels;
- access page acceptance/rejection refresh behavior is covered by pure helpers/component tests where practical;
- Team page adapters map canonical Identity member/invitation payloads without relying on Marketplace metadata.

## Rollout

Implement on an isolated feature branch. Run focused Rust and Usaha tests first, then Usaha typecheck/build and repository CI. Merge only after inspecting the exact branch head and reconciling any conflict with newer `main`.