# ADR-0001: CRM Owner/Internal Boundary

Status: Proposed

Date: 2026-07-11

## Context

Lajukan already has CRM primitives in `marketplace_service` and `frontend/crm`, but the current shape is mostly internal operations: leads, activities, users, listings, transactions, support, moderation, and disputes.

Product direction now requires a simpler owner CRM for UMKM, suppliers, service providers, and business owners. This CRM must manage customers, leads, conversations, follow-ups, offers, orders, and repeat customers.

## Decision

Keep current CRM implementation in marketplace service for the near term and evolve it additively.

Use two CRM modes:

- Owner CRM for business workspaces.
- Internal CRM for Lajukan operations.

Separate the two with workspace/business scope, roles, permission checks, and audit logging.

Do not create a standalone `crm_service` until CRM V1 has proven usage or marketplace CRM code becomes too coupled to maintain.

## Consequences

Positive:

- Reuses the CRM routes and tables already present.
- Avoids a premature service split.
- Lets owner CRM and internal CRM share primitives without exposing data across scopes.
- Gives the product room to validate simple UMKM workflows before a large backend migration.

Negative:

- `marketplace_service` remains a large service for longer.
- CRM migrations must be especially careful to avoid mixing internal and owner data.
- A future service split will require event replay/backfill and compatibility work.

## Required Follow-Up

- Add workspace/business scoping before owner CRM becomes public.
- Add contacts, tasks, quotes, and quote activities as explicit CRM objects.
- Define event idempotency for lead creation.
- Create a dedicated extraction ADR before building a separate `crm_service`.

