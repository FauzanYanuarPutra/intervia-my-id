# Critical User Journeys

Date: 2026-07-11
Purpose: define the user journeys Lajukan should protect before release. This file separates what is currently smoke-tested from what still needs authenticated/backend coverage.

## P0 Journeys

| Journey | Main User | Desired Path | Current Coverage | Gap | Priority |
| --- | --- | --- | --- | --- | --- |
| Search to supplier contact | Buyer/UMKM owner | Home/search -> result -> detail -> WhatsApp/chat | Route render, search submit, detail render | Real WhatsApp/chat event and CRM lead handoff not fully tested | P0 |
| Local business discovery | Buyer/UMKM owner | `/id/umkm` -> search/filter/map/list -> pick business -> route/contact | UMKM page render, controls clickable, no fake distance | Real geolocation permission and production store data not fully tested | P0 |
| Create listing/request | Supplier or buyer | `/id/create` -> choose need/offer -> category -> form -> publish | Public route render only | Authenticated publish and moderation path not tested | P0 |
| Listing detail trust check | Buyer | Result/detail -> see photos, location, verification, safety, seller | Fixture detail render | Real seller profile, report, review, save not fully tested | P0 |
| Login return | Returning user | Protected action -> login -> return to original page | Login route with `next` render | Callback, session refresh, and open-redirect hardening need dedicated tests | P0 |

## P1 Journeys

| Journey | Main User | Desired Path | Current Coverage | Gap | Priority |
| --- | --- | --- | --- | --- | --- |
| Community to business contact | Community user | Community post -> business/profile/listing -> contact | Community route render | CTA data relation and contact conversion not tested | P1 |
| Reels to business action | Content viewer | Reels -> product/business CTA -> detail/contact | Reels route render | Media playback and product CTA handoff not tested | P1 |
| Seller CRM lead capture | Seller | Buyer inquiry -> contact/lead created -> follow-up task | Docs/foundation reviewed | Must require consent, idempotency, and anti-spam tests before enablement | P1 |
| Home recommendations by location | Buyer | Home recommendation -> distance based on viewer/listing location -> detail | Distance helper/unit covered | Real browser geolocation and backend distance sorting not fully tested | P1 |
| Report unsafe listing | Buyer | Detail -> report -> support/moderation queue | Route/report UI partially present | End-to-end moderation queue not tested | P1 |

## P2 Journeys

| Journey | Main User | Desired Path | Current Coverage | Gap | Priority |
| --- | --- | --- | --- | --- | --- |
| AI profile assistant | Logged-in user | Profile AI -> settings -> chat tab/history | Not covered in this smoke | Needs performance budget and data privacy tests | P2 |
| AI image assisted create | Listing creator | Upload image -> safe suggestions -> user confirmation | Intentionally not prioritized | Local vision model latency remains high on current laptop | P2 |
| Payment/order flow | Buyer/seller | Quote/order -> payment -> status update | Not covered in this smoke | Needs sandbox provider and webhook idempotency tests | P2 |

## Journey Rules

- Do not convert passive views or simple clicks into CRM leads. Use high-intent actions only: chat, quote request, need submission, WhatsApp click, order, or explicit seller/admin action.
- Do not display distance when viewer location is unknown and backend distance is absent.
- Prefer WhatsApp as the primary contact CTA for early Indonesia UMKM flows, while still tracking clicks and preserving safety notices.
- Keep older and lower-literacy users in mind: avoid hidden controls, tiny hit targets, and horizontal page scrolling.
- Any AI-generated suggestion must be user-confirmed before it fills, publishes, prices, or sends messages.

## Minimum Release Gate

Before public production promotion, these should pass:

1. Multi-viewport smoke for home, search, UMKM, create, detail, login, register, support, community, and reels.
2. Authenticated create-to-publish on one supply category and one demand category.
3. Search-to-detail-to-contact with analytics event and no duplicate CRM lead.
4. UMKM map/list with viewer location allowed and denied.
5. Report listing flow into a moderation/support record.
6. Login `next` safety test for internal path allowlist.
7. Basic performance budget on mobile for home, search, and `/id/umkm`.

