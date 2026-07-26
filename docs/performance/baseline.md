# Performance Baseline

Status: baseline awal statis 2026-07-11. Tidak ada production metrics atau browser lab run yang dipakai pada audit ini.

## Scope

Baseline ini memakai pemeriksaan aman:

- package scripts;
- compose service list;
- source file line counts;
- static scan untuk logging dan panic-prone code;
- existing docs and migrations.

Tidak ada angka LCP, INP, CLS, p95 latency, throughput, CPU, atau memory yang dikarang.

## Local/Runtime Baseline

Verified command:

```powershell
docker compose --env-file .env.development config --services
```

Service yang muncul: PostgreSQL databases, Redis, RabbitMQ, Meilisearch, identity, marketplace, community, chat, ScyllaDB, Ollama, MinIO, MailHog, pgAdmin, db UI, Caddy, `www`, `usaha`, `cms`, `crm`.

Primary local command:

```powershell
.\up-super-fast.ps1
```

## Build/Test Scripts Available

- `frontend/www`: `build`, `lint`, `test`, `test:unit`, `test:flow`, `test:ux`, `test:e2e`.
- `frontend/usaha`: `build`, `lint`, `typecheck`.
- `frontend/cms`: `build`, `lint`.
- `frontend/crm`: `build`, `lint`.
- Rust services: check `Cargo.toml` per service before assuming exact test command.
- Chat service: Elixir/Mix project with Phoenix dependencies.

## Large File Baseline

Top large source files from static line count:

| Lines | File |
| ---: | --- |
| 19441 | `services/marketplace_service/src/main.rs` |
| 14297 | `frontend/www/src/components/super-app/UmkmHubClient.tsx` |
| 8881 | `frontend/www/src/app/[locale]/(app)/create/CreatePostingClient.tsx` |
| 8396 | `frontend/www/src/app/[locale]/(app)/chat/[id]/page.tsx` |
| 7159 | `frontend/www/src/app/[locale]/(shared)/reels/ReelsClient.tsx` |
| 6747 | `services/community_service/src/main.rs` |
| 6302 | `frontend/www/src/app/[locale]/(shared)/content/[id]/page.tsx` |
| 5558 | `frontend/www/src/components/super-app/UmkmStorefrontClient.tsx` |
| 4862 | `frontend/www/src/app/[locale]/(app)/transactions/page.tsx` |
| 4652 | `frontend/www/src/components/community/CommunityFeedClient.tsx` |
| 4081 | `frontend/www/src/app/[locale]/(shared)/search/SearchPageClient.tsx` |

Large files are not automatically wrong, but these are the first candidates for characterization tests and responsibility-based extraction.

## Frontend Performance Risks

- Very large client components can increase hydration cost and make route-level review difficult.
- Chat, reels, UMKM, search, and create pages are likely performance-sensitive because they combine media, realtime, maps, or complex forms.
- Console logging in production paths can add noise and risk sensitive output if not gated.
- AI image routes and local Ollama can be slow; keep timeouts, fallback, and disabled modes.

## Backend Performance Risks

- `marketplace_service/src/main.rs` and `community_service/src/main.rs` concentrate many route handlers and queries in one file; this increases review risk and makes query performance ownership harder.
- Search depends on Postgres indexes and Meilisearch; stale index behavior was not measured.
- Wallet/transaction/order flows need state-machine and idempotency tests before optimization.

## Measurement Gaps

- No p50/p95/p99 latency baseline.
- No Lighthouse/Web Vitals baseline.
- No bundle analyzer output.
- No DB `EXPLAIN` plans.
- No Meilisearch indexing lag metric.
- No WebSocket reconnect metric.
- No container CPU/memory profile.

## 2026-07-11 Stabilization Smoke

Verified command:

```powershell
npx playwright test tests/e2e/lajukan-stabilization.spec.ts --project=chromium
```

Coverage: render and horizontal-overflow smoke for home, Explore results, UMKM discovery, create, community, reels, login, register, support, and content detail across `360x800`, `390x844`, `768x1024`, `1024x768`, `1366x768`, and `1440x900`.

This is not a Web Vitals baseline. It only verifies layout stability and control visibility for critical public routes.

## Next Measurements

1. Run `npm run build` for `frontend/www` and capture route/build warnings.
2. Run targeted Playwright smoke for `/home`, `/explore`, `/umkm`, `/content/[id]`, `/chat`, `/reels`.
3. Add bundle analyzer only if needed and documented.
4. Capture safe DB `EXPLAIN` for hottest search/listing queries in a dev database.
5. Measure Ollama response times separately from product request time.
