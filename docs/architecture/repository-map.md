# Repository Map

Status: repo audit 2026-07-11.

## Root

- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `docker-compose.staging.yml`: service orchestration.
- `up-super-fast.ps1`, `up-super-fast.sh`: local startup helpers.
- `README.md`: local workflow and product summary.
- `docs/`: architecture, product, research, and engineering docs.
- `ai/`, `ai_data/`, `.runtime/`: local AI/runtime data areas. Do not treat runtime data as source code.

## Frontend

- `frontend/www`: main Next.js app and BFF API routes.
- `frontend/usaha`: business owner portal.
- `frontend/cms`: CMS/admin content management.
- `frontend/crm`: CRM/ops surfaces.
- `frontend/mobile`: mobile wrapper/project.
- `frontend/shared`: shared frontend package.

## Services

- `services/identity_service`: auth, sessions, roles, user profiles.
- `services/marketplace_service`: marketplace/content/commerce operations.
- `services/community_service`: community, forum, groups, reels.
- `services/chat_service`: chat API and ScyllaDB schema.
- `services/ai_service`: verification AI helper service.

## Database Assets

- `services/*/migrations`: service-owned SQL migrations.
- `services/chat_service/priv/scylladb`: ScyllaDB chat schema and setup.
- Root SQL dumps such as `marketplace.sql`, `identity.sql`, `community.sql`: reference/dump files, not migration policy.

## Evidence

Observed by `Get-ChildItem`, `rg --files`, package scripts, compose service config, and route/migration scans.
