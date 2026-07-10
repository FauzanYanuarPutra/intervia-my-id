# Chat And WhatsApp

Status: repo audit 2026-07-11.

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

Needs deeper verification:

- WebSocket/channel behavior.
- Attachment storage and media limits.
- Block/report flows specific to chat.
- Rate limit policy.
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
