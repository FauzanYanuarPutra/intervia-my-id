# Event Map

Status: repo audit 2026-07-11.

## Event Collection

- Frontend/BFF route: `frontend/www/src/app/api/events/route.ts`.
- Marketplace route: `POST /v1/events` handled by `collect_events`.
- Marketplace migration: `events.event_log` in `20260527150000_ai_operating_system_foundation.up.sql`.

## Outbox/Inbox

- Identity: `events.event_outbox`.
- Marketplace: `events.event_outbox`, `events.event_inbox`, plus `outbox_events` in orders engine.
- Community: `events.event_outbox`, `events.event_inbox`.

This indicates the repository has a cross-service event architecture foundation. The exact workers/dispatch guarantees need targeted runtime verification before relying on eventual consistency.

## AI/Recommendation Event Tables

Marketplace AI OS foundation includes:

- `events.ai_decision_log`
- `recommendation_impressions`
- `recommendation_feedback`
- `user_feature_snapshots`
- `entity_feature_snapshots`
- `fraud_signals`
- `fraud_cases`
- `experiment_assignments`

## Events To Preserve

Any new product flow should consider:

- `home_viewed`, `category_clicked`
- `search_started`, `search_submitted`, `search_zero_result`
- `listing_impression`, `listing_clicked`, `listing_viewed`, `listing_saved`
- `whatsapp_clicked`, `chat_started`
- `create_started`, `create_step_completed`, `create_abandoned`, `create_completed`
- `community_opened`, `reel_viewed`
- `transaction_state_changed`
- `listing_reported`, `support_ticket_created`

## CRM-Relevant Events

CRM should create or update records from high-intent events only:

- `listing.inquiry_created`
- `requirement.created`
- `requirement.response_created`
- `conversation.started`
- `message.received`
- `whatsapp.clicked`
- `quote.sent`
- `quote.accepted`
- `order.created`
- `payment.succeeded`
- `payment.failed`

Passive impressions and generic listing views should remain analytics events unless the user explicitly asks for follow-up.

## Risk

If UI features are built without event instrumentation, Lajukan loses the ability to learn what users actually need. Do not use AI recommendations as a substitute for event data.
