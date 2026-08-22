# System Architecture

Status: verified against repository HEAD on 2026-08-22.

## Runtime shape

```text
Browser / mobile client
          |
          v
      Caddy edge
          |
          v
Next.js app + same-origin BFF
   |       |        |        |         |
   v       v        v        v         v
Identity Marketplace Community Chat  AI orchestrator
   |       |        |        |         |
Postgres Postgres  Postgres  Scylla    +-- OpenAI-compatible model provider
           |                           +-- optional RAG adapter
           +-- Meilisearch projection  +-- optional OCR/liveness/face match

All services may use Redis and RabbitMQ only for their documented cache,
coordination, outbox/inbox, and event-consumer responsibilities.
```

The BFF authenticates the browser, limits and sanitizes requests, and maps public contracts to internal service contracts. It must not select AI vendors or query service databases. `ai_service` is the only model-provider gateway.

## Ownership rules

- Identity owns identity truth.
- Marketplace owns listings, orders, payment, wallet, and transaction truth.
- Community owns community truth.
- Chat owns chat history.
- AI output is advisory until a domain service or authorized user validates and persists it.
- Search indexes and read models are projections and must be replayable/rebuildable.

## Reliability patterns

- Database mutation plus event publication uses transactional outbox semantics.
- Consumers use inbox/event IDs and idempotent side effects.
- Financial operations use explicit database transactions, provider idempotency keys, unique provider IDs, and validated state transitions.
- Production and staging fail fast on missing secrets and provider configuration.
- `/health` means the process is alive; `/ready` means required dependencies are usable.

## Security boundaries

- Authentication does not replace object-level authorization.
- Every route receiving an object ID must authorize that actor against that object before reading or mutating it.
- Internal service tokens are server-only and never use `NEXT_PUBLIC_*`.
- Raw identity documents, NIK, credentials, cookies, authorization headers, OTPs, and model input containing sensitive documents must not be logged.
- KYC remains fail-closed when a real reviewed model or dependency is unavailable.

## Current modularity debt

The architecture boundary is sound, but several files are too large: Marketplace and Community service entrypoints plus several WWW client components. Refactor one domain at a time into route, service, repository, and domain modules, preserving route and payload contracts after each extraction.
