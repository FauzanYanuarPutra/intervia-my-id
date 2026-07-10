# Testing Strategy

Status: repo audit 2026-07-11.

## Existing Script Evidence

`frontend/www/package.json` includes:

- `dev`
- `build`
- `start`
- `lint`
- `test`
- `test:unit`
- `test:flow`
- `test:ux`
- `test:e2e`

`frontend/cms`, `frontend/crm`, and `frontend/usaha` include dev/build/start/lint scripts.

Backend test commands were not fully inventoried in this audit; check each service's `Cargo.toml` or `mix.exs` before assuming.

## Required Test Coverage By Change Type

- UI-only copy/layout: lint and targeted page smoke check.
- API/BFF route: unit/integration test for auth, error shape, and upstream failure.
- Search/ranking: query fixtures for typo, category, city/location, empty state.
- Create flow: required field validation, upload failure, AI fallback if touched.
- Chat: room creation, message send/list, read state, inbox.
- Community/reels: permissions, moderation, media validation.
- Transactions/wallet: state machine, idempotency, ledger invariants, provider callback.
- Migrations: apply on clean DB, backward-compatible reads, indexes for new filters.

## Minimum Manual Verification

- Mobile width and desktop width for changed frontend surfaces.
- Authenticated and unauthenticated states.
- Error/empty/loading states.
- Indonesian copy for user-facing primary flows.

## Test Gap Rule

If tests cannot be run, document why and list residual risk in the final response and, if durable, `known-risks.md`.
