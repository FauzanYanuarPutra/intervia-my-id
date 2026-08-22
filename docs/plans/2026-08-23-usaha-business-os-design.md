# Lajukan Usaha Business OS — Design

Date: 2026-08-23
Status: implementation target

## Product boundary

Lajukan is one ecosystem with two intentionally different contexts:

- `www.lajukan.com` is the public/discovery surface: Explore, search, public storefronts, nearby businesses/maps, community, reels, personal profile, personal listings and personal transactions.
- `usaha.lajukan.com` is the merchant workspace: business onboarding, profile, locations, catalog, orders, operations, team, analytics and business security.

Public business discovery remains on WWW. Any mutation of business identity, location, catalog or operations belongs in Usaha.

## Source of truth

The existing local `portal-store` and `usaha_session` cookie are not production sources of truth.

- Identity and authentication: `identity_service`.
- Business workspace membership: `identity_service.organizations`.
- Business/storefront state: `marketplace_service.umkm_stores`.
- Business location details: marketplace store metadata during the compatibility phase, with a versioned `business_locations` schema added for the durable model.

A user can belong to multiple organizations. A business workspace is selected independently from the signed-in user.

## Authentication

Usaha uses the same identity backend as WWW but has host-local cookies. Google OAuth must finish on the Usaha callback and exchange the Google identity with `identity_service /auth/oauth/google`.

Usaha cookies:

- `access_token` — HttpOnly, host local.
- `refresh_token` — HttpOnly, host local.
- `session_id` — HttpOnly, host local when returned by Identity.
- `auth_present` — non-HttpOnly UX hint only.

Do not set a broad `.lajukan.com` cookie domain.

## Business model

Target relationship:

```text
User
  -> Organization membership
       -> Business / storefront
            -> Locations
            -> Catalog
            -> Orders
            -> Operations
            -> Team / permissions
```

`organization_id` is introduced beside the legacy `owner_user_id` so old stores keep working while business workspaces migrate.

## Location model

Locations are first-class business data. A location contains:

- name and type (`physical`, `service_area`, `online`)
- address hierarchy
- latitude/longitude
- phone and WhatsApp
- timezone
- regular and special business hours
- lifecycle status
- primary-location flag
- public visibility
- metadata

The Usaha UI exposes a dedicated `Lokasi & Cabang` workspace and reuses the existing Leaflet picker/map components.

## Usaha information architecture

Primary workspace navigation:

1. Beranda
2. Profil usaha
3. Lokasi & Cabang
4. Katalog
5. Pesanan
6. Operasional
7. Tim
8. Halaman pembeli
9. Keamanan

Dashboard is action-first. It prioritizes incomplete setup, active orders, low stock and location readiness before decorative analytics.

## WWW compatibility

Legacy owner routes under `/:locale/usaha/*` remain compatible but redirect to `NEXT_PUBLIC_USAHA_URL`. Public storefront/discovery routes are not migrated out of WWW.

The WWW Manage hub keeps personal/content/community work, while the Business item opens the Usaha workspace.

## Security and authorization

Usaha server routes never trust an account id supplied by a browser cookie or request body. They derive the actor from the Identity access token. Organization membership is resolved from Identity before presenting workspace state.

Marketplace still validates the authenticated owner for legacy mutation endpoints. The new durable organization/location schema is additive so authorization can move to organization roles without breaking existing stores.

## Migration strategy

1. Add real Usaha Identity/OAuth session.
2. Replace local Usaha API/store reads with Identity + Marketplace adapters.
3. Add organization/location schema compatibility.
4. Promote Locations to a first-class Usaha module.
5. Make the root Usaha page an authenticated action dashboard.
6. Redirect duplicate WWW owner-management routes.
7. Add a dedicated CI contract and runtime build gate.

No destructive removal of public routes or old database fields is performed in this migration.