# System Architecture

Status: repo audit 2026-07-11.

## Runtime Shape

Lajukan is a multi-frontend, multi-service app:

```text
Browser
  -> frontend/www Next.js app and API/BFF routes
  -> identity_service for auth/profile
  -> marketplace_service for listing/content/commerce/ops
  -> community_service for forum/groups/reels
  -> chat_service for room/message APIs
  -> PostgreSQL service databases, ScyllaDB chat store, Redis, RabbitMQ, Meilisearch
  -> optional local Ollama for AI routes
```

`frontend/usaha`, `frontend/cms`, and `frontend/crm` are separate frontend apps that talk to the same service layer.

## Core Product Flow Evidence

- Search/listing: `frontend/www/src/app/[locale]/(shared)/search`, `/api/content`, marketplace `/v1/content`.
- Create: `frontend/www/src/app/[locale]/(app)/create`, `/api/content/create`.
- UMKM map/store: `frontend/www/src/app/[locale]/(shared)/umkm`, `/api/super-app/umkm/stores`, marketplace `/v1/umkm/stores`.
- Community/reels: `frontend/www/src/app/[locale]/(shared)/community`, `/reels`, community `/v1/forum/*`, `/v1/reels/*`.
- Chat: `frontend/www/src/app/[locale]/(app)/chat`, `/api/chat/*`, chat service `/api/v1/*`.
- Transactions/wallet: `frontend/www/src/app/[locale]/(app)/transactions`, `/payments`, marketplace `/v1/transactions`, `/v1/wallet/*`.

## Known Boundaries

- Source of identity truth is `identity_service`.
- Source of marketplace/catalog/order/wallet truth is `marketplace_service`.
- Source of forum/reels/group truth is `community_service`.
- Source of chat history truth is `chat_service`/ScyllaDB.
- `frontend/www/src/app/api` often acts as a BFF layer; do not assume data is stored there.

## Needs Verification

- End-to-end production readiness of payments/escrow/refunds.
- Full WebSocket/presence behavior for chat beyond API and Scylla schema.
- Exact Meilisearch indexing jobs and sync guarantees.
- Whether public pages are fully server-rendered for SEO/profile detail surfaces.
