# Deployment Architecture

Status: verified against repository HEAD on 2026-08-22.

## Release contract

Images are built once and addressed by immutable `sha-<40-character-commit>` tags. Staging and production must deploy the same candidate SHA; production must not rebuild a different artifact.

Production deployment remains manual through a protected GitHub environment. The remote deployment performs:

1. immutable tag and Compose contract validation;
2. image pull;
3. `docker compose up --wait` with bounded timeout;
4. HTTPS probes for WWW, Marketplace health, and Chat readiness through Caddy;
5. persistence of the last successful immutable tag.

If the health gate fails after replacement begins, the workflow redeploys the last validated tag. Database changes must therefore follow expand/backfill/switch/verify/contract and remain backward-compatible with the previous application release during the rollback window.

## Runtime profiles

- Core: data services, Identity, Marketplace, Community, Chat, AI orchestrator, and WWW.
- `local-ai`: local Ollama only. The orchestrator may instead use an external OpenAI-compatible provider.
- `kyc`: OCR and liveness inference services. These are not production-ready merely because containers start.
- `backoffice`: CMS, CRM, and Usaha in the development overlay.
- `edge`: local Caddy in development.

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
