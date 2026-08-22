# Google OAuth for Lajukan Web Apps

Lajukan uses one Google OAuth **Web application** client for public web apps that share the same Lajukan identity system.

## Architecture

The Google credential is shared, while each web app owns an explicit callback URI:

```text
Google OAuth Web Client
  |
  +-- www.lajukan.com
  |     `-- WWW_GOOGLE_REDIRECT_URI
  |
  +-- usaha.lajukan.com
  |     `-- USAHA_GOOGLE_REDIRECT_URI
  |
  `-- identity_service
        `-- validates the same GOOGLE_CLIENT_ID
```

Do not create separate Google client IDs for WWW and Usaha unless there is an explicit isolation requirement. A single client prevents credential drift and keeps both apps attached to the same Lajukan account identity.

Lajukan currently uses its own OAuth routes and identity service integration. It does **not** use NextAuth/Auth.js for these Google login flows.

## Google Cloud configuration

Create or use one OAuth 2.0 Client ID with application type **Web application**.

Production authorized JavaScript origins:

```text
https://www.lajukan.com
https://usaha.lajukan.com
```

Production authorized redirect URIs:

```text
https://www.lajukan.com/api/auth/google/callback
https://usaha.lajukan.com/api/auth/google/callback
```

Local development origins:

```text
http://localhost:3000
http://localhost:3003
```

Local development redirect URIs:

```text
http://localhost:3000/api/auth/google/callback
http://localhost:3003/api/auth/google/callback
```

Staging uses the corresponding `www.staging.lajukan.com` and `usaha.staging.lajukan.com` origins and callback URIs.

## Canonical runtime environment

Use the same client credential for WWW and Usaha. Keep real values outside Git.

Production/tunnel example:

```env
GOOGLE_CLIENT_ID=<rotated-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<rotated-client-secret>
WWW_GOOGLE_REDIRECT_URI=https://www.lajukan.com/api/auth/google/callback
USAHA_GOOGLE_REDIRECT_URI=https://usaha.lajukan.com/api/auth/google/callback
```

Local development:

```env
WWW_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
USAHA_GOOGLE_REDIRECT_URI=http://localhost:3003/api/auth/google/callback
```

The Compose model passes the shared client ID to `identity_service` and the shared client ID/secret to the web apps. WWW reads `WWW_GOOGLE_REDIRECT_URI`; Usaha reads `USAHA_GOOGLE_REDIRECT_URI`.

## Removed / legacy variables

Do not add app-specific NextAuth variables merely for symmetry. They are not consumed by the current Lajukan Google OAuth flow.

Remove these from Lajukan runtime env files:

```text
GOOGLE_REDIRECT_URI
NEXTAUTH_URL
AUTH_URL
NEXTAUTH_URL_USAHA
AUTH_URL_USAHA
```

`GOOGLE_REDIRECT_URI` was the old ambiguous WWW callback name and has been replaced by `WWW_GOOGLE_REDIRECT_URI`.

## Runtime contract

OAuth is considered enabled when Google OAuth credentials are configured. Callback defaults may exist while OAuth is disabled.

When OAuth is enabled, startup validation rejects configuration when any of these invariants are broken:

- WWW has only part of its client ID, client secret, or `WWW_GOOGLE_REDIRECT_URI`.
- Usaha has only part of its client ID, client secret, or `USAHA_GOOGLE_REDIRECT_URI`.
- Identity does not receive the Google client ID.
- WWW, Usaha, and Identity use different Google client IDs.
- WWW and Usaha use different Google client secrets.
- a callback does not end at `/api/auth/google/callback`.
- a callback origin differs from that app's configured public origin.
- staging or production uses a non-HTTPS callback.
- a removed/legacy OAuth URL variable is still configured.

This catches configuration drift before a browser reaches Google and receives errors such as `401 invalid_client` or `redirect_uri_mismatch`.

## Development through Cloudflare Tunnel

When development is exposed through the tunnel, browser-facing origins and callbacks must all use the public hosts:

```env
APP_DOMAIN=lajukan.com
NEXT_PUBLIC_APP_URL=https://www.lajukan.com
NEXT_PUBLIC_WWW_URL=https://www.lajukan.com
NEXT_PUBLIC_USAHA_URL=https://usaha.lajukan.com
WWW_GOOGLE_REDIRECT_URI=https://www.lajukan.com/api/auth/google/callback
USAHA_GOOGLE_REDIRECT_URI=https://usaha.lajukan.com/api/auth/google/callback
```

Do not mix `NEXT_PUBLIC_USAHA_URL=http://localhost:3003` with an `https://usaha.lajukan.com/...` OAuth callback in the same runtime mode.

## Applying rotated credentials in development

After changing `.env.development`, recreate the services that consume the OAuth values:

```powershell
docker compose `
  --env-file .env.development `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  --profile backoffice `
  up -d --force-recreate --no-deps www usaha identity_service
```

Do not print the full client secret in terminal screenshots or commit it to Git.

A safe presence check is:

```powershell
docker exec lajukan_dev-www-1 node -e "const v=process.env.GOOGLE_CLIENT_ID||''; console.log(v ? v.slice(0,12)+'...'+v.slice(-20) : 'EMPTY')"
docker exec lajukan_dev-usaha-1 node -e "const v=process.env.GOOGLE_CLIENT_ID||''; console.log(v ? v.slice(0,12)+'...'+v.slice(-20) : 'EMPTY')"
```

The masked values should represent the same Google client ID.

## Security note

If a client secret has been exposed in chat, logs, screenshots, source history, or another untrusted location, rotate it in Google Cloud and update the runtime secret store. Do not restore the exposed value.
