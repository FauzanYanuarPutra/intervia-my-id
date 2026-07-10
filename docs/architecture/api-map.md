# API Map

Status: repo audit 2026-07-11.

## Identity Service

Base evidence: `services/identity_service/src/main.rs`.

- `GET /health`
- `/auth/register`, `/auth/login`, `/auth/login-phone`, `/auth/oauth/google`
- `/auth/change-password`, `/auth/reset-password`, `/auth/me`, `/auth/refresh`, `/auth/logout`
- `/users/by-phone/{phone}`, `/users/by-email/{email}`, `/users/discover`, `/users/public/{id}`
- `/users/me` get/update/delete
- `/users`, `/users/{id}`

## Marketplace Service

Base evidence: `services/marketplace_service/src/main.rs`.

- Content/listings: `/v1/content`, `/v1/content/{id}`, likes, reviews, offers.
- Events/AI OS: `/v1/events`, `/v1/ai-os/overview`.
- Learning/rewards: `/v1/learning/courses`, course modules/lessons, rewards balance/daily claim.
- Lajukan demand: `/v1/lajukan/summary`, `/v1/lajukan/requests`.
- UMKM: `/v1/umkm/stores`, store detail/update, gallery likes, products.
- Orders/transactions: `/v1/orders`, `/v1/orders/{id}/transition`, `/v1/transactions`, lifecycle endpoints from fund/accept/start/deliver/dispute/resolve/cancel/complete/review.
- Wallet: `/v1/wallet/balance`, ledger, topups, withdrawals, Midtrans notify.
- Notifications: `/v1/notifications`, unread count, read/read-all, stream.
- Support: `/v1/support/tickets`, replies.
- CRM: `/v1/crm/leads`, `/v1/crm/leads/{id}`, `/v1/crm/activities`. Current API is lead/activity-only; target owner CRM APIs are documented in `architecture/crm-architecture.md`.
- Super-app ops: `/v1/super-app/orders`, trust profiles.
- CMS: `/v1/sectors`, `/v1/banners`.

## Community Service

Base evidence: `services/community_service/src/main.rs`.

- Community: `/v1/community/feed`, `/v1/community/search`, groups, group members, join/leave, permissions.
- Reels: `/v1/reels`, feed, detail/update/delete, viewer state, actions, events, comments.
- Forum: `/v1/forum/overview`, search, tags, uploads, media, categories, threads, posts, vote, poll vote, solution.

## Chat Service

Base evidence: `services/chat_service/lib/chat_service_web/router.ex`.

- `/api/v1/dm`
- `/api/v1/rooms`, room members
- `/api/v1/support/rooms`
- `/api/v1/rooms/:room_id/messages`
- `/api/v1/rooms/:room_id/read`
- `/api/v1/inbox`

## Next.js BFF Routes

`frontend/www/src/app/api` exposes route groups for:

- AI, auth, chat, community, content, CRM, events, forum, home trending searches, learning, notifications, reels, rewards, super-app, support, transactions, user, users, wallet, webhooks.

Treat these as product-facing API surfaces. Check the route implementation before changing response shape.
