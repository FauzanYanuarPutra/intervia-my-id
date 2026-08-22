# Repository Map

Status: verified against repository HEAD on 2026-08-22.

## Root

- `docker-compose.yml` owns the shared service contract.
- `docker-compose.dev.yml`, `docker-compose.staging.yml`, and `docker-compose.prod.yml` are environment overlays.
- `up.ps1` and `up.sh` are the supported local startup helpers.
- `scripts/ci/` owns repository and runtime contract checks.
- `infrastructure/` owns edge and observability configuration, not business schema.
- `docs/` contains durable architecture, engineering, product, and operating guidance.

Local `.runtime/`, `.cache/`, `.backups/`, and generated `audit_output/` content is not source and must not be tracked.

## Frontend

- `frontend/apps/www`: public Next.js application and same-origin BFF routes.
- `frontend/apps/usaha`: business owner application.
- `frontend/apps/cms`: internal content operations application.
- `frontend/apps/crm`: internal CRM application.
- `frontend/packages`: shared frontend packages used by two or more applications.

Routing and layout stay in each app's Next.js route tree. Reusable business UI belongs in feature modules; a package is justified only by shared semantics across apps.

## Services and data ownership

- `services/identity_service`: identity, authentication, authorization, sessions, and profiles; owns `identity_db`.
- `services/marketplace_service`: discovery, content, commerce, payments, wallet, orders, and marketplace projections; owns `marketplace_db` and the Meilisearch projection.
- `services/community_service`: forum, groups, social graph, and reels; owns `community_db`.
- `services/chat_service`: chat and realtime presence; owns its Scylla keyspace.
- `services/ai_service`: internal AI orchestration gateway; it does not own product source-of-truth data.
- `services/ocr_service`: optional OCR inference runtime.
- `services/liveness_service`: optional passive presentation-attack detection runtime.

Cross-service data moves through documented APIs or RabbitMQ events plus local projections. A service must not query another service's database.

## Database assets

- `services/*/migrations`: service-owned, versioned PostgreSQL migrations.
- `services/chat_service/priv/scylladb`: versioned Scylla schema and migration scripts.
- PostgreSQL remains the transactional source of truth; Meilisearch is rebuildable.
- Runtime application code must not create or alter business tables.

## Verification

Use `rg --files`, Compose config validation, each application manifest, service entrypoints, and migration directories when refreshing this map. Folder names alone are not evidence of current behavior.
