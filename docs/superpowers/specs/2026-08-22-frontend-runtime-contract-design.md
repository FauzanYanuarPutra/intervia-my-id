# Frontend Runtime Contract Design

## Status

Approved in chat on 2026-08-22. This design standardizes the web frontend runtime for `www`, `usaha`, `cms`, and `crm`. Flutter mobile is explicitly out of scope.

## Goal

Make every Next.js web app in `frontend/apps` follow one production-grade build/runtime contract while preserving app-specific ports, environment variables, security policy, and dependencies.

## Current Problems

1. `www` already builds shared packages, uses `output: 'standalone'`, copies static/public assets into the standalone tree, validates the generated server, and starts `server.js` directly.
2. `usaha` imports `../../packages/config/nextSecurityHeaders.mjs` but its Dockerfile does not copy/build `frontend/packages`; it enables standalone output but still runs `next start` with a full `.next` + `node_modules` runtime.
3. `cms` and `crm` copy/build shared packages but do not enable standalone output and still run `next start`.
4. `cms` and `crm` do not expose dedicated HTTP health routes. `usaha` already exposes `/api/health`.
5. Development Caddy routes `www` and `usaha`, but not `cms` and `crm`.
6. Development Compose puts `usaha`, `cms`, and `crm` under one `backoffice` profile even though `usaha` is a customer-facing Business OS surface.
7. Runtime smoke checks do not prove `usaha`, `cms`, `crm`, or Caddy routes are usable.
8. Production deployment probes only `www`, API, and chat; a broken `usaha`, `cms`, or `crm` can escape the health gate.

## Scope

### In scope

- `frontend/apps/usaha/Dockerfile`
- `frontend/apps/cms/Dockerfile`
- `frontend/apps/crm/Dockerfile`
- `frontend/apps/usaha/next.config.mjs`
- `frontend/apps/cms/next.config.mjs`
- `frontend/apps/crm/next.config.mjs`
- `frontend/apps/cms/package.json`
- `frontend/apps/crm/package.json`
- health routes for `www`, `cms`, and `crm`
- Docker Compose frontend build args and healthchecks
- development profile behavior for `usaha`
- development Caddy routes for CMS/CRM
- runtime smoke probes
- production deploy probes
- CI assertions that verify the frontend runtime contract

### Out of scope

- Flutter mobile runtime
- UI/feature changes inside any frontend
- authentication redesign
- changing production domains
- replacing Docker Compose or Caddy
- changing backend service ownership
- redesigning the release/image-tag scheme for environment-specific `NEXT_PUBLIC_*` values

The last item is intentionally deferred because it changes the release model. This implementation will make build-time arguments explicit and consistent with the existing `www` pattern, but it will not pretend a single prebuilt image can safely encode arbitrary staging/production public values.

## Golden Contract

Every Next.js web app must follow these rules:

1. Node base image: `node:20-bullseye-slim`.
2. Configure the same npm registry/retry/cache policy used by `www`.
3. Copy `frontend/packages` into `/app/packages` and build it before the app build.
4. Install app dependencies from the app lockfile with retry logic and verify/install matching `@next/swc-linux-x64-gnu` when needed.
5. Copy the app only after dependency layers to preserve Docker cache behavior.
6. Enable `output: 'standalone'`.
7. Set `outputFileTracingRoot` to the `frontend` monorepo root so local package dependencies are traced.
8. Build with TypeScript errors enabled; no `ignoreBuildErrors: true`.
9. Copy `.next/static` and `public` into `.next/standalone/apps/<app>/`.
10. Production runtime starts with `node .next/standalone/apps/<app>/server.js`, not `next start`.
11. Set `HOSTNAME=0.0.0.0`, `PORT=<app port>`, `NODE_ENV=production`, and disable Next telemetry.
12. Validate the generated standalone server during image build.
13. Expose a lightweight unauthenticated `/api/health` route returning `{ ok: true, service: '<app>' }`.
14. Docker Compose healthchecks use Node's built-in `fetch` rather than adding `curl` solely for health checks.
15. Build-time `NEXT_PUBLIC_*` values required by an app are passed through `build.args`; runtime-only secrets remain in `environment`.
16. App-specific envs remain app-specific; do not copy unrelated WWW features into CMS/CRM/Usaha.

