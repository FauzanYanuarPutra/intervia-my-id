# Evidence Register

Status: repo audit 2026-07-11.

This file records repository evidence used for the architecture/product docs. It is not market research.

## Commands Run

- `rg --files -g AGENTS.md -g README.md -g 'docs/**' | Sort-Object`
- `Get-ChildItem -Force`
- `git status --short`
- `Get-Content README.md -TotalCount 220`
- `docker compose --env-file .env.development config --services`
- Package script reads in `frontend/www`, `frontend/cms`, `frontend/crm`, `frontend/usaha`.
- Route scans in `frontend/www/src/app`, `services/*/src/main.rs`, `services/chat_service/lib/chat_service_web/router.ex`.
- Migration scans in `services/identity_service/migrations`, `services/marketplace_service/migrations`, `services/community_service/migrations`, `services/chat_service/priv/scylladb`.
- Compose/env scans for Meilisearch, Ollama, chat, frontends, service dependencies.
- Static maintainability scan for large files by line count.
- Static scan for `unwrap()`, `panic!`, `expect()`, and console logging hot spots.
- Root env secret-like line count scan without printing values.
- CRM attachment review and CRM implementation scan across `frontend/crm`, `frontend/www/src/app/api/crm`, marketplace routes, and CRM migrations.
- Internal matching CRM product input review and CRM/matching implementation scan across `frontend/crm`, marketplace request/listing routes, event-to-lead code, support tickets, and docs.

## Key Evidence

| Claim | Evidence |
| --- | --- |
| Main public app exists | `frontend/www/package.json`, `frontend/www/src/app/[locale]` |
| Separate CMS/CRM/usaha apps exist | `frontend/cms`, `frontend/crm`, `frontend/usaha` package files |
| Identity service owns auth/profile | `services/identity_service/src/main.rs`, identity migrations |
| Marketplace service owns content/commerce/ops | `services/marketplace_service/src/main.rs`, marketplace migrations |
| Community service owns forum/groups/reels | `services/community_service/src/main.rs`, community migrations |
| Chat service owns room/message API | `services/chat_service/lib/chat_service_web/router.ex`, Scylla schema |
| Home/search/listing surfaces exist | `frontend/www/src/app/[locale]/(shared)/home`, `/search`, `/content/[id]`, `/api/content` |
| Create flow exists | `frontend/www/src/app/[locale]/(app)/create` |
| Personal AI workspace exists | `frontend/www/src/app/[locale]/(app)/profile/ai`, marketplace migration `20260710103000_personal_ai_workspace.up.sql` |
| Current CRM is internal/ops-oriented | `frontend/crm/src/components/crm/CrmCommandCenter.tsx`, `frontend/crm/src/context/AuthContext.tsx` |
| CRM backend currently supports leads/activities | `services/marketplace_service/migrations/20260224120000_crm_leads.up.sql`, marketplace `/v1/crm/*` routes |
| WWW CRM routes proxy to marketplace | `frontend/www/src/app/api/crm/leads/route.ts`, `frontend/www/src/app/api/crm/activities/route.ts` |
| Marketplace already has kebutuhan/request primitives | `content_items` with `pricing_mode = 'request'`, marketplace `/v1/lajukan/requests`, request helper functions in `services/marketplace_service/src/main.rs` |
| Current event pipeline can over-promote passive intent into CRM | `crm_lead_signal_for_event` and `upsert_crm_lead_from_event` in `services/marketplace_service/src/main.rs` |
| Internal matching CRM foundation migration exists | `services/marketplace_service/migrations/20260711020000_internal_crm_matching_foundation.up.sql` |
| Passive search/click/map CRM lead creation is disabled by default | `CRM_CREATE_LEADS_FROM_PASSIVE_EVENTS` guard in `services/marketplace_service/src/main.rs` |
| Events foundation exists | `/api/events`, marketplace `/v1/events`, `events.event_log` migration |
| Meilisearch configured | `docker-compose*.yml` Meilisearch service and marketplace `MEILI_URL` |
| Ollama local AI configured | `docker-compose*.yml` `ollama` service with profile `ai`, `up-super-fast.ps1` AI env setup |
| Transactions/wallet primitives exist | marketplace route block and wallet/transactions migrations |
| Payment/refund/escrow production readiness not proven | Code/migrations exist, but no E2E runtime proof in this audit |

## Unknowns

- Meilisearch indexer lifecycle and failure recovery.
- Chat WebSocket/presence behavior beyond tables/API routes.
- Full moderation coverage across chat, listings, reels, community.
- Exact SEO output for public listing/profile pages.
- Production payment/refund/escrow operational readiness.
- Owner CRM workspace/business scoping implementation details.
- Whether CRM should become a standalone service after V1 usage is proven.
- Exact data quality of marketplace requests/listings for matching fields such as location, stock, availability, verification, response speed, and minimum order.

## Evidence Hygiene

Do not add claims here from memory. Add file paths, commands, and dates.
