# Cloudflare Tunnel development

Use this mode when the local Docker development stack on a workstation is intentionally published through the `server-laptop-lajukan` Cloudflare Tunnel.

## Traffic contract

Public traffic follows one ingress path:

```text
browser -> Cloudflare -> cloudflared -> caddy:80 -> internal Docker service
```

Cloudflare Published Applications should point to `http://caddy:80`. Do not point Cloudflare directly at `www:3000`, `usaha:3003`, `chat_service:4000`, or host `localhost` ports.

Recommended hostnames:

- `lajukan.com`
- `www.lajukan.com`
- `usaha.lajukan.com`
- `chat.lajukan.com`
- `cms.lajukan.com` (protect with Cloudflare Access)
- `crm.lajukan.com` (protect with Cloudflare Access)
- `api.lajukan.com`
- `media.lajukan.com`

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
GOOGLE_REDIRECT_URI=https://www.lajukan.com/api/auth/google/callback
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

## Start

Windows PowerShell:

```powershell
.\up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools -Build
```

The launcher will resolve the configured tunnel automatically, validate the merged Compose/runtime contract, start `cloudflared`, and wait for a `Registered tunnel connection` log before reporting success.

Linux/macOS:

```bash
./up.sh --profile backoffice --profile edge --profile local-ai --profile kyc --profile devtools --build
```

## Verification

Check connector state:

```powershell
docker ps --filter "name=cloudflared"
docker logs --tail 100 lajukan_dev-cloudflared-1
```

A configured tunnel must have a public `APP_DOMAIN` and HTTPS `NEXT_PUBLIC_APP_URL`; the launcher rejects `APP_DOMAIN=localhost` in tunnel mode rather than starting a configuration that cannot match the Cloudflare Host header.

After Cloudflare reports the connector healthy, verify `https://www.lajukan.com` and the required subdomains. A Cloudflare 1033 means there is no healthy tunnel connector; an origin/routing failure after the connector is healthy should be debugged between `cloudflared`, Caddy, and the selected upstream.

## Credential rotation

If a tunnel token, Google OAuth client secret, webhook verification token, or another secret is pasted into a chat, issue, log, or commit, treat it as exposed. Rotate/revoke it at the provider and update only the ignored local environment or the deployment secret store.
