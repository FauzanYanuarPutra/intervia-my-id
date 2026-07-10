# Database Map

Status: repo audit 2026-07-11.

## Identity Database

Migrations show these primary areas:

- Schemas: `public`, `core`, `identity`, `audit`, `events`.
- Users/profile: `core.users`, `core.user_profiles`, `core.user_identities`.
- Auth/session: `core.sessions`.
- Authorization: `roles`, `permissions`, `role_permissions`, `core.user_roles`.
- Organizations/groups: `organizations`, `organization_users`, `groups`, `group_users`, `group_roles`.
- Audit/events: `events.audit_logs`, `events.event_outbox`.

Evidence: `services/identity_service/migrations`.

## Marketplace Database

Primary tables observed:

- Listing/content: `listings`, `content_items`, `content_item_likes`, `reviews`.
- Guided create/search metadata: content metadata indexes including guided category, market side, location, lat/lng.
- Events/AI OS: `events.event_log`, `events.ai_decision_log`, `events.event_outbox`, `events.event_inbox`, `fraud_signals`, `automation_jobs`, `recommendation_impressions`, `recommendation_feedback`, `user_feature_snapshots`, `entity_feature_snapshots`, `fraud_cases`, `experiment_assignments`.
- Requests/offers: Lajukan request routes and content offers exist; deeper table mapping needs a targeted migration read.
- UMKM commerce: `umkm_stores`, `umkm_products`, `umkm_tables`, `umkm_qr_tokens`, `umkm_orders`, `umkm_order_items`, `umkm_table_sessions`, `umkm_store_gallery_likes`.
- Super-app commerce/logistics: `super_app_orders`, `super_app_order_events`, `super_app_tracking_points`, `driver_locations_latest`, `dispatch_orders`, `trip_location_points`, food/mart merchant/catalog tables.
- Transactions/wallet: `transactions`, `transaction_disputes`, `wallet_accounts`, `wallet_topups`, `wallet_ledger_entries`, `wallet_withdrawals`, `orders`, `order_items`, `order_state_transitions`.
- Ops: `support_tickets`, `support_ticket_replies`, `crm_leads`, `crm_activities`, `sectors`, `banners`, `user_notifications`.
- Personal AI: `personal_ai_agents`, `personal_ai_threads`, `personal_ai_messages`, `personal_ai_memories`.
- Identity read model: `users_read_model`.

Evidence: `services/marketplace_service/migrations`.

## Community Database

Primary tables observed:

- Forum: `forum.lajukan_forum_categories`, `lajukan_forum_users`, `lajukan_forum_tags`, `lajukan_forum_threads`, `forum.lajukan_forum_thread_tags`, `forum.lajukan_forum_posts`, `lajukan_forum_votes`, `lajukan_forum_audit_logs`.
- Groups: `lajukan_groups`, `lajukan_group_members`.
- Reels: `reel.lajukan_reels`, `lajukan_reel_events`, `reel.lajukan_reel_comments`, `lajukan_reel_user_actions`.
- Events: `events.event_inbox`, `events.event_outbox`.

Evidence: `services/community_service/migrations`.

## Chat Database

ScyllaDB tables observed:

- `users`
- `presence`
- `rooms`
- `room_members`
- `user_rooms`
- `messages`
- `message_reads`
- `unread_counters`

Evidence: `services/chat_service/priv/scylladb/init.cql`.

## Migration Rule

Migrations are the authority for schema shape. Do not infer a field from UI text without migration/API evidence.
