# Known Risks

Status: repo audit 2026-07-11.

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

- Chat block/report/rate limit not verified.
- Notification stream reliability not tested.
- Wallet ledger invariants not audited.
- Media upload size/type/security policy may vary by route.
- Local AI can overload laptops if warmup/model settings are too aggressive.
- Authenticated create, contact, report, and CRM lead paths still need seeded end-to-end QA. Current stabilization smoke uses mocked API data for route coverage.
- Repo-wide frontend lint is not clean yet, so CI should distinguish changed-file cleanliness from legacy lint debt until the backlog is resolved.
