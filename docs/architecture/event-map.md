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

## Canonical Marketplace Events

Use dotted event names in runtime code. The collector accepts older underscore aliases from legacy UI or specs and normalizes them before storage.

- Discovery: `home.viewed`, `search.started`, `search.submitted`, `search.result_clicked`, `search.zero_result`, `search.filter_applied`, `location.changed`.
- Supply: `listing.viewed`, `listing.saved`, `listing.shared`, `offer.create_started`, `offer.published`, `profile.supplier_viewed`.
- Demand: `need.create_started`, `need.published`, `buyer_request.viewed`, `buyer_request.applied`.
- RFQ/quote: `rfq.created`, `rfq.supplier_invited`, `quote.create_started`, `quote.submitted`, `quote.viewed`, `quote.shortlisted`, `quote.accepted`.
- Conversation: `chat.opened`, `sample.requested`.
- Trust/export: `report.submitted`, `verification.started`, `verification.completed`, `export.assessment_started`, `export.assessment_completed`.

The frontend helper `trackLajukanEvent` and marketplace collector both remove sensitive event properties such as OTPs, tokens, passwords, private message bodies, and raw identity document markers before events are persisted.

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
