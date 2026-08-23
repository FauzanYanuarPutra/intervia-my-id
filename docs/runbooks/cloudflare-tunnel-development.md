# Cloudflare Tunnel development

Use this mode when the local Docker development stack on a workstation is intentionally published through the `server-laptop-lajukan` Cloudflare Tunnel.

## Traffic contract

Public traffic follows one ingress path:

```text
browser -> Cloudflare -> cloudflared -> caddy:80 -> internal Docker service
```

Cloudflare Published Applications should point to `http://caddy:80`. Do not point Cloudflare directly at `www:3000`, `usaha:3003`, `chat_service:4000`, or host `localhost` ports.

Required public hostnames for the current application contract:

- `lajukan.com`
- `www.lajukan.com`
- `usaha.lajukan.com`
- `chat.lajukan.com`
- `cms.lajukan.com` (protect with Cloudflare Access)
- `crm.lajukan.com` (protect with Cloudflare Access)
- `api.lajukan.com`
- `media.lajukan.com`

Every hostname above should use the same Tunnel service target:

```text
http://caddy:80
```

`api.lajukan.com` is required because the browser-facing API variables use that origin. `media.lajukan.com` is required because public MinIO/media URLs use that origin. A healthy connector does not make an unpublished hostname reachable; Cloudflare ingress and DNS still need to contain the hostname.

Do not publish Redis, RabbitMQ, Postgres, Scylla, Ollama, OCR, liveness, AI service, or the MinIO console directly.

## Local environment overrides

Keep `.env.development.example` safe for localhost-only development. For a real local tunnel deployment, set these values in the ignored `.env.development` file:

```dotenv
APP_DOMAIN=lajukan.com
FRONTEND_URL=https://www.lajukan.com
NEXT_PUBLIC_APP_URL=https://www.lajukan.com
NEXT_PUBLIC_WWW_URL=https://www.lajukan.com
NEXT_PUBLIC_CRM_URL=https://crm.lajukan.com
NEXT_PUBLIC_USAHA_URL=https://usaha.lajukan.com
NEXT_PUBLIC_API_URL=https://api.lajukan.com
NEXT_PUBLIC_MARKETPLACE_URL=https://api.lajukan.com
NEXT_PUBLIC_COMMUNITY_URL=https://api.lajukan.com
NEXT_PUBLIC_CHAT_WS_URL=wss://chat.lajukan.com/socket
PHX_HOST=chat.lajukan.com
MINIO_PUBLIC_URL=https://media.lajukan.com
WWW_GOOGLE_REDIRECT_URI=https://www.lajukan.com/api/auth/google/callback
USAHA_GOOGLE_REDIRECT_URI=https://usaha.lajukan.com/api/auth/google/callback
CORS_ORIGIN=https://www.lajukan.com
CORS_ORIGINS=https://www.lajukan.com,https://lajukan.com,https://usaha.lajukan.com,https://cms.lajukan.com,https://crm.lajukan.com,https://chat.lajukan.com
CHAT_MEDIA_ALLOWED_ORIGINS=https://www.lajukan.com,https://usaha.lajukan.com,https://chat.lajukan.com

# Secret. Obtain a fresh token from the Cloudflare Tunnel dashboard.
CLOUDFLARE_TUNNEL_TOKEN=<rotated-token>

# Optional. Defaults to true in development when a token exists.
CLOUDFLARE_TUNNEL_AUTO_START=true
```

Never commit the real `.env.development` file or tunnel/OAuth credentials.

If `CLOUDFLARE_TUNNEL_TOKEN` is configured in development, `up.ps1` and `up.sh` automatically enable the `tunnel` Compose profile unless `CLOUDFLARE_TUNNEL_AUTO_START=false` is set. Staging and production remain explicit and fail closed.

## Canonical start command

For the full workstation stack on Windows PowerShell:

```powershell
.\up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build
```

The profile resolver de-duplicates values from `COMPOSE_PROFILES` and `-Profile`, so repeating a profile in both places is harmless. In development, a configured tunnel token can also auto-enable the `tunnel` profile.

The full command intentionally enables:

- `backoffice`: CMS, CRM, and Usaha
- `edge`: Caddy
- `local-ai`: Ollama/local AI
- `kyc`: OCR and liveness
- `devtools`: development support services
- `tunnel`: Cloudflare Tunnel

Linux/macOS equivalent:

```bash
./up.sh \
  --profile backoffice \
  --profile edge \
  --profile local-ai \
  --profile kyc \
  --profile devtools \
  --profile tunnel \
  --build
```

## Startup validation flow

The launcher performs the following sequence before reporting success:

```text
resolve profiles
  -> validate Compose syntax
  -> provision local KYC models when requested
  -> validate merged runtime contract
  -> optionally build images
  -> docker compose up --wait
  -> verify Cloudflare Tunnel live edge state
  -> print final container status
```

Tunnel readiness is based on the current `cloudflared_tunnel_ha_connections` metric when the development metrics endpoint is host-published. The launcher no longer relies on a short recent-log window because an already-running connector may have registered hours earlier.

For environments where the metrics endpoint is intentionally private, the launchers retain an all-history `Registered tunnel connection` fallback.

## Verification

Check connector state:

```powershell
docker ps --filter "name=cloudflared"
docker logs --tail 100 lajukan_dev-cloudflared-1
```

Check current edge connections:

```powershell
(Invoke-WebRequest `
  -UseBasicParsing `
  http://127.0.0.1:2000/metrics
).Content | Select-String "cloudflared_tunnel_ha_connections"
```

Healthy example:

```text
cloudflared_tunnel_ha_connections 4
```

The diagnostic endpoint can also confirm each connector connection:

```powershell
(Invoke-WebRequest `
  -UseBasicParsing `
  http://127.0.0.1:2000/diag/tunnel
).Content
```

A configured tunnel must have a public `APP_DOMAIN` and HTTPS `NEXT_PUBLIC_APP_URL`; the launcher rejects `APP_DOMAIN=localhost` in tunnel mode rather than starting a configuration that cannot match the Cloudflare Host header.

A healthy connector only proves the workstation can reach Cloudflare Edge. If a hostname is absent from the Tunnel's Published Applications/remote ingress, that hostname will still fail even while `cloudflared_tunnel_ha_connections` is greater than zero.

## Credential rotation

If a tunnel token, Google OAuth client secret, webhook verification token, or another secret is pasted into a chat, issue, log, or commit, treat it as exposed. Rotate/revoke it at the provider and update only the ignored local environment or the deployment secret store.
