# Frontend Usaha

`frontend/usaha` adalah app portal bisnis yang berjalan di `http://localhost:3003` saat development.

## What It Is

- Portal operasional usaha untuk role `owner`, `manager`, `cashier`, dan `viewer`
- App terpisah dari `frontend/www`
- Bisa dibuka dalam mode guest demo maupun mode logged-in account
- Saat ini berbasis store in-memory, bukan backend persistent

## What It Is Not

- Bukan public marketplace app
- Bukan support ticket system
- Bukan auth production-grade
- Bukan source of truth data bisnis jangka panjang

## Dev Notes

- Port local default: `3003`
- Service dev dijalankan dari `docker-compose.dev.yml`
- Session memakai cookie `usaha_session`
- State utama ditentukan oleh `resolvePortalHomeState()` di `src/lib/portal-server.ts`

## Core Entry Files

1. `src/app/(portal)/page.tsx`
2. `src/components/portal/PortalShell.tsx`
3. `src/lib/portal-server.ts`
4. `src/lib/portal-logic.ts`
5. `src/lib/portal-store.ts`
6. `src/lib/portal-session.ts`
7. `src/lib/portal-data.ts`
8. `src/app/api/businesses/route.ts`

## Project Documentation

- Full AI-ready reference: [docs/frontend-usaha-reference.md](./docs/frontend-usaha-reference.md)
- Flow, use case, and Indonesian QA guide: [docs/flow-validasi-dan-testcase-id.md](./docs/flow-validasi-dan-testcase-id.md)
- Workspace-level copy: [../../docs/frontend-usaha-reference.md](../../docs/frontend-usaha-reference.md)

## Root Flow

| Condition | Result |
| --- | --- |
| Guest without `?business=` | Launcher |
| Guest with `?business=` | Demo dashboard |
| Logged in without memberships | Empty business state |
| Logged in with memberships | Full dashboard |

## Main Mutations

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `POST /api/businesses`
- `PATCH /api/businesses/[businessId]`
- `POST /api/businesses/[businessId]/products`
- `PATCH /api/businesses/[businessId]/operations`
- `POST /api/businesses/[businessId]/team/invites`

## Important Caveats

- Data reset bisa terjadi kalau dev server restart
- Orders dan reservations mostly read-only di current implementation
- Team invite belum punya accept/reject flow
- Buyer page readiness adalah derived state, bukan field yang diset manual
