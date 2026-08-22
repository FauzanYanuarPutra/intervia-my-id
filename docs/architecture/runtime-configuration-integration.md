# Runtime Configuration Integration

## Scope

This design covers the runtime configuration path for the WWW authentication
boundary, Redis-backed abuse controls, Google OAuth, the Caddy edge, and an
optional Cloudflare Tunnel. It does not copy historical secret-bearing env
files or enable production credentials.

## Decisions

1. `.env.development`, `.env.staging`, and `.env.production` remain the only
   launcher inputs. Versioned or backup env files are not loaded implicitly.
2. Compose passes an explicit least-privilege allowlist to each container.
   Secret-bearing env files are never mounted wholesale into WWW.
3. WWW auth routes use the shared Redis service. Authentication rate limiting
   stays fail-closed when Redis is unavailable.
4. Google OAuth is optional, but its client ID, client secret, and redirect URI
   form one atomic configuration. A partial configuration fails preflight.
5. The Google client secret is available only to WWW, which performs the code
   exchange. Identity receives only the client ID needed to verify the token.
6. Development Caddy is an optional HTTP edge without HSTS. Production Caddy
   terminates HTTPS and owns HSTS.
7. Cloudflare Tunnel is an optional profile layered in front of Caddy. It is
   disabled unless explicitly requested and requires a newly issued token.
8. Startup checks validate the merged Compose model before containers change,
   then verify requested edge/tunnel readiness after startup.

## Safety constraints

- Do not copy values from `.env.v1.development`.
- Do not print secret values in validation output.
- Do not make auth rate limiting fail-open to hide Redis failures.
- Do not expose server-only variables with a `NEXT_PUBLIC_` prefix.
- Production and staging redirects must use their canonical HTTPS origin.

## Verification contract

- The merged development model gives WWW an authenticated internal Redis URL
  and waits for Redis health.
- A login request no longer returns the rate-limit-service 503 while Redis is
  healthy.
- Empty Google configuration is allowed; partial Google configuration is not.
- The `edge` Compose profile resolves independently of `backoffice`.
- Caddy configuration validates in development and production modes.
- The default stack does not start Cloudflare Tunnel.
- The tunnel profile cannot report ready before a registered edge connection
  is observed.

## Operator workflows

Direct local development:

```powershell
.\up.ps1
```

Development through Caddy:

```powershell
.\up.ps1 -Profile edge
```

Cloudflare Tunnel is opt-in and requires a newly rotated token in the canonical
environment file:

```powershell
.\up.ps1 -Profile tunnel
```

The launchers validate the merged Compose model before changing containers,
wait for container health, and—only for the tunnel profile—wait for a
`Registered tunnel connection` event. A process that is merely running is not
reported as a ready tunnel.

Google OAuth remains disabled when all three Google values are empty. To enable
it, configure client ID, client secret, and redirect URI together, and register
that exact redirect URI in Google Cloud. Development uses
`http://localhost:3000/api/auth/google/callback`; staging and production use
their canonical HTTPS hosts.

Because local optimized Next.js images still use `NODE_ENV=production`, HTTPS
enforcement is selected from `APP_ENV`/`ENV`/`NEXT_PUBLIC_APP_ENV`. This avoids
HSTS and canonical HTTPS redirects in a development deployment while retaining
optimized builds.

## Secret incident note

Credentials previously pasted into chat or stored in historical env backups
must be treated as exposed. Rotate Google OAuth, Cloudflare Tunnel, JWT/session,
database, Redis, RabbitMQ, MinIO, and webhook credentials as applicable. Do not
copy `.env.v1.development` into the active environment. Empty provider values
are intentionally safer than silently reactivating an exposed secret.
