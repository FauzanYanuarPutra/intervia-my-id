# CRM Architecture

Status: architecture direction 2026-07-11.

## 2026-07-11 Direction Clarification

This architecture note captures the current CRM implementation and the older owner/internal split. The next product priority is internal Lajukan Match CRM as specified in `docs/crm/*`: requirements, listings, AI matching, reviewed connections, feedback, analytics, support, and moderation. Owner/seller CRM primitives should be added only when they do not dilute that internal matching flow.

This document describes how Lajukan CRM should evolve from the current repository state into the owner CRM and internal CRM described in `docs/product/crm-strategy.md`.

## Current Implementation

The CRM domain currently lives inside marketplace service plus two frontend surfaces:

- Backend owner: `services/marketplace_service/src/main.rs`.
- Database migration: `services/marketplace_service/migrations/20260224120000_crm_leads.up.sql`.
- Backend routes:
  - `GET/POST /v1/crm/leads`
  - `GET/PATCH /v1/crm/leads/{id}`
  - `GET /v1/crm/activities`
- WWW BFF routes:
  - `frontend/www/src/app/api/crm/leads/route.ts`
  - `frontend/www/src/app/api/crm/activities/route.ts`
- Dedicated CRM app: `frontend/crm`.

Current tables:

| Table | Current Role |
| --- | --- |
| `crm_leads` | Lead/opportunity records with requester, owner, contact, content, chat room, stage, source, value, metadata |
| `crm_activities` | Timeline entries attached to a lead |

Current limitations:

- No first-class contacts table.
- No first-class tasks/follow-ups.
- No quote/offer object.
- No explicit workspace/business scope for owner CRM vs internal CRM.
- Existing role model is internal-ops oriented.
- Some event-to-lead logic treats search/result/map signals as leads; product strategy should refine this so passive intent remains analytics unless an explicit follow-up flow exists.

## Boundary Decision

Short term:

- Keep CRM backend in `marketplace_service`.
- Add CRM capabilities through additive migrations and clear API contracts.
- Reuse existing `crm_leads` and `crm_activities` where behavior is already live.

Medium term:

- Split to `crm_service` only after CRM V1 proves real usage or marketplace CRM code becomes too coupled.
- A service split requires an ADR, data migration plan, event replay/backfill plan, and parity tests.

This avoids creating another service before the domain is stable.

## Target Domain Model

Target CRM data should be explicit rather than stuffing everything into lead metadata.

| Entity | Key Fields | Owner |
| --- | --- | --- |
| `crm_workspaces` | id, type, owner_user_id, business_id, name | CRM |
| `crm_contacts` | id, workspace_id, name, phone, wa_phone, email, city, source, consent flags | CRM |
| `crm_leads` | id, workspace_id, business_id, contact_id, listing_id, requirement_id, pipeline_type, stage, value, source | CRM |
| `crm_conversation_links` | workspace_id, lead_id, contact_id, channel, conversation_id, last_message_at | CRM references chat/provider |
| `crm_activities` | lead_id, actor, action, message, metadata, created_at | CRM |
| `crm_tasks` | lead_id/contact_id, assignee, due_at, status, task_type, note | CRM |
| `crm_quotes` | lead_id, contact_id, status, total, expires_at, terms, public_token | CRM |
| `crm_quote_items` | quote_id, title, quantity, unit_price, metadata | CRM |
| `crm_orders` | quote_id/transaction_id, status, amount, payment_status | CRM references marketplace/payment |
| `crm_lost_reasons` | lead_id, reason_code, note | CRM |

Existing `crm_leads` can be extended gradually:

1. Add `workspace_id`, `business_id`, and `contact_id` when owner CRM starts.
2. Backfill internal CRM rows into an internal workspace.
3. Create contacts/tasks/quotes as separate tables.
4. Move metadata-only fields into typed columns only after repeated usage is proven.

## Event Contract

CRM should react to high-intent events. Every event that can create or update CRM state needs an idempotency key.

