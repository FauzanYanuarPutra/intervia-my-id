# Migration Policy

Status: repo audit 2026-07-11.

## Rules

1. Never edit an applied migration.
2. Add new timestamped `.up.sql` and `.down.sql` files when the service pattern has both.
3. Keep migrations service-owned:
   - identity/auth/profile in `services/identity_service/migrations`
   - marketplace/content/commerce/ops in `services/marketplace_service/migrations`
   - forum/reels/groups in `services/community_service/migrations`
   - chat schema in `services/chat_service/priv/scylladb`
4. Add indexes in the same migration family as new query behavior.
5. Backfill safely and idempotently.
6. Use nullable/additive changes first for live data.
7. Do not make AI-generated data authoritative without user/admin confirmation and audit trail.

## Cross-Service Data

Use outbox/inbox/read models for cross-service synchronization. Do not query another service database directly from runtime code unless there is an explicit architecture decision.

## Rollback

Down migrations should preserve safety. If destructive rollback is unavoidable, document data loss risk in the migration and PR.
