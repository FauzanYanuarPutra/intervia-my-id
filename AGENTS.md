# Lajukan Agent Guide

Status: repo audit 2026-07-11. This guide is binding for agents working in this repository.

## Product Purpose

Lajukan is a platform for Indonesian business needs: discovery, search, local business profiles, listings, maps, chat/WhatsApp contact, community, reels, support, CRM/CMS operations, and transactional primitives. Treat this as a verified implementation map, not a market-research thesis.

## Repository Map

- `frontend/www`: main public Next.js app, API/BFF routes, home, search, create, profile, chat, community, reels, transactions, wallet, UMKM, support, AI surfaces.
- `frontend/usaha`: owner/business workspace app.
- `frontend/cms`: CMS app for managed content such as sectors/banners.
- `frontend/crm`: CRM/ops command center.
- `frontend/shared`: shared frontend package.
- `services/identity_service`: Rust auth, sessions, roles, user profile, phone/Google login, public/discovery user APIs.
- `services/marketplace_service`: Rust listing/content, events, learning/rewards, requests, UMKM stores/products/orders, transactions, wallet, notifications, support, CRM, CMS, trust profiles.
- `services/community_service`: Rust forum, groups, reels, comments, actions, community search/feed.
- `services/chat_service`: Elixir/Phoenix chat API backed by ScyllaDB rooms/messages/unread tables.
- `services/ai_service`: Rust KYC/verification helper service; local Ollama AI for product features currently lives mainly in `frontend/www` API routes and Docker config.
- `docker-compose*.yml`, `up-super-fast.ps1`: local/runtime orchestration.

## Required Docs

Read these before changing product direction: `docs/README.md`, `docs/product/product-principles.md`, `docs/product/current-capabilities.md`, `docs/product/decision-log.md`, `docs/research/evidence-register.md`, `docs/engineering/lessons-learned.md`.

## Verified Commands

- `docker compose --env-file .env.development config --services`
- `.\up-super-fast.ps1`
- Frontend scripts by package file: `npm run dev`, `npm run build`, `npm run lint`, `npm run test` in `frontend/www`; `npm run dev`, `npm run build`, `npm run lint` in `frontend/cms`, `frontend/crm`, and `frontend/usaha`.

Do not paste secrets from `.env*` into docs, logs, issues, or chat.

## Audit Before Coding

For every new request:

1. Identify the real product goal.
2. Search existing routes, components, migrations, and docs.
3. Read the nearest `AGENTS.md` if one is added later.
4. Classify the request: valid, valid with adjustment, hypothesis, conflict, risky, or not verifiable.
5. Prefer extending the canonical surface over adding a duplicate.
6. Record durable decisions in `docs/product/decision-log.md` after approval.

## Anti-Duplication Rules

- Do not create a second search, listing detail, owner dashboard, chat, community, reels, or UMKM profile flow without proving the existing one cannot serve the need.
- Canonical public routes are documented in `docs/lajukan-hidden-routes-audit.md`.
- Communities and reels are engagement/distribution layers, not transaction categories equivalent to Mesin & Alat or Bahan Usaha.

## Database And Migration Rules

- Never edit an applied migration. Add a new timestamped migration.
- Keep service ownership clear: identity data in `identity_service`, marketplace/commerce data in `marketplace_service`, forum/reels/group data in `community_service`, chat history in `chat_service` ScyllaDB.
- Add indexes for new query paths before shipping UI that depends on them.
- Use event outbox/inbox patterns where cross-service synchronization is needed.

## API Compatibility Rules

- Next.js API routes in `frontend/www/src/app/api` are BFF/proxy surfaces. Preserve response shape unless a migration plan is documented.
- Backend routes under `/v1/*` are service contracts. Version or adapt carefully.
- Do not expose internal service URLs, tokens, model endpoints, or raw provider errors to users.

## Search And Indexing Rules

- Search is multi-source: marketplace DB/Meilisearch, Postgres GIN/trigram indexes, community/forum search, and UI ranking.
- Keep home, search, create taxonomy, DB metadata, and index fields aligned.
- If using AI, AI may rank/summarize candidates but must not invent suppliers, prices, locations, or verification status.

## CRM And Lajukan Match Rules

- Current CRM priority is internal Lajukan operations: `Pencari -> Kebutuhan -> Penyedia sesuai -> Terhubung -> Berhasil/Gagal`.
- Do not build a seller-owned sales CRM as the default next step. Owner/seller CRM is a later product mode after internal matching, verification, and connection tracking are stable.
- Reuse existing request/listing data where possible. `content_items` with request pricing/mode can represent kebutuhan; supply listings and UMKM stores can be candidate penyedia.
- Passive search, listing view, map view, or result click events belong to analytics by default. They must not create CRM leads/connections unless an explicit high-intent follow-up action exists.
- `Lajukan Match` must be admin-reviewed first: AI can extract, score, explain, and rank candidates, but it must not auto-connect users or invent suppliers.
- Store original user text/image context, structured extraction, model/prompt/scoring versions, confidence, admin corrections, candidate reasons, and final outcomes. Never overwrite the original input with AI output.
- Matching should start with Postgres/Meilisearch retrieval and versioned scoring. Add Qdrant/vector infrastructure only when keyword/hybrid retrieval is proven insufficient.
- Every matching/connection action needs audit metadata and idempotency when triggered by events.

## Chat And WhatsApp Rules

- Treat internal chat and WhatsApp as separate communication channels.
- Internal chat keeps platform history and privacy; WhatsApp supports fast local behavior.
- Do not remove either channel without product decision evidence.
- Do not display seller phone/WhatsApp unless consent/source field exists.
- Track contact clicks where possible and avoid leaking private phone data in logs.

## Community And Reels Rules

- Community/forum/reels support discovery, trust, education, and distribution.
- Keep moderation/reporting requirements explicit; do not rely only on UI copy.
- Reels should connect to stores/listings/profiles when metadata exists.

## Profile And Location Rules

- Public profile, UMKM store profile, and owner workspace are different surfaces.
- Location fields may be city/address/lat/lng; only show distance when both viewer and listing/store coordinates are available.
- Do not imply exact location if only city or text address exists.

## Analytics Rules

- Important user actions should emit events through `/api/events` or backend `/v1/events` where appropriate.
- Record search, zero results, listing views, contact clicks, create funnel, chat start, transaction state, report, and profile/store interactions.
- Analytics must not store secrets, raw tokens, or unnecessary personal data.

## Security Rules

- Assume `.env.development` may contain real secrets. Do not quote them.
- Bind local AI/Ollama to localhost only.
- Validate uploads by size/type and store through controlled media APIs.
- Keep auth checks server-side for protected data.
- Mask phone numbers and tokens in logs.
- Use least-privilege service boundaries; AI should not have direct uncontrolled production DB access.

## Conflicting Requests

When a user request conflicts with current architecture or docs, state the conflict, cite repo evidence, propose a safer path, and avoid changing product direction without approval.

## Definition Of Done

- Existing implementation audited first.
- Correct service boundary used.
- New behavior has tests or a documented test gap.
- Migrations are additive and indexed.
- API contract impact considered.
- Search/index/event impact considered.
- Security/privacy impact considered.
- Docs updated when product meaning changes.
