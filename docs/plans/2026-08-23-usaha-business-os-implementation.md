# Lajukan Usaha Business OS — Implementation Plan

> Implement as one reviewable feature branch, with regression gates before merge.

## 1. Architecture contract

- Add `scripts/ci/check_usaha_business_os_contract.py`.
- Gate required Google OAuth routes, real auth adapter, marketplace-backed business adapter, Locations route, schema migration and WWW redirects.
- Forbid production business API imports from `portal-store` and `portal-session`.

## 2. Identity-backed Usaha auth

- Add server-only auth/session helpers.
- Add `/api/auth/google` and `/api/auth/google/callback`.
- Replace local phone login with Identity proxy semantics.
- Add `/api/auth/me`, `/api/auth/logout` and authenticated `/login` experience.
- Keep cookies host-local and secure in production.

## 3. Business workspace adapter

- Add server-only Identity and Marketplace clients.
- List organizations for the signed-in actor.
- List/create/update real UMKM stores from Marketplace.
- Map Marketplace payloads to the existing `BusinessRecord` view model so existing product/order/operations screens can migrate without a UI rewrite.
- Refactor `portal-server.ts` and `/api/businesses` away from local storage.

## 4. Organization + locations persistence

- Add versioned Marketplace migrations for `organization_id` and `business_locations`.
- Backfill a primary location from existing store address/coordinates.
- Keep the legacy store fields during migration for compatibility.

## 5. Usaha Business OS UI

- Add authenticated root dashboard.
- Rename `Usaha Portal` to `Lajukan Usaha`.
- Add location section in navigation and setup progress.
- Add location manager UI + BFF routes.
- Make new-business onboarding identity-backed and location-aware.

## 6. WWW separation

- Redirect legacy owner pages to the Usaha origin.
- Preserve public storefront/discovery surfaces.
- Update Manage hub Business action to open Usaha rather than another WWW management page.

## 7. Infrastructure

- Add Usaha Google callback/env contracts.
- Ensure Identity dev fallback CORS includes localhost:3003.
- Ensure Compose gives Usaha internal Identity/Marketplace URLs and Google credentials.

## 8. Verification

Dedicated `Usaha Business OS Gate` must require:

- architecture regression contract
- Usaha typecheck
- Usaha production build
- focused Python/route contract checks
- schema migration presence/shape

Existing unrelated repository quality debt must not be represented as a failure of this feature gate.