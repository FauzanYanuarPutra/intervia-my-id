# Service Catalog

Status: active architecture catalog; migration audit 2026-09-20.

| Service/App | Runtime | Responsibility | Primary Data | Notes |
| --- | --- | --- | --- | --- |
| `frontend/www` | Next.js | Public app, user workspace, BFF API routes, AI UI/API surfaces | Calls service APIs; runtime files for local AI memory | Main product surface |
| `frontend/usaha` | Next.js | Business owner/UMKM workspace | Marketplace/identity APIs | Separate app plus `/usaha/*` routes also exist in `www` |
| `frontend/cms` | Next.js | CMS operations | Marketplace CMS APIs | Sectors/banners present in marketplace |
| `frontend/crm` | Next.js | Current CRM/ops/support/trust workflows; target owner CRM is documented separately | Marketplace/identity/chat APIs | See `architecture/crm-architecture.md` and `product/crm-strategy.md` |
| `identity_service` | Rust/Axum | Auth, sessions, roles, profiles, user discovery/public profiles | PostgreSQL `identity_db` schemas `core`, `identity`, `events`, etc. | Routes under `/auth`, `/users/*` |
| `marketplace_service` | Rust/Axum | Marketplace/discovery/catalog, UMKM commerce, internal platform workflows, categories/filters, learning/rewards and residual legacy routes during strangler migration | PostgreSQL `marketplace_db` | Legacy compatibility owner only for domains not yet contracted; must not receive new unrelated source-of-truth tables |
| `community_service` | Rust/Axum | Community feed/search, groups, forum, reels, comments/actions | PostgreSQL `community_db` schemas `forum`, `reel`, `events` | Routes under `/v1/community`, `/v1/forum`, `/v1/reels` |
| `chat_service` | Elixir/Phoenix | DM/group/support rooms, messages, read state, inbox | ScyllaDB keyspace/tables | Routes under `/api/v1/*` |
| `ai_service` | Rust/Axum | Verification pipeline wrapper | External OCR/liveness/VLLM URLs | Compose service is commented in base files; local product AI mainly uses `www` API routes and Ollama |
| `meilisearch` | Docker | Search engine | `meili_data` volume | Marketplace service gets `MEILI_URL` |
| `ollama` | Docker profile `ai` | Local LLM/vision runtime | `ollama_data` volume | Bound to localhost in compose |

## Service Boundary Rule

Do not move data ownership across services just because a frontend route is convenient. Add BFF adapters in `frontend/www/src/app/api` only when the backend contract remains clear.


## 2026 Domain Extraction Direction

The catalog above describes the currently deployed service boundaries. The active 2026 target is documented in `domain-service-boundaries-2026-09.md` and is deliberately incremental.

Marketplace is the current owner of several legacy domains that are being extracted. New work must not add another unrelated source-of-truth to Marketplace merely because its public UI happens to live in the marketplace surface.

Target source-of-truth services include `news_service`, `order_service`, `payment_service`, `profile_service`, `media_service`, `promotion_service`, `crm_service`, `communication_service`, `trust_service`, `support_service`, and `review_service`. Search remains a rebuildable projection, not a transactional owner.

Target services are staged behind explicit runtime modes. A target is not considered fully cut over until its schema exists, backfill/reconciliation passes, write/read ownership is switched, rollback is observed, and legacy access is removed.