# Known Risks

Status: repo audit updated 2026-08-13.

## Product/Architecture Risks

| Risk | Likelihood | Impact | Evidence | Mitigation |
| --- | --- | --- | --- | --- |
| Taxonomy drift across home/search/create/DB/index | High | High | Multiple frontend surfaces plus metadata indexes | Maintain canonical taxonomy registry |
| Payment/escrow/refund overclaim | Medium | High | Code/migrations exist but E2E readiness not verified | Use beta/support-led wording until tested |
| Duplicate owner surfaces | Medium | Medium | `frontend/usaha` and `/usaha/*` in `www` | Decide canonical owner UX |
| Chat vs WhatsApp measurement gap | Medium | High | Separate chat and WhatsApp surfaces | Track both CTAs and outcomes |
| Meilisearch/Postgres sync uncertainty | Medium | High | Meili configured; sync worker not fully audited | Document index lifecycle and fallback |
| AI hallucination in create/search | Medium | High | AI routes and local models exist | Use allowlists, confidence thresholds, DB-backed candidates |
| Moderation gaps | Medium | High | Reports/moderation exist in some domains | Domain moderation matrix |
| Public SEO/client loading risk | Medium | Medium | Dynamic profile/listing surfaces | Inspect SSR output for canonical pages |
| Secrets leakage | High | High | `.env.development` contains sensitive-looking values | Rotate exposed secrets; do not log/copy env values |

## Technical Risks Needing Follow-Up

- Chat block/report/rate-limit contracts now exist in source, but migration
  rollout, moderation ownership, and end-to-end production behavior remain
  unverified.
- Chat message rows are idempotent across WebSocket/HTTP retries, but inbox,
  unread, and realtime projection repair is not yet backed by a durable outbox.
- Chat history is partitioned by monthly `(room_id, bucket)` without a canonical
  per-room bucket manifest. The latest bucket resolves correctly, but safe
  cross-month cursor pagination needs an additive projection/backfill and BFF/UI
  cursor propagation; scanning arbitrary prior months is prohibited.
- Browser caches for Chat and Profile AI improve first paint but retain bounded
  plaintext conversation data on the device. Logout/account-switch purge,
  TTL/pruning, quota failure, and future edit/delete tombstone invalidation need
  recurring privacy regression tests.
- Voice-note uploads enforce type/signature/size and a five-minute client
  limit; hard server-side duration enforcement still needs a trusted audio
  metadata parser or provider-duration quota.
- Notification stream reliability not tested.
- Wallet ledger invariants not audited.
- Media upload size/type/security policy may vary by route.
- Local AI can overload laptops if warmup/model settings are too aggressive.
- Authenticated create, contact, report, and CRM lead paths still need seeded end-to-end QA. Current stabilization smoke uses mocked API data for route coverage.
- Repo-wide frontend lint is not clean yet, so CI should distinguish changed-file cleanliness from legacy lint debt until the backlog is resolved.
