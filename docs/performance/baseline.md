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

## 2026-08-01 UMKM Map Query Hardening

- Added database-side viewport bounding-box filters to the canonical UMKM store query instead of loading a broad candidate set and filtering every store in Node/browser memory.
- Added partial coordinate/recency indexes for active stores and trigram indexes for name, city, and normalized search text. The startup migration is transactional for SQLx compatibility; large production datasets require a separately operated concurrent-index rollout to avoid long write locks.
- Added strict public query limits and coordinate validation at the BFF boundary.
- Added map movement reporting so interactive discovery consumes the bounded query path.
- Reduced the UMKM server-render seed from 120 records to 10, removed the 25-second full refresh loop, and changed the list to real 10-row network batches with cancellation of stale viewport requests.
- Added a partial PostgreSQL point GiST index for nearest-neighbour ordering of active storefronts inside the current viewport.
- Public-reference enrichment is deferred into a separately cancellable request with a 1.5-second upstream deadline, so it no longer delays the first registered-store batch.
- Replaced the generic paged `/v1/content` reference scan with `/v1/map/references`: a 10-row default/50-row maximum projection with database viewport filtering, visible-map-center fallback ranking, `LIMIT + 1` pagination detection, safe coordinate parsing, and partial GiST/trigram indexes.
- Dev-only verification after removing secondary sorting from the KNN branch: the measured bbox query changed from a 4,355-row scan/sort (`556.8 ms`, 30,154 shared-buffer hits) to a limit-stopping GiST KNN scan (`1.811 ms`, 110 shared-buffer hits). Across 25 warm direct-endpoint requests, observed p50/p95 was `16.52/18.74 ms` for the Jakarta viewer case and `26.30/38.15 ms` for the wider Indonesia bbox. These are local diagnostics, not production SLOs.
- No billion-row throughput claim is made: production `EXPLAIN (ANALYZE, BUFFERS)`, p95/p99 latency, cache-hit ratio, index size, write amplification, and load tests remain required before choosing partitioning, read replicas, spatial tiles, or sharding.