## App Ports

- `www`: 3000
- `cms`: 3001
- `crm`: 3002
- `usaha`: 3003

## Next.js Configuration

### WWW

Keep the existing standalone configuration as the reference. Add only the standard health route if absent.

### Usaha

Keep existing internal-app security headers, HTTPS redirect behavior, and standalone output. Add `outputFileTracingRoot` using the existing `configDir` so monorepo packages are included correctly.

### CMS / CRM

Add:

- `fileURLToPath(import.meta.url)` + config directory
- `output: 'standalone'`
- `outputFileTracingRoot: path.resolve(configDir, '../..')`

Retain:

- internal CSP/security headers
- `robotsTag: 'noindex, nofollow, noarchive'`
- `transpilePackages: ['lajukan-ui']`
- existing webpack alias/module resolution behavior

## Dockerfiles

`usaha`, `cms`, and `crm` should visually resemble the `www` Dockerfile and differ only where the app requires it:

- stage names
- app directory
- port
- public build args
- memory ceiling where appropriate
- lint/typecheck/test commands that actually exist in that app

Do not introduce a single parameterized mega-Dockerfile in this change. Keeping one Dockerfile per app preserves readability and reduces coupling while the contract is still stabilizing.

## Package Scripts

- `usaha` already has `lint` and `typecheck`; preserve them.
- Add `typecheck: "tsc --noEmit -p tsconfig.json"` to `cms` and `crm`.
- Do not add a fake `test` script where no test suite exists.

## Health Contract

Each app responds on:

`GET /api/health`

with HTTP 200 and JSON:

```json
{
  "ok": true,
  "service": "<app>"
}
```

Health routes must not require login or downstream backend availability. They prove the frontend runtime itself is serving requests.

## Docker Compose

### Base compose

Add frontend healthchecks for all four Next apps using Node fetch. Healthchecks target each app's own `/api/health` endpoint.

### Development compose

- `usaha` becomes part of the default stack, not the `backoffice` profile.
- `cms` and `crm` remain in `backoffice`.
- `caddy` remains opt-in through `edge` / `tunnel`.
- Add build args for each app's relevant `NEXT_PUBLIC_*` values so development images do not silently compile stale defaults.

## Caddy Development Routes

Add:

- `http://cms.{$APP_DOMAIN}` -> `cms:3001`
- `http://crm.{$APP_DOMAIN}` -> `crm:3002`

Both receive the same basic internal security headers philosophy as `usaha` and should use gzip/zstd encoding.

## CI / Runtime Smoke

The existing core smoke must additionally prove `usaha` is reachable because it becomes a default frontend.

Add a full-surface smoke mode/job that activates `backoffice` + `edge`, then verifies:

- `www` direct health
- `usaha` direct health
- `cms` direct health
- `crm` direct health
- Caddy route for `www.localhost`
- Caddy route for `usaha.localhost`
- Caddy route for `cms.localhost`
- Caddy route for `crm.localhost`

Failure diagnostics must print Compose status and relevant logs.

## Production Deployment Gate

Keep existing probes and add:

- `https://usaha.<domain>/api/health`
- `https://cms.<domain>/api/health`
- `https://crm.<domain>/api/health`

using the same local `--resolve ...:127.0.0.1` technique already used by the deploy workflow.

A release must not be marked successful if any required web surface fails its health probe.

## Security / Operational Constraints

- Health endpoints reveal only service identity and boolean health, no build secrets or internal topology.
- CMS/CRM remain `noindex`.
- No secrets are moved into Docker build arguments.
- Do not add live backend readiness dependencies to frontend health routes.
- Do not weaken existing CSP or security headers.
- Do not expose new host ports in production; Caddy remains the only published production edge.

## Success Criteria

The change is complete when:

1. `www`, `usaha`, `cms`, and `crm` all build as standalone Next servers.
2. All four images validate their standalone server path during build.
3. All four answer `/api/health` successfully.
4. `usaha` starts in the default development stack.
5. `cms` and `crm` start with `--profile backoffice`.
6. Development Caddy routes all four apps when the corresponding services are active.
7. CI validates the core and full-surface runtime paths.
8. Production deployment health-gates `usaha`, `cms`, and `crm` in addition to the existing surfaces.
9. No frontend UI/business logic is changed.
