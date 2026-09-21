# Domain Cutover Status

Status: checked against repository HEAD on 2026-09-21.

The domain extraction program is a staged strangler migration. A domain is not
considered cut over merely because a target service and target database exist.

A domain is backfill-scripted only when all of these are present together:

1. a target database/schema;
2. a legacy-to-target backfill SQL path;
3. an explicit reconciliation verifier;
4. a runner case in scripts/migrations/domain-cutover.sh;
5. a safe compatibility runtime while rollback is still possible.

A domain is deferred when the repository does not yet have a safe SQL-only
cutover path. Deferred domains are explicit so they cannot be mistaken for
completed extraction.

## Current status

| Domain | Status | Notes |
| --- | --- | --- |
| Profile | Backfill-scripted | Relational business/profile backfill exists. |
| Media | Deferred | Media state includes object-storage/upload concerns; SQL-only backfill is intentionally not fabricated. |
| News | Backfill-scripted | Content/editorial/source/review event backfill + reconciliation exists. |
| Order | Backfill-scripted | Orders, items, transitions and amount/attribution checks exist. |
| Payment | Backfill-scripted | Transactions, wallets, ledger, withdrawals and disputes have reconciliation checks. |
| Promotion | Backfill-scripted | Banner backfill and count reconciliation exist. |
| CRM | Backfill-scripted | Lead backfill and reconciliation exist. |
| Communication | Backfill-scripted | Notification backfill and reconciliation exist. |
| Trust | Backfill-scripted | Trust profile backfill and reconciliation exist. |
| Support | Backfill-scripted | Ticket/reply backfill and reconciliation exist. |
| Review | Backfill-scripted | Review backfill and rating reconciliation exist. |
| Search | Deferred | Search is a rebuildable projection rather than a transactional owner. |
| Audit | Deferred | Requires an immutable append-only sink and replay/retention contract first. |

## Safety rules

scripts/migrations/domain-cutover.sh never switches production traffic. It only
prepares and verifies target data.

TARGET_RESET=true is destructive to target-only rows and now requires the exact
confirmation token:

TARGET_RESET_CONFIRMATION=I_UNDERSTAND_TARGET_RESET

Production cutover still requires native-handler, reconciliation, rollback and
targeted E2E evidence described in
docs/architecture/domain-service-boundaries-2026-09.md.

CI enforces that every backfill-scripted domain has its SQL, verification
function, and runner case. Deferred domains must remain explicit and cannot
silently become executable cutover paths.
