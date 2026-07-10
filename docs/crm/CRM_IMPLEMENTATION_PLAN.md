# CRM Implementation Plan

Status: phased implementation plan 2026-07-11.

## Goal

Build internal Lajukan Match CRM incrementally without breaking existing CRM, search, listing, chat, support, or create flows.

## Current System Summary

| Area | Current State |
| --- | --- |
| Backend CRM | Marketplace service owns `/v1/crm/leads`, `/v1/crm/activities` |
| CRM DB | `crm_leads`, `crm_activities` only |
| CRM frontend | `frontend/crm` command center with dashboard, pipeline, users, listings, transactions, chat, analytics, disputes, settings |
| Requests | `/v1/lajukan/requests` reads `content_items` request data |
| Listing source | marketplace `content_items`, UMKM stores/products, trust profiles |
| Event risk | passive search/click/map can be promoted into CRM lead by event side-effect |
| AI infra | local Ollama exists; local vision has been heavy/slow; matching should not depend on heavy image AI |

## Phase 0 - Documentation And Guardrails

Status: complete for the first repo-grounded pass.

Tasks:

- Add CRM/matching docs under `docs/crm`.
- Update `AGENTS.md`.
- Update docs index and decision log.
- Mark old owner CRM strategy as future mode.

Acceptance:

- Agent guide says internal matching CRM is next priority.
- Product decision log records the clarified direction.
- New docs define product, AI matching, data model, and implementation plan.
- Marketplace service compiles after the passive CRM event guard.

## Phase 1 - Internal CRM Read Model

Purpose: make the current CRM app reflect the real operational model before adding AI.

Backend:

- Add read endpoints or BFF aggregations for:
  - requirements from `content_items` requests;
  - active supply listings/providers;
  - support/report queues;
  - basic demand/supply analytics.
- Add feature flag or code change so passive search/result/map events do not create `crm_leads` by default.
- Keep old `/v1/crm/leads` response shape for compatibility.

Frontend:

- Update `frontend/crm` navigation:
  - Ringkasan;
  - Marketplace;
  - Kebutuhan;
  - Listing;
  - AI Matching;
  - Hubungan;
  - Pengguna;
  - Layanan;
  - Analitik;
  - Pengaturan.
- Reword `CRM Pipeline` to operational marketplace queues.
- Keep existing listing moderation and support ticket UI as reusable sections.

Tests:

- Marketplace route tests for requirements endpoint.
- Frontend smoke/lint for `frontend/crm`.
- Regression check that existing `/api/crm/leads` still works.

## Phase 2 - Matching Data Foundation

Purpose: store extraction, matching run, candidate score, connection, feedback, and audit.

Backend migrations:

- `crm_requirement_reviews`;
- `crm_requirement_extractions`;
- `crm_matching_weight_versions`;
- `crm_matching_runs`;
- `crm_matching_candidates`;
- `crm_connections`;
- `crm_matching_feedback`;
- `crm_audit_logs`.

Backend services/functions:

- Create/get/update requirement review.
- Run extraction with fallback rule parser.
- Retrieve candidates from Postgres/Meilisearch.
- Score candidates with versioned weights.
- Store candidate explanations.
- Review candidate.
- Create connection.
- Record feedback/outcome.

Security:

- Restrict routes to `admin`, `ops`, `support`, `sales`, `super_admin` as appropriate.
- Add audit log on admin changes.
- Validate JSON extraction schema before DB insert.
- Do not expose internal provider errors to public client.

Tests:

- Migration apply/rollback if rollback files exist.
- Unit tests for scoring formula.
- Integration tests for idempotency keys.
- API contract tests for permissions.

## Phase 3 - Lajukan Match UI MVP

Purpose: give admin a usable review screen.

UI features:

- Requirement detail panel with original text and current extraction.
- Confidence/missing field indicators.
- Candidate table/cards with score, rank, category, location, verification, data completeness.
- Score breakdown drawer.
- Admin actions:
  - approve;
  - reject with reason;
  - ask for more info;
  - create connection.
- Connection outcome form.

Acceptance:

- Admin can process one real kebutuhan from new to connection without SQL/manual DB edits.
- AI low confidence never silently fills final data.
- Admin correction becomes feedback signal.

## Phase 4 - Analytics And Learning Loop

Purpose: turn operational data into product intelligence.

Dashboards:

- top kebutuhan by category;
- zero-match needs;
- city demand/supply gap;
- candidate approval rate;
- connection contact rate;
- provider response rate;
- success/failure reason;
- listing fields most often missing.

Learning loop:

- Update synonyms/category mapping.
- Adjust scoring weights with version history.
- Improve extraction prompts.
- Track before/after approval rate when scoring changes.

No automatic fine-tuning in MVP. "Belajar" means measurable product iteration from feedback and outcomes.

## Phase 5 - Optional Service Split

Only consider `crm_service` when:

- matching tables and routes grow too large for marketplace service;
- event coupling is stable;
- CRM has real daily ops usage;
- migration/backfill/replay plan exists;
- parity tests cover old and new APIs.

Until then, keep implementation close to marketplace data to avoid unnecessary distributed-system complexity.

## Files/Services Likely To Change

| Path | Expected Work |
| --- | --- |
| `services/marketplace_service/migrations/*` | Add matching CRM tables |
| `services/marketplace_service/src/main.rs` | Add internal matching routes/services; gate passive CRM lead creation |
| `frontend/crm/src/components/crm/CrmCommandCenter.tsx` | Rename/restructure nav and pages |
| `frontend/crm/src/lib/api.ts` | Add matching/requirement/connection API clients |
| `frontend/www/src/app/api/crm/*` | Add BFF routes if CRM app needs WWW proxy patterns |
| `docs/crm/*` | Keep architecture and plan updated |

## Risks

| Risk | Mitigation |
| --- | --- |
| CRM becomes seller pipeline again | Keep AGENTS and decision log clear; review nav/data model before coding |
| AI invents providers | Only use DB/index candidates; schema validation; no free-form supplier output |
| Passive analytics pollute CRM | Gate `crm_lead_signal_for_event`; separate analytics from CRM |
| Local AI too slow | Deterministic fallback and admin review; do not depend on heavy vision model |
| Data quality too low for matching | Surface missing fields and ask admin/user for more info |
| Admin privacy risk | RBAC, audit logs, masked logs, least privilege |
| Duplicate connections | Idempotency key and unique indexes |

## First Implementation Slice

Recommended next coding slice:

1. Add migrations for requirement reviews, matching runs, candidates, connections, feedback, and audit.
2. Add read-only endpoint for CRM requirements backed by `content_items` request data.
3. Add feature flag to disable passive event-to-CRM-lead creation.
4. Update CRM nav labels to the internal matching model.
5. Add placeholder AI Matching page fed by real requirements/listings, not demo data.

Progress 2026-07-11:

- Added `20260711020000_internal_crm_matching_foundation` migration for requirement reviews, extractions, matching runs, candidates, connections, feedback, scoring weights, and audit logs.
- Added `CRM_CREATE_LEADS_FROM_PASSIVE_EVENTS=false` default behavior in marketplace service by gating passive search/click/map CRM lead creation.
- Verified `cargo check --manifest-path services\marketplace_service\Cargo.toml`.

## Commands To Verify

Run only relevant commands for touched areas:

```powershell
npm run lint --prefix frontend/crm
npm run build --prefix frontend/crm
cargo test -p marketplace_service
docker compose --env-file .env.development config --services
```

If a command cannot run locally, document the reason in the final answer.
