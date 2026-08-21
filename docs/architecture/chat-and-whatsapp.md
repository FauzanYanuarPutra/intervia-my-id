# Chat And WhatsApp

Status: repo audit updated 2026-08-13.

## Internal Chat

Evidence:

- Frontend pages: `frontend/www/src/app/[locale]/(app)/chat`.
- BFF routes: `frontend/www/src/app/api/chat/*`.
- Chat service routes: `services/chat_service/lib/chat_service_web/router.ex`.
- ScyllaDB schema: `users`, `presence`, `rooms`, `room_members`, `user_rooms`, `messages`, `message_reads`, `unread_counters`.

Implemented API concepts found:

- DM room creation.
- Group rooms and room members.
- Support rooms.
- Message list/create.
- Read state.
- Inbox.
- Directional user blocking with server-side enforcement for DM creation,
  websocket sends, HTTP sends, and call starts.
- Room/message report intake with membership validation and append-only Scylla
  records.
- Stable message `client_ref` reservations shared by WebSocket and HTTP sends;
  transport retries reuse one canonical timeuuid and do not repeat inbox/unread
  side effects.
- Canonical attachment policy shared by the BFF and Chat service. User media is
  limited to controlled proxy paths, unsafe historical references fail closed,
  and sticker reactions use Unicode instead of third-party image hosts.
- Voice/video calls load short-lived coturn REST credentials from an authenticated BFF route. Production and `WEBRTC_RELAY_ONLY=true` calls require a configured `TURN_URLS` plus `TURN_SHARED_SECRET`, use `iceTransportPolicy: relay`, and fail closed with a user-safe error when the relay is unavailable. Public STUN/direct-P2P fallback is limited to development and test environments. Static `NEXT_PUBLIC_*` TURN passwords are not supported.

Interaction contract:

- Lajukan follows familiar Indonesian messaging grammar (conversation list, `Semua`/`Belum dibaca`/`Grup`, bottom multiline composer, reply/quote, attachment tray, and previewable voice notes) without copying WhatsApp branding.
- Connection state means connection to Lajukan Chat only. The UI must not say end-to-end encrypted unless a reviewed E2EE key protocol and device-verification flow actually exist.
- A room-level unread clear is not a persisted per-message delivery/read receipt. The UI keeps the truthful server-accepted state until a canonical receipt cursor exists.
- Writing assistance is review-first: generated text is placed in the composer and the user explicitly sends it. It is not the same product or configuration as Profile AI.

Client delivery and storage lifecycle (2026-08-13):

- The healthy path is `bounded local snapshot -> one canonical revalidation ->
  realtime events -> one bounded focus/reconnect sync`. Message-history polling is
  not part of the steady state.
- Production prefers the same-origin Phoenix WebSocket already exposed through
  the reverse proxy. Long Poll is an explicit operator override or Phoenix
  fallback, not the default transport. Repeated Long Poll HTTP requests must be
  distinguished from repeated business-endpoint fetches when diagnosing traffic.
- The inbox cache is a sanitized per-user `sessionStorage` snapshot (five-minute
  TTL, at most 30 rooms). Recent room messages use per-user/per-room IndexedDB
  snapshots (seven-day TTL, 100 messages per room, at most 24 rooms per user).
  Both caches are acceleration layers, are cleared when the authenticated user
  context is released or changes, and never prove delivery/read or E2EE.
- A read acknowledgement must clear both `unread_counters` and
  `user_room_state.unread_count`. The cell timestamp ensures a message written
  after the acknowledgement can mark the room unread again without overwriting
  the latest-message metadata.
- HTTP is the canonical history bootstrap. A room-channel join sends presence,
  not a second unused copy of message history. Identical inbox/history requests
  are single-flight and stale room/user responses are ignored.

Production schema rollout:

- `scylla_migrate` applies every additive, idempotent CQL file before
  `chat_service` starts in the production Compose stack. Keep the same
  migration-before-replica ordering in non-Compose deployments.
- Deploy all Chat replicas before the WWW client when a transport contract
  changes. Mixed old/new replicas do not provide the exactly-once guarantee.

Needs deeper verification:

- WebSocket/channel behavior.
- Durable replay for the inbox/unread/broadcast projection after the canonical
  message row is committed. Message storage is exactly-once, but projection
  repair still needs an outbox/reconciler.
- Cross-month history pagination. `messages` is partitioned by monthly
  `(room_id, bucket)` and currently has no per-room bucket manifest. A safe
  implementation needs an additive bucket projection/backfill plus cursor
  metadata through Chat service, BFF, and UI; it must not scan arbitrary empty
  months.
- Production TURN relay capacity, abuse budgets, and credential rotation drills.
- Rate limit policy.
- Moderation queue ownership and report status-transition workflow after chat
  report intake.
- Listing/profile relationship beyond BFF/UI integration.

## WhatsApp

Evidence:

- WhatsApp Meta helper: `frontend/www/src/lib/whatsappMeta.ts`.
- Webhook route: `frontend/www/src/app/api/webhooks/whatsapp-meta/route.ts`.
- Fonnte webhook route exists.
- UI/helper code uses WhatsApp fields and generated hrefs in UMKM owner/profile surfaces.
- Environment variables configure WhatsApp provider, but secrets must never be copied into docs or logs.

Implemented/observed concepts:

- WhatsApp OTP/provider integration.
- Seller/store WhatsApp fields in metadata.
- WhatsApp contact links in some product/UMKM surfaces.

Needs deeper verification:

- Consent model for displaying seller phone.
- Click tracking coverage for WhatsApp CTA.
- Default message templates by listing/store context.
- Desktop/mobile fallback behavior.

## Product Rule

Do not remove chat or WhatsApp casually. Chat keeps platform history and privacy; WhatsApp matches Indonesian business behavior. Both should be measured.