| Event | Producer | CRM Action |
| --- | --- | --- |
| `listing.inquiry_created` | Marketplace/www | Create/update contact and lead |
| `requirement.created` | Marketplace/www | Create buyer-side lead |
| `requirement.response_created` | Marketplace | Create provider-side opportunity |
| `conversation.started` | Chat/www | Link conversation to lead |
| `message.received` | Chat/WhatsApp | Update activity, last message, unread SLA |
| `whatsapp.clicked` | WWW | Create/update lead if listing/contact context exists |
| `quote.sent` | CRM | Add activity, create follow-up task |
| `quote.accepted` | CRM/public quote | Move lead toward order/payment |
| `order.created` | Marketplace/payment | Link order and stage |
| `payment.succeeded` | Payment/wallet | Mark lead/order successful |
| `payment.failed` | Payment/wallet | Create recovery task |
| `ticket.created` | Support | Link internal CRM/support timeline |

Passive analytics events such as listing impressions and generic listing views should not create CRM leads by default.

## Integration Rules

### Identity

Identity owns:

- user,
- roles,
- sessions,
- business profile ownership,
- team membership.

CRM stores references and permission scopes, not duplicate identity records.

### Marketplace

Marketplace owns:

- listings,
- requirements,
- offers/requests if already in marketplace,
- transactions/orders,
- seller/buyer relationship context.

CRM stores references and timeline state.

### Chat

Chat owns:

- room/conversation,
- messages,
- attachments,
- read state.

CRM should store:

- `conversation_id`,
- channel,
- last message summary,
- last message time,
- important activity markers.

CRM should not duplicate all chat messages into PostgreSQL.

### WhatsApp

WhatsApp should be the first external inbox integration.

Rules:

- require owner opt-in and verified business channel,
- store webhook payloads minimally,
- mask or restrict sensitive payload access,
- use templates only when allowed by provider policy,
- keep inbound messages linked to contact and lead,
- record status events as activities.

### Payments

CRM should not own money movement. It should consume payment/order events and update lead/order status.

## Permission Model

| Role | Access |
| --- | --- |
| Owner | Full workspace access |
| Admin | Contacts, leads, quotes, orders, inbox, settings except billing/security owner actions |
| Sales | Assigned leads, contacts, tasks, quotes |
| CS | Inbox, tickets, customer timelines |
| Viewer | Read-only reports and timelines |
| Internal Ops | Internal CRM workspace only unless support/admin escalation grants audited access |

Every CRM row should eventually include:

- `workspace_id`,
- `business_id` when business-scoped,
- `owner_user_id` or assignee,
- `created_by`,
- `updated_by`,
- audit metadata for sensitive actions.

## API Shape

Current APIs can remain as compatibility layer:

- `/v1/crm/leads`
- `/v1/crm/leads/{id}`
- `/v1/crm/activities`

Future additive APIs:

- `/v1/crm/workspaces`
- `/v1/crm/contacts`
- `/v1/crm/leads/{id}/activities`
- `/v1/crm/tasks`
- `/v1/crm/quotes`
- `/v1/crm/quotes/{id}/send`
- `/v1/crm/quotes/public/{token}`
- `/v1/crm/inbox`
- `/v1/crm/lost-reasons`

Do not break existing CRM app endpoints until parity is confirmed.

## Migration Sequence

1. Add workspace/business/contact foundations without removing existing columns.
2. Backfill an internal workspace for existing ops leads.
3. Add owner workspace creation from business profile creation.
4. Add contact upsert from high-intent events.
5. Add tasks/follow-up table and dashboard queries.
6. Add quote tables and public quote view.
7. Link orders/payments by event, not by direct cross-service writes.
8. Only then evaluate `crm_service` extraction.

## Security And Privacy

- Do not turn passive behavior into sales contacts without clear user intent.
- Do not expose internal CRM records to owner CRM users.
- Audit support/admin access to owner CRM records.
- Limit WhatsApp payload retention.
- Preserve consent/source for imports and external channels.
- Rate-limit lead creation from public endpoints.
- Use idempotency keys for webhooks/events to prevent duplicate leads.
- Avoid logging phone numbers, message bodies, OTPs, or provider tokens.

## Observability

Track:

- lead created,
- lead stage changed,
- lead lost reason captured,
- task created/completed/overdue,
- quote sent/opened/accepted/rejected/expired,
- inbox message received/replied,
- WhatsApp clicked,
- CRM dashboard viewed,
- CRM import completed/failed.

These events should feed product analytics and AI learning, but not replace explicit CRM records.
