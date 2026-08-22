# Lajukan

Lajukan is a modular monorepo for an Indonesian UMKM super-app: marketplace, services, business discovery, community, chat, business operations, and AI-assisted workflows.

This repository intentionally uses a small number of deployable services with clear ownership instead of splitting every domain into a separate microservice.

## Repository layout

```text
frontend/
  apps/          # www, usaha, cms, crm, mobile
  packages/      # shared frontend code while workspace migration is in progress
services/
  identity_service/
  marketplace_service/
  community_service/
  chat_service/
  ai_service/
  ocr_service/
  liveness_service/
infrastructure/
  caddy/
  observability/
scripts/
  ci/
  maintenance/
docs/
  architecture/
  engineering/
  operations/
  security/
```

The target architecture and repository rules live in `docs/architecture/` and `AGENTS.md`.

## Prerequisites

- Git
- Docker Desktop / Docker Engine with Docker Compose v2
- PowerShell 5.1+ on Windows or Bash on Linux/WSL
- Rust is only required for running Rust services outside Docker
- Node.js is only required for running Next.js apps outside Docker
- Elixir/Erlang is only required for running Chat outside Docker
- Python is only required for running OCR/Liveness outside Docker

## First local start

Create the local environment file:

### Windows PowerShell

```powershell
Copy-Item .env.development.example .env.development
.\up.ps1
```

### Linux / WSL

```bash
cp .env.development.example .env.development
./up.sh
```

The default development stack starts the core data layer, backend services and frontends. Optional capabilities are enabled with profiles.

Examples:

```powershell
.\up.ps1 -Profile ai
.\up.ps1 -Profile kyc
.\up.ps1 -Profile devtools
.\up.ps1 -Profile edge
.\up.ps1 -Profile ai,kyc,devtools
```

```bash
./up.sh --profile ai
./up.sh --profile kyc
./up.sh --profile devtools
./up.sh --profile edge
./up.sh --profile ai --profile kyc --profile devtools
```

To rebuild images:

```powershell
.\up.ps1 -Build
```

```bash
./up.sh --build
```

To stop the development stack without deleting volumes:

```powershell
.\up.ps1 -Down
```

```bash
./up.sh --down
```

`-Fresh` / `--fresh` recreates containers but intentionally preserves volumes. Database deletion must always be a separate explicit operation.

## Environments

| Environment | Env file | Compose files |
| --- | --- | --- |
| development | `.env.development` | `docker-compose.yml` + `docker-compose.dev.yml` |
| staging | `.env.staging` | `docker-compose.yml` + `docker-compose.staging.yml` |
| production | `.env.production` | `docker-compose.yml` + `docker-compose.prod.yml` |

Environment files containing real credentials are local/server-managed and must never be committed.

Staging and production deploy immutable application image tags such as:

```text
sha-0123456789abcdef0123456789abcdef01234567
```

`latest` is deliberately not part of the deployment contract.

## Development ports

Development ports bind to `127.0.0.1` by default. Caddy is opt-in via the `edge` profile.

Common defaults:

| Component | Port |
| --- | ---: |
| WWW | 3000 |
| CMS | 3001 |
| CRM | 3002 |
| Usaha | 3003 |
| Chat | 4000 |
| Identity | 8080 |
| Marketplace | 8081 |
| Community | 8082 |
| AI gateway | 8084 |
| OCR | 8001 |
| Liveness | 8002 |
| Meilisearch | 7700 |
| RabbitMQ UI | 15672 |
| MailHog UI | 8025 |

## Core architecture rules

1. Each service owns its own data.
2. Services do not query another service's database directly.
3. Postgres is the source of truth for transactional domains; Meilisearch is a rebuildable projection.
4. Schema changes go through versioned migrations, not runtime `CREATE TABLE` business DDL.
5. Already-applied migrations are immutable.
6. Seed/reference data is not the same thing as a database dump.
7. Request handlers stay thin; business logic belongs in service/domain modules.
8. Object-level authorization must be enforced server-side.
9. Financial writes require explicit invariants, transactions and idempotency.
10. Runtime state, generated audits, caches, database dumps and user uploads do not belong in Git.

## Quality checks

Repository quality gates live in `.github/workflows/quality.yml`.

Useful local checks:

```bash
python scripts/ci/check_repository_hygiene.py
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

Compose validation:

```bash
docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.dev.yml config --quiet
```

Production contract validation can be run with a non-secret template:

```bash
IMAGE_TAG=sha-ci DOCKERHUB_NAMESPACE=lajukan-ci \
  docker compose \
  --env-file .env.production.example \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  config --quiet
```

## Security

Never commit:

- `.env*` files containing real secrets
- database dumps
- production/user uploads
- private keys or tokens
- `.runtime/`, `.cache/`, `.backups/`
- generated screenshots or audit output

Production wallet/payment surfaces remain disabled until provider credentials, webhook verification, reconciliation, alerting and rollback procedures have passed their runbook.

## Documentation

Start here:

- `docs/README.md`
- `docs/architecture/repository-map.md`
- `docs/architecture/api-map.md`
- `docs/architecture/event-map.md`
- `docs/architecture/database-map.md`
- `docs/architecture/deployment-architecture.md`
- `docs/architecture/modernization-2026-08.md`

## License / ownership

This repository is project-specific. Add the final legal/license file only after ownership and distribution terms are explicitly decided.
