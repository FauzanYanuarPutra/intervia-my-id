# Deployment Architecture

Status: verified against repository HEAD on 2026-09-18.

## Release contract

Images are built once and addressed by immutable `sha-<40-character-commit>` tags. Staging and production must deploy the same candidate SHA; production must not rebuild a different artifact.

A successful `Build Images` run for a push to `main` automatically deploys that immutable SHA to **staging**, never directly to production. Promotion to production is a separate manual `workflow_dispatch` using the exact same `sha-<40-character-commit>` tag.
Production promotion additionally rejects any release SHA that is not reachable from the repository's `main` history.
Before production SSH/deploy begins, the workflow also requires successful Build Images, Quality Gates, Security, Reliability Contract, Frontend Runtime Gate, KYC Runtime Contract, and News Contract runs for that exact SHA. It also requires an explicit successful `staging-verified` deployment record for that exact SHA. That record is created only after the origin and public-edge staging smoke checks finish, so production cannot bypass staging verification or rely on ambiguous workflow metadata.

Production deployment remains manual through a protected GitHub environment. The remote deployment performs:

1. immutable tag and Compose contract validation;
2. image pull;
3. `docker compose up --wait` with bounded timeout;
4. HTTPS probes for WWW, Marketplace readiness, and Chat readiness through Caddy;
5. persistence of the last successful immutable tag.

If the health gate fails after replacement begins, the workflow redeploys the last validated tag. Database changes must therefore follow expand/backfill/switch/verify/contract and remain backward-compatible with the previous application release during the rollback window.

## Runtime profiles

- Core: data services, Identity, Marketplace, Community, Chat, AI orchestrator, and WWW.
- `local-ai`: local Ollama only. The orchestrator may instead use an external OpenAI-compatible provider.
- `kyc`: OCR and liveness inference services. These are not production-ready merely because containers start.
- `backoffice`: CMS, CRM, and Usaha in the development overlay.
- `edge`: local Caddy in development.
- `observability`: Prometheus, Alertmanager, exporters and blackbox probes from `docker-compose.observability.yml`; the overlay is shipped with releases but remains inactive unless the server enables the profile.

`ai_service` is core because the WWW BFF depends on its internal contract. Ollama is optional because provider placement is an operational choice.

## Readiness semantics

- Core process healthchecks gate container startup.
- AI staging/production uses `/ready`, which verifies the configured model provider's models endpoint.
- OCR and liveness expose `/health` for process diagnostics, but Compose gates them on `/ready` so a missing model cannot appear healthy.
- Liveness intentionally reports not ready until reviewed ONNX presentation-attack assets are mounted read-only from `LIVENESS_MODELS_PATH`. The host directory must contain `face_detection_yunet_2026may.onnx` and `anti_spoof_models/`; model binaries stay outside Git.

## TLS topology

Caddy is the origin TLS terminator and publishes the only production host ports, 80 and 443. Domain site labels intentionally omit `http://` so Caddy Automatic HTTPS can provision/renew origin certificates and redirect HTTP to HTTPS. A CDN such as Cloudflare may proxy in front, but its origin mode must validate Caddy TLS; the repository does not define a plaintext production origin.

## Required production controls

- Server-managed environment files; no real secrets in Git.
- Protected deployment environments and restricted deploy credentials.
- Persistent Caddy state for certificate renewal.
- Database backup/recovery runbook before destructive migrations.
- Payments, wallet live mode, KYC, and other sensitive features remain fail-closed until their specific runbooks and smoke tests pass.


## Observability deployment contract

The release archive includes `docker-compose.observability.yml` and
`infrastructure/observability/`. This keeps monitoring configuration versioned
with the application release while avoiding automatic activation on small
hosts. Production or staging enables the `observability` profile explicitly
through server-managed configuration when the host has been capacity-checked.

Prometheus and Alertmanager remain private; no observability UI is published by
the production edge contract.
